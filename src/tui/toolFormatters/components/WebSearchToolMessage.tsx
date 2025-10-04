import { error, success, filePath as filePathColor, lightGray } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { BraveSearchBraveWebSearchArgs } from '../../toolTypes.js';

export function WebSearchToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract query from args
  const typedArgs = args as BraveSearchBraveWebSearchArgs;
  const query = typedArgs?.query || '';

  // Count the number of search results by splitting on double newlines
  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  const getResultCount = () => {
    if (!successText || isError) {
      return 0;
    }

    const resultText = successText;
    // Split by double newlines (empty lines between results)
    const results = resultText
      .split('\n\n')
      .filter((section) => section.trim());
    return results.length;
  };

  const resultCount = getResultCount();

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Web Search</span></b>
        <span fg={filePathColor}>({query})</span>
      </text>
      {!isError && successText ?
        <text paddingLeft={2}>
          <span fg={success}>└ Found {resultCount} results</span>
        </text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}><span fg={error}>{errorText}</span></text>
      : null}
    </box>
  );
}
