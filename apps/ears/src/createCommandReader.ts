import { createInterface } from 'node:readline';
import { type CommandContext, dispatchCommand } from '@simple-claude-bot/ears-core/commands';

export function createCommandReader(commandContext: CommandContext, signal: AbortSignal) {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => dispatchCommand(commandContext, line));
  signal.addEventListener('abort', () => {
    rl.close();
  });
}
