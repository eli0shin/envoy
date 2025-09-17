To improve the UX of tool calls we want to improve the way they are formatted.
every tool call has an assistant message that represents the tool call and a tool-result message which contains the tool result.
We want to take the tool name like `filesystem_read_file` and replace the `_` with spaces then uppercase the first letter of each word.

when we encounter a tool call message while rendering we should look forward in the array until we find the tool result. if not tool result is found we render it as pending using the format below.
if we do find the result we look whether is is success or error and render the result or error using the formats below.

## Pending

Filesystem Read File (
path: docs/tool-call-format.md
offset: 10
)

## Success

Filesystem Read File (
path: docs/tool-call-format.md
offset: 10
)
|- Result: import { ToolCallFormat } from "../src/ToolCallFormat.ts"...

## Error

Filesystem Read File (
path: docs/tool-call-format.md
offset: 10
)
|- Error: ENOENT: no such file or directory, open 'docs/tool-call-format.md'

## Alternative Style 1: Inline Compact

Best for simple tool calls with few arguments

### Pending

`Filesystem Read File` (path: docs/tool-call-format.md, offset: 10) [pending...]

### Success

`Filesystem Read File` (path: docs/tool-call-format.md, offset: 10) → import { ToolCallFormat }...

### Error

`Filesystem Read File` (path: docs/tool-call-format.md, offset: 10) ✗ ENOENT: no such file...

## Alternative Style 2: Box Drawing

Using Unicode box characters for structured appearance

### Pending

┌─ Filesystem Read File ─────────────────────────┐
│ path: docs/tool-call-format.md │
│ offset: 10 │
└─ Status: Pending... ┘

### Success

┌─ Filesystem Read File ─────────────────────────┐
│ path: docs/tool-call-format.md │
│ offset: 10 │
├─────────────────────────────────────────────────┤
│ ✓ Result: import { ToolCallFormat } from... │
└─────────────────────────────────────────────────┘

### Error

┌─ Filesystem Read File ─────────────────────────┐
│ path: docs/tool-call-format.md │
│ offset: 10 │
├─────────────────────────────────────────────────┤
│ ✗ Error: ENOENT: no such file or directory... │
└─────────────────────────────────────────────────┘

## Alternative Style 3: Markdown Table

Arguments displayed as a table

### Pending

**Filesystem Read File** ⏳
| Argument | Value |
|----------|-------|
| path | docs/tool-call-format.md |
| offset | 10 |

### Success

**Filesystem Read File** ✅
| Argument | Value |
|----------|-------|
| path | docs/tool-call-format.md |
| offset | 10 |

**Result:** import { ToolCallFormat } from "../src/ToolCallFormat.ts"...

### Error

**Filesystem Read File** ❌
| Argument | Value |
|----------|-------|
| path | docs/tool-call-format.md |
| offset | 10 |

**Error:** ENOENT: no such file or directory, open 'docs/tool-call-format.md'

## Alternative Style 4: Status Icons

Minimal with clear status indicators

### Pending

⏳ **Filesystem Read File**
• path: docs/tool-call-format.md
• offset: 10

### Success

✅ **Filesystem Read File**
• path: docs/tool-call-format.md
• offset: 10
↳ import { ToolCallFormat } from "../src/ToolCallFormat.ts"...

### Error

❌ **Filesystem Read File**
• path: docs/tool-call-format.md
• offset: 10
↳ ENOENT: no such file or directory, open 'docs/tool-call-format.md'

## Alternative Style 5: Verbose/Debug

Including metadata for debugging

### Pending

[Tool Call #call_123] Filesystem Read File
Started: 2024-01-15 10:30:45.123
Arguments:

- path: docs/tool-call-format.md
- offset: 10
  Status: PENDING (awaiting response...)

### Success

[Tool Call #call_123] Filesystem Read File
Started: 2024-01-15 10:30:45.123
Completed: 2024-01-15 10:30:45.456 (333ms)
Arguments:

- path: docs/tool-call-format.md
- offset: 10
  Status: SUCCESS
  Output: import { ToolCallFormat } from "../src/ToolCallFormat.ts"...

### Error

[Tool Call #call_123] Filesystem Read File
Started: 2024-01-15 10:30:45.123
Failed: 2024-01-15 10:30:45.456 (333ms)
Arguments:

- path: docs/tool-call-format.md
- offset: 10
  Status: ERROR
  Error: ENOENT: no such file or directory, open 'docs/tool-call-format.md'
