import Anthropic from '@anthropic-ai/sdk';

export const createClaudeClient = (apiKey: string) => {
  return new Anthropic({ apiKey });
};
