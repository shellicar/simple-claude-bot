# Async Callback Specification

## Overview

Replace the synchronous HTTP request/response pattern between Ears and Brain with an async callback model. Brain returns 202 immediately and sends results back via HTTP callbacks to a request-scoped URL provided by Ears.

## Current Flow (Synchronous)

```
Ears                          Brain
 |                              |
 |-- POST /respond ----------->|
 |   (waits up to 10 min)      |-- processes (30s - 5min+)
 |                              |
 |<-------- 200 + JSON --------|
 |                              |
 |-- deliver to Discord         |
```

**Problems:**
- Ears blocked for entire processing duration
- 10-minute HTTP timeout limit
- Azure Container Apps idle timeout can kill long-running connections
- Typing indicator managed by Ears (guessing Brain's state)

## Proposed Flow (Async Callback)

```
Ears                          Brain
 |                              |
 |-- POST /respond ----------->|
 |   (with callbackUrl)        |
 |<-------- 202 ---------------|  (immediate, empty body)
 |                              |
 |                              |-- starts processing
 |                              |
 |<-- POST callbackUrl         |  (typing heartbeat)
 |   { type: "typing" }        |
 |   (fire typing indicator)   |
 |                              |
 |<-- POST callbackUrl         |  (typing heartbeat, ~8s later)
 |   { type: "typing" }        |
 |                              |
 |<-- POST callbackUrl         |  (done — delivers replies)
 |   { type: "message", ... }  |
 |   (deliver to Discord)      |
 |   responds with message IDs |
```

## Key Design Decisions

### Callback URL is the correlation

The callback URL is **unique per request** — Ears generates it (e.g. `/callback/:uuid`) and passes it in the request body. Brain just POSTs to whatever URL it was given. No correlation ID in the payloads. The URL *is* the correlation.

### No error callback type

Brain owns error formatting. If processing fails, Brain decides whether and what to post. The default behavior is to send a `message` callback with a user-friendly error reply, but Brain is free to silently swallow errors or handle them however it sees fit. Think of it like an answering machine message — you set it up beforehand, not in the moment.

### Typing is a heartbeat

Discord typing is a heartbeat, not start/stop. Brain just beats (`{ type: "typing" }`) at regular intervals. The typing indicator naturally expires after ~10s if not refreshed. Brain sends the first beat immediately on accepting the request, then every 8 seconds until processing completes.

### Backward compatible

If `callbackUrl` is omitted from the request, Brain falls back to the existing synchronous behavior (awaits processing, returns 200 with replies). Both paths coexist.

## Brain Changes (Implemented ✅)

### Request schema

`callbackUrl` added as optional to `RespondRequestSchema`:

```typescript
export const RespondRequestSchema = z.object({
  messages: z.array(PlatformMessageSchema),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
  callbackUrl: z.string().url().optional(),
});
```

`messageId` added as optional to `PlatformMessageSchema` for future use:

```typescript
export const PlatformMessageSchema = z.object({
  // ... existing fields ...
  messageId: z.string().optional(),
});
```

### /respond endpoint

```typescript
app.post('/respond', async (c) => {
  const body = RespondRequestSchema.parse(await c.req.json());

  if (body.callbackUrl) {
    // Async: return 202 immediately, process in background
    processAndCallback(body).catch((error) => {
      logger.error(`Unhandled error in background processing: ${error}`);
    });
    return c.body(null, 202);
  }

  // Sync: existing behavior
  const replies = await respondToMessages(audit, body, sandboxConfig);
  return c.json({ replies } satisfies RespondResponse);
});
```

### Background processing

```typescript
async function processAndCallback(body): Promise<void> {
  const callbackUrl = body.callbackUrl!;

  // Beat immediately
  await postCallback(callbackUrl, { type: 'typing' });

  // Keep beating every 8s
  const typingInterval = setInterval(() => {
    postCallback(callbackUrl, { type: 'typing' });
  }, 8000);

  try {
    const replies = await respondToMessages(audit, body, sandboxConfig);
    await postCallback(callbackUrl, { type: 'message', replies });
  } catch (error) {
    // Brain owns the error message
    await postCallback(callbackUrl, {
      type: 'message',
      replies: [{ message: `⚠️ Something went wrong: ${errorMessage}` }],
    });
  } finally {
    clearInterval(typingInterval);
  }
}
```

### Callback POST helper

5-second timeout, fire-and-forget with warning on failure:

```typescript
async function postCallback(url: string, payload: CallbackPayload): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    logger.warn(`Callback to ${url} failed with status ${response.status}`);
  }
}
```

Both `brain` (Hono) and `brain-azure` (Azure Functions) are updated.

## Callback Payload Types (Shared)

```typescript
interface CallbackTyping {
  type: 'typing';
}

interface CallbackMessage {
  type: 'message';
  replies: ParsedReply[];
}

type CallbackPayload = CallbackTyping | CallbackMessage;
```

Two types. That's it.

## Ears Changes (Proposal)

### 1. Add HTTP server for callbacks

Ears currently only has the Discord WebSocket client. It needs an HTTP server to receive callbacks. Options:
- Hono (already a dependency in the monorepo)
- Node's built-in `http.createServer`

### 2. Callback endpoint

```
POST /callback/:requestId
Content-Type: application/json

{ "type": "typing" }
  or
{ "type": "message", "replies": ParsedReply[] }
```

The `:requestId` is generated by Ears when it sends the request to Brain. It maps to the Discord channel context needed to deliver the response.

### 3. Handle callback types

```typescript
// type: "typing"
// → channel.sendTyping()

// type: "message"
// → dispatchReplies(channel, payload.replies)
// → respond with delivered message IDs
```

### 4. Message ID in callback response

When Ears delivers messages to Discord, it gets message IDs back. Return these in the HTTP response to the `message` callback:

```typescript
// Response to type: "message" callback
{
  "delivered": [
    { "index": 0, "messageId": "1234567890" },
    { "index": 1, "messageId": "1234567891" }
  ]
}

// Response to type: "typing" callback
// 200 OK (empty or minimal)
```

Type: `CallbackMessageResponse` (defined in shared types).

### 5. Pass callback URL in request

```typescript
const requestId = randomUUID();
await brain.respond({
  messages: batch,
  systemPrompt,
  allowedTools,
  callbackUrl: `http://${EARS_CALLBACK_HOST}:${EARS_CALLBACK_PORT}/callback/${requestId}`,
});
// Returns 202 — Ears is now free, callbacks will arrive on the HTTP server
```

### 6. Request context tracking

Ears needs to map `requestId` → channel context so the callback handler knows where to deliver:

```typescript
// When sending request to Brain
pendingRequests.set(requestId, { channel, startedAt: Date.now() });

// In callback handler
const context = pendingRequests.get(requestId);
// ... use context.channel to deliver ...
// On "message" callback: pendingRequests.delete(requestId);
```

### 7. Timeout safety net

If Brain dies completely (process crash, network failure), it will never call back. Ears needs a timeout to clean up:

```typescript
// Periodic sweep (e.g. every 60s)
for (const [id, ctx] of pendingRequests) {
  if (Date.now() - ctx.startedAt > MAX_WAIT_MS) {
    pendingRequests.delete(id);
    // Optionally notify channel
  }
}
```

## Migration Strategy

### Phase 1: Brain-side (done ✅)
- Brain accepts both: `callbackUrl` present → async 202, absent → existing sync 200
- No breaking changes, Ears continues working as-is

### Phase 2: Ears adds callback support
- New HTTP server alongside Discord WebSocket
- `/callback/:requestId` endpoint handles Brain's callbacks
- `BrainClient.respond()` sends `callbackUrl`, receives 202, returns immediately
- Callback handler dispatches directly to Discord

### Phase 3: Remove sync path
- Once callback is proven, remove the synchronous wait from Brain's `/respond`
- Remove the 10-minute timeout from both sides
- Brain's HTTP server timeout can drop to something reasonable (30s)

## Open Questions

1. **Ears HTTP port**: What port should Ears listen on for callbacks? Needs to be accessible from Brain.
2. **Auth on callback**: Should Brain authenticate to Ears' callback endpoint? Within a private network this may be unnecessary, but belt-and-suspenders.
