import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { Message, TextChannel } from 'discord.js';
import { chunkMessage } from './chunkMessage.js';
import { parseResponse } from './parseResponse.js';

const timestampFormatter = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'short',
  timeStyle: 'long',
});

const SESSION_FILE = '.bot.session';

let sessionId: string | undefined = existsSync(SESSION_FILE)
  ? readFileSync(SESSION_FILE, 'utf-8').trim() || undefined
  : undefined;

const systemPrompt = `You are a helpful assistant in a Discord group chat.
Messages will be formatted as "[timestamp] username: message". The timestamp is in ISO 8601 format. The username before the colon identifies who is speaking.

You MUST always respond using the following template format. Each reply is a block separated by ---. You may send one or more replies.

---
replyTo: username
message: Your message here
---

Fields:
- replyTo (optional): The username to reply to. If omitted, the message is sent to the channel without replying to anyone.
- delay (optional): Milliseconds to wait after the previous message before sending this one. If omitted, send immediately.
- message (required): The content of your reply. Can be multiple lines.

Example with multiple replies:
---
replyTo: Alice
message: Hey Alice, great question! The answer is 42.
---
delay: 1000
replyTo: Bob
message: Bob, I think you're right about that.
---
delay: 500
message: Hope that helps everyone!
---

Rules:
- Always use this template, even for a single reply.
- You decide how many replies to send and whether to use delays.
- delay is the number of milliseconds to wait after the previous message before sending this one.
- Not every message needs a reply. Use your judgement.`;

export async function respondToMessages(
  messages: Message[],
  channel: TextChannel,
): Promise<void> {
  try {
    await channel.sendTyping();

    const prompt = messages
      .map((m) => `[${timestampFormatter.format(m.createdAt)}] ${m.author.displayName}: ${m.content}`)
      .join('\n');

    const q = query({
      prompt,
      options: {
        pathToClaudeCodeExecutable: '/home/stephen/.local/bin/claude',
        model: 'claude-opus-4-6',
        allowedTools: ['WebSearch', 'WebFetch'],
        maxTurns: 1,
        systemPrompt,
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

    let result = '';
    for await (const msg of q) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
        writeFileSync(SESSION_FILE, sessionId);
      }
      if (msg.type === 'result' && msg.subtype === 'success') {
        result = msg.result;
      }
    }

    console.log(`Response: ${result}`);

    if (!result) {
      return;
    }

    const replies = parseResponse(result);

    if (replies.length === 0) {
      for (const chunk of chunkMessage(result)) {
        await channel.send(chunk);
      }
      return;
    }

    const messagesByAuthor = new Map<string, Message>();
    for (const m of messages) {
      messagesByAuthor.set(m.author.displayName, m);
    }

    for (const reply of replies) {
      if (reply.delay) {
        await setTimeout(reply.delay);
      }

      const target = reply.replyTo ? messagesByAuthor.get(reply.replyTo) : undefined;

      for (const chunk of chunkMessage(reply.message)) {
        if (target) {
          await target.reply(chunk);
        } else {
          await channel.send(chunk);
        }
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sessionId = undefined;
    await channel.send('Sorry, I encountered an error processing your message.');
  }
}
