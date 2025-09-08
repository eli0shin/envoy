[x] - fix markdown rendering, including code blocks
[x] - include thinking
[x] - trigger thinking like claude code
[x] - handle tool call timeouts and mcp failed to connect errors gracefully. right now the whole agent crashes
[x] - accept api keys as env variables of through other config resolution in validateEnviroment
[x] - ability to disable tools from mcp servers or whole mcp server in the config file and constants file
[x] - persist conversation history step by step by session id in project namespaced directories and enable resume
[x] - Clean up mcp servers when process exits, currently they hang around as ghost processes
[ ] - support autocomplete of built in commands and their arguments in OpenTUI ui
[ ] - support invoking prompts as commands in OpenTUI ui
[ ] - support including resources with @ in OpenTUI ui
[ ] - support including files with @ in OpenTUI ui
[ ] - Simplify configuration. Few CLI flags, fewer env variables. full config only in config file
[ ] - ability to interrupt the agent loop
[ ] - basic tool permissions prompts
[ ] - ability to set allowed disallowed tools in config
[ ] - ability to go back in conversation history, will require generating a new session id and writing all of the messages to the new session file
[ ] - fix the agent tool prompts
[ ] - fix the todo tool prompts
[ ] - write a proper search tool with rg and fzf
[ ] - write a proper edit tool
[ ] - custom agents - config files that setup use-cases and tools
[ ] - subagents can be custom agents, show as their own tools
[ ] - conversation history web pages
[ ] - better user level config
[ ] - Include token usage by type in /history command
