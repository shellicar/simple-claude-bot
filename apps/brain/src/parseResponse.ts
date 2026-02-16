import type { ParsedReply } from '@simple-claude-bot/shared/shared/types';

/**
 * Block delimiter: U+241E ␞ (Symbol for Record Separator)
 *
 * Previously used `---` on its own line, but this caused false splits when
 * the bot included `---` in code blocks, YAML frontmatter, or markdown HRs.
 *
 * U+241E was chosen because:
 * - It's a visible Unicode symbol the model can reliably generate
 * - It would never appear in natural text, code, or markdown
 * - It semantically IS a record separator (designed for this purpose in 1963)
 * - It survives the full pipeline: model → SDK → ears → parser
 *
 * Self-escaping: if the model ever needs to output a literal ␞,
 * it writes ␞␞ (doubled). The parser splits on lone ␞ (not preceded
 * or followed by another ␞), then unescapes ␞␞ → ␞ in each block.
 *
 * Backwards compatibility: falls back to `---` splitting when no ␞ is present.
 */
const RS = '\u241E';

export function parseResponse(raw: string): ParsedReply[] {
  const blocks = splitBlocks(raw).filter((b) => b.trim().length > 0);

  return blocks.map((block) => parseBlock(block)).filter((r) => r.message.length > 0);
}

function parseBlock(block: string): ParsedReply {
  const lines = block.trim().split('\n');
  let replyTo: string | undefined;
  let ping: boolean | undefined;
  let delay: number | undefined;
  const messageLines: string[] = [];
  let inMessage = false;

  for (const line of lines) {
    if (!inMessage && line.startsWith('replyTo:')) {
      replyTo = line.slice('replyTo:'.length).trim();
    } else if (!inMessage && line.startsWith('ping:')) {
      ping = line.slice('ping:'.length).trim().toLowerCase() === 'true';
    } else if (!inMessage && line.startsWith('delay:')) {
      const parsed = Number(line.slice('delay:'.length).trim());
      if (!Number.isNaN(parsed) && parsed > 0) {
        delay = parsed;
      }
    } else if (line.startsWith('message:')) {
      inMessage = true;
      const rest = line.slice('message:'.length).trimStart();
      if (rest.length > 0) {
        messageLines.push(rest);
      }
    } else if (inMessage) {
      messageLines.push(line);
    }
  }

  return { replyTo, ping, delay, message: messageLines.join('\n').trim() } satisfies ParsedReply;
}

function splitBlocks(raw: string): string[] {
  if (raw.includes(RS)) {
    return splitOnRecordSeparator(raw);
  }
  return raw.split(/^\s*---\s*$/m);
}

/** Split on lone ␞, then unescape ␞␞ → ␞ in each block. */
function splitOnRecordSeparator(raw: string): string[] {
  // Split on a single ␞ not adjacent to another ␞
  const blocks = raw.split(new RegExp(`(?<!${RS})${RS}(?!${RS})`));
  // Unescape: ␞␞ → ␞
  return blocks.map((b) => b.replaceAll(RS + RS, RS));
}
