#!/bin/sh
export HOME=/home/bot
cp /opt/auth/.credentials.json /home/bot/.claude/.credentials.json
chown bot:bot /home/bot/.claude/.credentials.json
exec setpriv --reuid=bot --regid=bot --init-groups -- claude "$@"
