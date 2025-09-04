[x] - fix markdown rendering, including code blocks
[x] - include thinking
[x] - trigger thinking like claude code
[x] - handle tool call timeouts and mcp failed to connect errors gracefully. right now the whole agent crashes
[x] - accept api keys as env variables of through other config resolution in validateEnviroment
[x] - use ink-syntax-highlight for code rendering. implement code rendering for all output including files
[x] - when multiple tools are called in parrallel the second one to finish shows currently until the call completes then it is overwritten with the details of the first one to complete. probably a problem eith state management of in-progress tool calls and streaming. start by removing the instruction to only call 1 tool at a time from the system prompt and then test.
[x] - fix the /clear command. we can't set messages to [] because the reference is lost and static messages require that we keep a static reference to the messages array.
[x] - ability to disable tools from mcp servers or whole mcp server in the config file and constants file
[x] - persist conversation history step by step by session id in project namespaced directories and enable resume
[x] - Clean up mcp servers when process exits, currently they hang around as ghost processes
[x] - Use ink-testing-library to write proper ui tests
[x] - fix tool result messages showing after the user sends a new message
[x] - support autocomplete of built in commands and their arguments in ink ui
[x] - support invoking prompts as commands in ink ui
[ ] - support including resources with @ in ink ui
[x] - support including files with @ in ink ui
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
