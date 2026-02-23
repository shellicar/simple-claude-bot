import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessageWithSubtype } from './types';

export const hasSubType = (m: SDKMessage): m is SDKMessageWithSubtype => {
  return 'subtype' in m;
};
