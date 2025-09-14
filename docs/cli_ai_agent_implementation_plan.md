# Implementation Plan — CLI Multi‑Model Agent

_Vercel AI SDK 4.2 + Model Context Protocol (MCP)_

> **Scope & audience**  
> This document is a prescriptive build plan for a _single‑turn_ command‑line agent that can call remote MCP tools.  
> It is aimed at engineers who are unfamiliar with the AI SDK or MCP but comfortable with modern TypeScript and Node ≥ 18.

---

## 1 Overview

The function will:

1. Accept **one user message** via CLI argument or `stdin`.
2. Load two **compile‑time constants**:

   | Constant        | Purpose                                                |
   | --------------- | ------------------------------------------------------ |
   | `SYSTEM_PROMPT` | Defines assistant persona & operating guidelines.      |
   | `MCP_SERVERS`   | Array describing **stdio** and/or **SSE** MCP servers. |

3. Create an MCP client per server, _merge_ all exposed tools, and wrap each tool in a **logger** that writes

   ```
   [tool-call] <name> <JSONStringified‑args>
   ```

   to `stdout` the moment the model selects the tool.

4. Invoke `generateText()` (Vercel AI SDK) with `maxSteps > 1`.
   - The SDK automatically:
     - Loops: assistant → tool‑call → assistant … until no further tool calls.
     - Validates tool arguments against JSON schemas.
   - An `onStepFinish` callback prints any assistant text of the **current step** immediately:
     ```
     [assistant-step] <step text>
     ```

5. When the final step contains _no_ `toolCalls[]`, the run ends and the full assistant message prints as
   ```
   [assistant] <final text>
   ```

---

## 2 Prerequisites & Dependencies

| Package                    | Reason                                                   |
| -------------------------- | -------------------------------------------------------- |
| `ai@^4.2`                  | Core SDK (provider abstraction, tool loop, MCP helpers). |
| `@ai-sdk/openai` (or alt.) | Primary model provider (runtime‑switchable).             |
| `ai/mcp-stdio`             | Stdio transport for local MCP servers.                   |
| `zod`                      | Required peer dependency for tool schemas.               |
| Node 20 +                  | Native `fetch` + Web Streams.                            |

> **Key management**: Provider API keys are read from environment variables (`OPENAI_API_KEY`, etc.) via a `.env` loader.

---

## 3 Module Breakdown

| File               | Responsibility                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **`constants.ts`** | Exposes `SYSTEM_PROMPT` (string) and `MCP_SERVERS` (readonly array).                                                         |
| **`mcpLoader.ts`** | Builds MCP clients; returns merged _wrapped_ tool map ready for AI SDK.                                                      |
| **`agent.ts`**     | Orchestrator: accepts user input, loads tools, calls `generateText`, handles callbacks, prints output, propagates exit code. |
| **`cli.ts`**       | Thin bin wrapper (argument parsing, stdin fallback, `agent.run()`).                                                          |
| **`test/*`**       | Unit, integration, and E2E test suites.                                                                                      |

> **No persistent state** is required; each invocation is stateless.

---

## 4 Control Flow (Sequential)

1. **Input acquisition** – Read message.
2. **Tool assembly**
   1. Iterate `MCP_SERVERS`.
   2. Configure transport (`Experimental_StdioMCPTransport` _or_ `{type:'sse',…}`).
   3. `experimental_createMCPClient()` → `await client.tools()`.
   4. For each tool:
      - Clone metadata.
      - Replace `execute` with wrapper that logs and (optionally) forwards to `original.execute`.
3. **Conversation loop**
   - Call `generateText({ system, messages:[{role:'user',content:msg}], tools, maxSteps:10, onStepFinish })`.
   - **`onStepFinish`** prints `[assistant-step]` text (if any).
   - Wrapper prints `[tool-call]` lines during execution.
4. **Termination** – When last step contains zero tool calls, print `[assistant] …` and exit `0`.
5. **Error handling** – Uncaught exceptions print to `stderr` and exit `1`; individual tool timeouts return stub error objects to the model so the loop can proceed.

---

## 5 Standard Output Contract

| Event                        | Example line                                |
| ---------------------------- | ------------------------------------------- |
| Assistant text inside a step | `[assistant-step] Let me fetch that…`       |
| Tool invocation              | `[tool-call] getInvoices {"minTotal":1000}` |
| Final assistant answer       | `[assistant] • Invoice summary…`            |

Down‑stream scripts can parse these markers if automation is required.

---

## 6 Testing Strategy

1. **Unit**
   - Mock MCP client; assert wrapper logging & argument forwarding.
   - Validate that `onStepFinish` prints assistant text.
2. **Integration**
   - Local echo MCP server (stdio); check merged tools & stdout sequence.
3. **E2E**
   - Run full CLI against public SSE weather‑tool; ensure correct narrative & calls; enforce ≤ `maxSteps` invocations.

---

## 7 Operational Considerations

- **Timeouts** – 30 s per tool call; surfaced to model as `{error:'timeout'}`.
- **Parallelism** – Serial execution is adequate; SDK will await each tool’s Promise.
- **Extensibility** – Future flags could enable:
  - `--stream` → switch to `streamText` for token‑level streaming.
  - `--provider gpt-4o|claude-3` → runtime model switch.
  - `--json` → emit machine‑readable output instead of annotated text.

---

## 8 Delivery Checklist

- [ ] `constants.ts` with sample prompt + dummy server list
- [ ] `mcpLoader.ts` (tool aggregation & wrapping)
- [ ] `agent.ts` (orchestrator w/ onStepFinish)
- [ ] `cli.ts` bin entry (`#!/usr/bin/env node`)
- [ ] Jest + Vitest configs and test cases
- [ ] `README.md` quick‑start instructions

---

_Document generated 2025-05-31._
