#!/bin/bash
# Properly exit the CLI by sending two Ctrl+C within 3 seconds
# Usage: ./exit-cli-test.sh PANE_ID

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 PANE_ID"
  exit 1
fi

PANE_ID=$1

# Send first Ctrl+C
tmux send-keys -t "$PANE_ID" C-c

# Wait 0.5 seconds
sleep 0.5

# Send second Ctrl+C
tmux send-keys -t "$PANE_ID" C-c

# Wait to ensure CLI exits
sleep 0.5
