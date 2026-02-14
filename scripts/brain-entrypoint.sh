#!/bin/sh
set -e
export HOME=/home/bot
mkdir -p /home/bot/.claude
cp -r /opt/claude-home/* /home/bot/.claude/
chown -R bot:bot /home/bot/.claude/hooks /home/bot/.claude/settings.json 2>/dev/null
chmod 700 /audit
exec "$@"
