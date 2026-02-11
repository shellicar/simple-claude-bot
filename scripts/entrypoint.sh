#!/bin/sh
export HOME=/home/bot
cp -r /opt/claude-home/* /home/bot/.claude/
chmod 700 /opt/auth
chown -R bot:bot /home/bot/.claude/hooks /home/bot/.claude/settings.json 2>/dev/null
exec "$@"
