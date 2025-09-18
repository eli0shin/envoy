import { fg, bold } from '@opentui/core';
import { error, success, filePath as filePathColor, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { BraveSearchBraveWebSearchArgs } from '../../toolTypes.js';

export function WebSearchToolMessage({
  args,
  result,
  isError,
}: ToolMessageComponentProps) {
  // Extract query from args
  const typedArgs = args as BraveSearchBraveWebSearchArgs;
  const query = typedArgs?.query || '';

  // Count the number of search results by splitting on double newlines
  const getResultCount = () => {
    if (
      !result ||
      isError ||
      typeof result !== 'object' ||
      result === null ||
      !('result' in result)
    ) {
      return 0;
    }

    const resultText = (result as { result: string }).result;
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
        {bold(fg(lightGray)('Web Search'))}
        {fg(filePathColor)(`(${query})`)}
      </text>
      {!isError && result ?
        <text paddingLeft={2}>
          {fg(success)(`└ Found ${resultCount} results`)}
        </text>
      : null}
      {isError ?
        <text paddingLeft={2}>{fg(error)(`${String(result)}`)}</text>
      : null}
    </box>
  );
}
