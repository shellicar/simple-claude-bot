#!/bin/sh
INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1)
LOG=/tmp/cerberus.log

block() {
  if echo "$CMD" | grep -qiE "$1"; then
    echo "$(date '+%H:%M:%S') DENIED: $CMD" >> "$LOG"
    echo "denied" >&2
    exit 2
  fi
}

echo "$(date '+%H:%M:%S') CHECK: $CMD" >> "$LOG"

block '\.credentials'
block '/home/bot/\.claude'
block '/opt\b'
block 'printenv|/proc/.*/environ'
block '/audit\b'
block '\bcurl\b.*\b(credentials|\.claude)\b'
block '\bsocat\b.*\b(credentials|\.claude)\b'
block '\bgh\b.*--web\b'

exit 0
