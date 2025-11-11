#!/bin/bash
# Start a new CLI test session in tmux
# Usage: ./start-cli-test.sh [session-name]
# Outputs: The pane ID to use for sending commands

set -e

SESSION_NAME=${1:-"cli-test-$$"}

# Create new detached tmux session
tmux new-session -d -s "$SESSION_NAME"

# Get the pane ID
PANE_ID=$(tmux list-panes -t "$SESSION_NAME" -F '#{pane_id}')

# Launch the CLI
tmux send-keys -t "$PANE_ID" 'npx .' Enter

# Wait for CLI to start
sleep 1

# Output the pane ID for use in subsequent commands
echo "$PANE_ID"
