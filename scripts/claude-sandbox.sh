#!/bin/sh
export HOME=/home/bot
CLI="$(readlink -f /app/node_modules/@anthropic-ai/claude-code/cli.js)"
exec setpriv --reuid=bot --regid=bot --init-groups -- "$CLI" "$@"
