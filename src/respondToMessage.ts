import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Message, TextChannel } from 'discord.js';
import { chunkMessage } from './chunkMessage.js';

const SESSION_FILE = '.bot.session';

let sessionId: string | undefined = existsSync(SESSION_FILE)
  ? readFileSync(SESSION_FILE, 'utf-8').trim() || undefined
  : undefined;

const systemPrompt = `You are a helpful assistant in a group chat.
Messages will be formatted as "username: message".
The username before the colon is who is speaking to you.
Treat it as metadata, not as part of their message.`;

export async function respondToMessage(
  message: Message,
  channel: TextChannel,
): Promise<void> {
  try {
    await channel.sendTyping();

    const q = query({
      prompt: `${message.author.displayName}: ${message.content}`,
      options: {
        pathToClaudeCodeExecutable: '/home/stephen/.local/bin/claude',
        model: 'claude-opus-4-6',
        allowedTools: [],
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
      await message.reply('I had nothing to say. Please try again.');
      return;
    }

    for (const chunk of chunkMessage(result)) {
      await message.reply(chunk);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sessionId = undefined;
    await message.reply('Sorry, I encountered an error processing your message.');
  }
}
