# Async Callback Specification

## Overview

Replace the synchronous HTTP request/response pattern between Ears and Brain with an async callback model. Brain returns immediately and sends results back via HTTP callbacks to Ears.

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
 |<-------- 202 + {id} --------|  (immediate)
 |                              |
 |                              |-- starts processing
 |                              |
 |<-- POST /callback {typing} -|  (heartbeat)
 |   (fire typing indicator)    |
 |                              |
 |<-- POST /callback {typing} -|  (heartbeat, ~8s later)
 |   (fire typing indicator)    |
 |                              |
 |<-- POST /callback {message} |  (done)
 |   (deliver to Discord)       |
 |                              |
```

## Brain Changes (BananaBot's domain)

### 1. Accept callback URL in request

Add `callbackUrl` to `RespondRequestSchema`:

```typescript
export const RespondRequestSchema = z.object({
  messages: z.array(PlatformMessageSchema),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
  callbackUrl: z.string().url(),
});
```

### 2. Return 202 Accepted immediately

```typescript
app.post('/respond', async (c) => {
  const body = RespondRequestSchema.parse(await c.req.json());
  const correlationId = crypto.randomUUID();

  // Fire and forget — process in background
  processAndCallback(audit, body, sandboxConfig, correlationId).catch((error) => {
    logger.error(`Background processing failed: ${error}`);
  });

  return c.json({ correlationId }, 202);
});
```

### 3. Background processing with callbacks

```typescript
async function processAndCallback(
  audit: AuditWriter,
  body: RespondRequestOutput,
  sandboxConfig: SandboxConfig,
  correlationId: string,
): Promise<void> {
  const callbackUrl = body.callbackUrl;

  // Start typing heartbeat
  const typingInterval = setInterval(() => {
    postCallback(callbackUrl, {
      correlationId,
      type: 'typing',
    }).catch((err) => logger.warn(`Typing callback failed: ${err}`));
  }, 8000);

  // Send initial typing immediately
  await postCallback(callbackUrl, { correlationId, type: 'typing' });

  try {
    const replies = await respondToMessages(audit, body, sandboxConfig);

    await postCallback(callbackUrl, {
      correlationId,
      type: 'message',
      replies,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await postCallback(callbackUrl, {
      correlationId,
      type: 'error',
      error: errorMessage,
    });
  } finally {
    clearInterval(typingInterval);
  }
}
```

### 4. Callback POST helper

```typescript
async function postCallback(url: string, payload: CallbackPayload): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000), // 5s timeout for callbacks
  });
  if (!response.ok) {
    logger.warn(`Callback to ${url} failed: ${response.status}`);
  }
}
```

## Ears Changes (Hellcar's domain — PROPOSAL)

### 1. Add callback endpoint

Ears needs an HTTP server (it currently only has the Discord WebSocket client). Options:
- Add Hono/Express alongside the Discord client
- Or use Node's built-in `http.createServer`

```
POST /callback
Content-Type: application/json

{
  "correlationId": "uuid",
  "type": "typing" | "message" | "error",
  "replies?": ParsedReply[],
  "error?": string
}
```

### 2. Handle callback types

```typescript
// type: "typing"
// → channel.sendTyping() — just beat, no state tracking

// type: "message"
// → dispatchReplies(channel, payload.replies, trackedMessages)
// → respond with delivered message IDs

// type: "error"
// → channel.sendMessage('Sorry, I encountered an error...')
// → log the error
```

### 3. Message ID in callback response

When Ears delivers messages to Discord, it gets message IDs back from the Discord API. The callback response should return these:

```typescript
// Response to type: "message" callback
{
  "delivered": [
    { "index": 0, "messageId": "1234567890" },
    { "index": 1, "messageId": "1234567891" }
  ]
}
```

This gives Brain the Discord message IDs for future use (reactions, edits, etc).

### 4. Update BrainClient.respond()

Change from waiting for the full response to:
- POST to Brain, receive 202
- Wait for callback on the HTTP server
- Return the result

Or simpler: the callback handler directly dispatches to Discord, and `BrainClient.respond()` is no longer needed for the `/respond` flow.

### 5. Pass callback URL to Brain

Ears needs to know its own callback URL and pass it in the request:

```typescript
const response = await brain.respond({
  messages: batch,
  systemPrompt,
  allowedTools: ['WebSearch', 'WebFetch'],
  callbackUrl: `http://${EARS_HOST}:${EARS_PORT}/callback`,
});
```

Within the same Container App Environment, this would be the internal hostname.

## Callback Payload Types (Shared)

```typescript
interface CallbackTyping {
  correlationId: string;
  type: 'typing';
}

interface CallbackMessage {
  correlationId: string;
  type: 'message';
  replies: ParsedReply[];
}

interface CallbackError {
  correlationId: string;
  type: 'error';
  error: string;
}

type CallbackPayload = CallbackTyping | CallbackMessage | CallbackError;

interface CallbackMessageResponse {
  delivered: Array<{
    index: number;
    messageId: string;
  }>;
}
```

## Migration Strategy

### Phase 1: Add callback support alongside existing sync
- Brain accepts both: if `callbackUrl` present → async, otherwise → existing sync
- No breaking changes, both paths work
- Ears can migrate incrementally

### Phase 2: Ears adds HTTP server and callback handler
- New HTTP server alongside Discord WebSocket
- `/callback` endpoint handles Brain's callbacks
- `/respond` call changes to fire-and-forget

### Phase 3: Remove sync path
- Once callback is proven, remove the synchronous wait from Brain's `/respond`
- Remove the 10-minute timeout from both sides
- Brain's HTTP server timeout can drop to something reasonable (30s for accepting requests)

## Open Questions

1. **Ears HTTP port**: What port should Ears listen on? Needs to be accessible from Brain within the CAE.
2. **Auth on callback**: Should Brain authenticate to Ears' callback endpoint? Within the same CAE the network is private, but belt-and-suspenders.
3. **Ordering**: If Brain sends `typing` and `message` callbacks very close together, can they arrive out of order? Probably not over localhost, but the correlation ID helps if they do.
