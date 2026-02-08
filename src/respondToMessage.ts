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
    const systemPrompt = `You are a helpful assistant in a group chat. 
Messages will be formatted as "username: message". 
The username before the colon is who is speaking to you. 
Treat it as metadata, not as part of their message.`;

    await channel.sendTyping();

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: state.getMessages(),
      system: systemPrompt,
    });

    const assistantMessage = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    console.log(`Response: ${assistantMessage}`);

    state.addAssistantMessage(assistantMessage);

    for (const chunk of chunkMessage(assistantMessage)) {
      await message.reply(chunk);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('Sorry, I encountered an error processing your message.');
  }
}
