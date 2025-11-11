#!/bin/bash
# Kill all CLI test sessions
# Usage: ./cleanup-cli-tests.sh [pattern]
# If pattern is provided, only kills sessions matching that pattern
# Default pattern is "cli-test-*"

PATTERN=${1:-"cli-test-*"}

# Get list of sessions matching the pattern
SESSIONS=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -E "^${PATTERN/\*/.*}$" || true)

if [ -z "$SESSIONS" ]; then
  echo "No test sessions found matching pattern: $PATTERN"
  exit 0
fi

# Kill each matching session
echo "Killing test sessions:"
echo "$SESSIONS" | while read -r session; do
  echo "  - $session"
  tmux kill-session -t "$session"
done

echo "Cleanup complete"
