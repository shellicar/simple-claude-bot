import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

export function isRateLimited(msg: SDKResultSuccess): boolean {
  const noTokens = msg.total_cost_usd === 0 && msg.usage.input_tokens === 0 && msg.usage.output_tokens === 0;
  return noTokens && msg.result.includes('429') && msg.result.includes('rate_limit_error');
}
