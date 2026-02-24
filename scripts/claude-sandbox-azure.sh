#!/bin/sh
export HOME=/home/bot
CLI="$(readlink -f /home/site/wwwroot/packages/brain-core/node_modules/@anthropic-ai/claude-code/cli.js)"
exec setpriv --reuid=bot --regid=bot --init-groups -- "$CLI" "$@"
