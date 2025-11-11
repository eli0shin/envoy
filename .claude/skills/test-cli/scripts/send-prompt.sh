#!/bin/bash
# Send text to CLI character-by-character (useful for testing autocomplete, validation, etc.)
# Usage: ./send-prompt.sh PANE_ID "text to send" [--submit]
# Use --submit flag to press Enter after sending the text

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 PANE_ID TEXT [--submit]"
  exit 1
fi

PANE_ID=$1
TEXT=$2
SUBMIT=${3:-""}

# Send each character individually
for (( i=0; i<${#TEXT}; i++ )); do
  char="${TEXT:$i:1}"
  tmux send-keys -t "$PANE_ID" "$char"
done

# Optionally submit by pressing Enter
if [ "$SUBMIT" = "--submit" ]; then
  tmux send-keys -t "$PANE_ID" Enter
fi
