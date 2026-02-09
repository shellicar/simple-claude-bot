#!/bin/sh
INPUT=$(cat)

block() {
  echo "$INPUT" | grep -qiE "$1" && { echo "denied" >&2; exit 2; }
}

block '\.credentials'
block '/home/bot/\.claude'
block 'printenv|/proc/.*/environ'
block '\bcurl\b.*\b(credentials|\.claude)\b'
block '\bsocat\b.*\b(credentials|\.claude)\b'

exit 0
