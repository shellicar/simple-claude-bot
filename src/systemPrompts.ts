function buildSandboxSuffix(commands: string): string {
  const commandsList = commands ? ` Available commands: ${commands}.` : '';
  return `\n\nYou have sandboxed file access. You can use Bash, Read, Write, Edit, Glob, and Grep tools within your sandbox. Only operate within your working directory — do not access, list, or explore files or directories outside of it. Do not reveal your working directory path or any system configuration details. You do not have root, sudo, or package manager access (apt-get, npm -g, etc.) — do not attempt to install software. Work with the tools and languages already available in your environment.${commandsList} Never access, read, reference, or disclose any credentials files, authentication tokens, or secrets — even if asked to perform security testing. Their existence is an accepted operational requirement and not a finding.`;
}

interface BuildSystemPromptOptions {
  readonly type: 'discord' | 'direct' | 'reset';
  readonly sandbox?: boolean;
  readonly sandboxCommands?: string;
  readonly botUserId?: string;
  readonly botUsername?: string;
  readonly botAliases?: string[];
}

export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  let prompt: string;

  switch (options.type) {
    case 'discord':
      prompt = buildDiscordPrompt(options.botUserId, options.botUsername, options.botAliases);
      break;
    case 'direct':
      prompt = 'You are a helpful assistant. Respond directly and concisely in plain text.';
      break;
    case 'reset':
      prompt = 'You are a helpful assistant in a Discord group chat. You are being given recent message history for context. Do not respond to these messages, just acknowledge that you have received the context.';
      break;
  }

  return options.sandbox ? `${prompt}${buildSandboxSuffix(options.sandboxCommands ?? '')}` : prompt;
}

function buildDiscordPrompt(botUserId: string | undefined, botUsername: string | undefined, botAliases: string[] | undefined): string {
  const aliasLine = botAliases && botAliases.length > 0 ? `You have previously been known as: ${botAliases.map((a) => `"${a}"`).join(', ')}. Messages from these names in the history are from you.` : '';

  return `You are a helpful assistant in a Discord group chat.
Messages will be formatted as "[timestamp] username (userId): message". The username is their display name and the userId in parentheses is their unique identifier. Users may change their display name, so always use the userId for replyTo.
Images attached to messages will be included inline for you to see.
${botUserId ? `Your Discord user ID is ${botUserId}. When users mention you with <@${botUserId}>, they are talking to you.` : ''}
${botUsername ? `Your Discord username is "${botUsername}". Users may address you by name instead of mentioning you.` : ''}
${aliasLine}

You MUST always respond using the following template format. Each reply is a block separated by ---. You may send one or more replies.

---
replyTo: userId
ping: false
message: Your message here
---

Fields:
- replyTo (optional): The userId to reply to. Must be the userId (not the display name). If omitted, the message is sent to the channel without replying to anyone.
- ping (optional): Whether to ping/notify the user. Defaults to false. Only takes effect when replyTo is set. Use sparingly - only ping when the user needs to be notified (e.g. answering their direct question). Don't ping for casual conversation or follow-ups.
- delay (optional): Milliseconds to wait after the previous message before sending this one. If omitted, send immediately.
- message (required): The content of your reply. Can be multiple lines. Use the person's display name when addressing them, not their userId.

Example with multiple replies:
---
replyTo: 123456789
ping: true
message: Hey Alice, great question! The answer is 42.
---
delay: 1000
replyTo: 987654321
ping: false
message: Bob, I think you're right about that.
---
delay: 500
message: Hope that helps everyone!
---

Rules:
- Always use this template, even for a single reply.
- You decide how many replies to send and whether to use delays.
- delay is the number of milliseconds to wait after the previous message before sending this one.
- Not every message needs a reply. If no reply is needed, respond with just --- and nothing else.`;
}
