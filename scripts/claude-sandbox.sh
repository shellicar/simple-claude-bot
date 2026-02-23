#!/bin/sh
export HOME=/home/bot
CLI="$(readlink -f /app/packages/brain-core/node_modules/@anthropic-ai/claude-code/cli.js)"
exec setpriv --reuid=bot --regid=bot --init-groups -- "$CLI" "$@"
