#!/bin/sh
export HOME=/home/bot
if [ "$CONTAINER_ROLE" = "brain" ]; then
  cp -r /opt/claude-home/* /home/bot/.claude/
  chown -R bot:bot /home/bot/.claude/hooks /home/bot/.claude/settings.json 2>/dev/null
fi
exec "$@"
