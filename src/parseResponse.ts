interface ParsedReply {
  replyTo?: string;
  ping?: boolean;
  delay?: number;
  message: string;
}

export function parseResponse(raw: string): ParsedReply[] {
  const blocks = raw.split('---').filter((b) => b.trim().length > 0);

  return blocks.map((block) => {
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

    return {
      replyTo,
      ping,
      delay,
      message: messageLines.join('\n').trim(),
    } satisfies ParsedReply;
  }).filter((r) => r.message.length > 0);
}
