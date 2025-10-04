/**
 * Utility functions for formatting tool calls and results in the TUI
 */

/**
 * Convert snake_case tool names to Title Case
 * @param toolName - The snake_case tool name (e.g., "filesystem_read_file")
 * @returns Formatted tool name (e.g., "Filesystem Read File")
 */
export function formatToolName(toolName: string): string {
  return toolName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate a string to a maximum length with ellipsis
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default 50)
 * @returns Truncated string with "..." if needed
 */
export function truncateValue(str: string, maxLength: number = 50): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format tool arguments as key-value pairs on a single line
 * @param args - The tool arguments object
 * @returns Formatted string with args on one line
 */
export function formatToolArgs(args: unknown): string {
  // Handle pre-stringified arguments (e.g., "[Object object]")
  if (typeof args === 'string') {
    // If it looks like a stringified object, try to indicate that
    if (args === '[object Object]' || args === '[Object object]') {
      return '{malformed object}';
    }
    // Otherwise return the string as-is
    return args;
  }

  if (!args || typeof args !== 'object') {
    return '';
  }

  try {
    const entries = Object.entries(args);
    if (entries.length === 0) {
      return '';
    }

    return entries
      .map(([key, value]) => {
        let valueStr = '';
        if (typeof value === 'string') {
          valueStr = value;
        } else if (value === null || value === undefined) {
          valueStr = String(value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          valueStr = String(value);
        } else if (Array.isArray(value)) {
          // Handle arrays with proper serialization of objects
          valueStr = `[${value
            .map((item) => {
              if (item === null) return 'null';
              if (item === undefined) return 'undefined';
              if (typeof item === 'object') {
                try {
                  return JSON.stringify(item);
                } catch {
                  return '{object}';
                }
              }
              return String(item);
            })
            .join(', ')}]`;
        } else if (typeof value === 'object') {
          try {
            const jsonStr = JSON.stringify(value);
            // If JSON.stringify returns undefined or fails, fall back to a safe representation
            valueStr = jsonStr !== undefined ? jsonStr : '{object}';
          } catch {
            valueStr = '{object}';
          }
        } else {
          valueStr = String(value);
        }
        return `${key}: ${truncateValue(valueStr)}`;
      })
      .join(', ');
  } catch {
    // If Object.entries fails or any other error occurs, return a safe fallback
    return '{invalid args}';
  }
}

/**
 * Extract text content from tool result
 * @param result - The tool result content
 * @returns Text content or empty string
 */
export function extractResultText(result: unknown): string {
  if (result === null || result === undefined) {
    return '';
  }

  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'number' || typeof result === 'boolean') {
    return String(result);
  }

  if (Array.isArray(result)) {
    const textParts: string[] = [];
    for (const item of result) {
      if (item === null || item === undefined) continue;

      if (typeof item === 'string' || typeof item === 'number') {
        textParts.push(String(item));
        continue;
      }

      if (typeof item === 'object' && 'type' in item) {
        if (item.type === 'text' && 'text' in item) {
          textParts.push(String(item.text));
          continue;
        }
        if (item.type === 'reasoning' && 'text' in item) {
          textParts.push(String(item.text));
          continue;
        }
      }

      const nested = extractResultText(item);
      if (nested) {
        textParts.push(nested);
      }
    }
    return textParts.join(' ');
  }

  if (result && typeof result === 'object') {
    // Handle objects with 'result' property (common MCP tool response format)
    if ('output' in result) {
      const outputValue = (result as { output?: unknown }).output;
      const outputText = extractResultText(outputValue);
      if (outputText !== undefined && outputText !== null) return outputText;
    }

    if ('result' in result) {
      // Recursively extract from nested result
      return extractResultText((result as { result: unknown }).result);
    }
    // Handle objects with 'text' property
    if ('text' in result) {
      return extractResultText((result as { text: unknown }).text);
    }

    if ('message' in result) {
      return extractResultText((result as { message: unknown }).message);
    }

    if ('error' in result) {
      return extractResultText((result as { error: unknown }).error);
    }

    if ('content' in result) {
      return extractResultText((result as { content: unknown }).content);
    }

    if ('value' in result) {
      const valueText = extractResultText((result as { value: unknown }).value);
      if (valueText !== undefined && valueText !== null) return valueText;
    }

    try {
      const json = JSON.stringify(result);
      return json || '';
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Format multiline content with consistent indentation
 * Adds a prefix to the first line and proper spacing to subsequent lines
 * @param content - The content to format (may contain newlines)
 * @param prefix - The prefix for the first line (e.g., "└ ")
 * @returns Formatted content with proper indentation for all lines
 */
export function formatMultilineResult(
  content: string,
  prefix: string = '└ '
): string {
  if (!content) return '';

  const lines = content.split('\n');

  // The prefix is 2 characters wide ("└ "), so subsequent lines need 2 spaces
  const indent = '  ';

  return lines
    .map((line, index) => {
      if (index === 0) {
        return prefix + line;
      }
      return indent + line;
    })
    .join('\n');
}

/**
 * Strip the current working directory from a file path if present
 * @param filePath - The absolute or relative file path
 * @returns Path relative to cwd or original path if not in cwd
 */
export function stripCwd(filePath: string): string {
  const cwd = process.cwd();

  // If the path starts with the cwd, remove it
  if (filePath.startsWith(cwd)) {
    // Remove cwd and leading slash
    const relative = filePath.substring(cwd.length);
    return relative.startsWith('/') ? relative.substring(1) : relative;
  }

  return filePath;
}

export type ToolCallState = 'pending' | 'success' | 'error';

export type FormattedToolCall = {
  formattedName: string;
  formattedArgs: string;
  state: ToolCallState;
  resultText?: string;
  errorText?: string;
};

/**
 * Format a complete tool call with optional result
 * @param toolName - The tool name
 * @param args - The tool arguments
 * @param result - Optional tool result
 * @param isError - Whether the result is an error
 * @returns Formatted tool call structure
 */
export function formatToolCall(
  toolName: string,
  args: unknown,
  result?: unknown,
  isError?: boolean
): FormattedToolCall {
  const formattedName = formatToolName(toolName);
  const formattedArgs = formatToolArgs(args);

  if (!result) {
    return {
      formattedName,
      formattedArgs,
      state: 'pending',
    };
  }

  if (isError) {
    const errorText = extractResultText(result);
    return {
      formattedName,
      formattedArgs,
      state: 'error',
      errorText: truncateValue(errorText),
    };
  }

  const resultText = extractResultText(result);
  return {
    formattedName,
    formattedArgs,
    state: 'success',
    resultText: truncateValue(resultText),
  };
}

/**
 * Render a formatted tool call as a string
 * @param formatted - The formatted tool call structure
 * @returns Multi-line string representation
 */
export function renderToolCall(formatted: FormattedToolCall): string {
  let output = `**${formatted.formattedName}**`;

  if (formatted.formattedArgs) {
    output += ` (${formatted.formattedArgs})`;
  } else {
    output += ' ()';
  }

  // Add result line if not pending
  if (formatted.state === 'success' && formatted.resultText) {
    output += `\n└ Result: ${formatted.resultText}`;
  } else if (formatted.state === 'error' && formatted.errorText) {
    output += `\n└ Error: ${formatted.errorText}`;
  }

  return output;
}

/**
 * Render a formatted tool call with error styling markers
 * @param formatted - The formatted tool call structure
 * @returns Multi-line string with error markers for styling
 */
export function renderToolCallWithErrorMarkers(
  formatted: FormattedToolCall
): string {
  let output = `**${formatted.formattedName}**`;

  if (formatted.formattedArgs) {
    output += ` (${formatted.formattedArgs})`;
  } else {
    output += ' ()';
  }

  // Add result line if not pending
  if (formatted.state === 'success' && formatted.resultText) {
    output += `\n└ Result: ${formatted.resultText}`;
  } else if (formatted.state === 'error' && formatted.errorText) {
    // Add error marker that will be detected by theme formatting
    output += `\n[ERROR]└ Error: ${formatted.errorText}`;
  }

  return output;
}
