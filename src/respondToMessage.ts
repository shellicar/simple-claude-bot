import Anthropic from '@anthropic-ai/sdk';
import { Message, TextChannel } from 'discord.js';
import { ConversationState } from './ConversationState.js';
import { chunkMessage } from './chunkMessage.js';

export async function respondToMessage(
  message: Message,
  channel: TextChannel,
  anthropic: Anthropic,
  state: ConversationState,
): Promise<void> {
  try {
    state.addUserMessage(message.content);

    await channel.sendTyping();

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      messages: state.getMessages(),
    });

    const assistantMessage = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    state.addAssistantMessage(assistantMessage);

    for (const chunk of chunkMessage(assistantMessage)) {
      await message.reply(chunk);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('Sorry, I encountered an error processing your message.');
  }
}
