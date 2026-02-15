import type { HookInput } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';

export function logHook(input: HookInput): void {
  switch (input.hook_event_name) {
    case 'PostToolUse': {
      const toolInput = typeof input.tool_input === 'string' ? input.tool_input : JSON.stringify(input.tool_input);
      logger.info(`Tool use: ${input.tool_name} — ${toolInput}`);
      break;
    }
    case 'PostToolUseFailure':
      logger.warn(`Tool failure: ${input.tool_name} — ${input.error}`);
      break;
    case 'SessionStart':
      logger.info(`Session start: source=${input.source} model=${input.model ?? 'unknown'}`);
      break;
    case 'SessionEnd':
      logger.info(`Session end: reason=${input.reason}`);
      break;
    case 'SubagentStart':
      logger.info(`Subagent start: id=${input.agent_id} type=${input.agent_type}`);
      break;
    case 'SubagentStop':
      logger.info(`Subagent stop: id=${input.agent_id} type=${input.agent_type}`);
      break;
    case 'Notification':
      logger.info(`Notification: ${input.message}`);
      break;
  }
}
