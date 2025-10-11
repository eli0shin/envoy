import { useState, useCallback } from 'react';

type UseMessageHistoryOptions = {
  currentValue: string;
  onChange: (value: string) => void;
  onQueuePop?: () => string | null;
  queuedMessagesCount?: number;
};

export function useMessageHistory({
  currentValue,
  onChange,
  onQueuePop,
  queuedMessagesCount = 0,
}: UseMessageHistoryOptions) {
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');

  const navigate = useCallback(
    (
      direction: 'up' | 'down',
      userHistory: string[],
      shouldHandleHistory: boolean
    ): boolean => {
      if (
        direction === 'up' &&
        (historyIndex === -1 ? shouldHandleHistory : true)
      ) {
        // Check for queued messages first when on first line
        if (
          historyIndex === -1 &&
          shouldHandleHistory &&
          queuedMessagesCount > 0 &&
          onQueuePop
        ) {
          const queuedContent = onQueuePop();
          if (queuedContent) {
            onChange(queuedContent);
            return true;
          }
        }

        // Save original input when first entering history mode
        if (historyIndex === -1) {
          setOriginalInput(currentValue);
        }

        const newIndex = historyIndex + 1;
        if (newIndex < userHistory.length) {
          const messageToLoad = userHistory[userHistory.length - 1 - newIndex];
          onChange(messageToLoad);
          setHistoryIndex(newIndex);
          return true;
        }
      } else if (direction === 'down' && historyIndex >= 0 && shouldHandleHistory) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);

        if (newIndex >= 0) {
          onChange(userHistory[userHistory.length - 1 - newIndex]);
        } else {
          onChange(originalInput);
        }
        return true;
      }

      return false;
    },
    [
      historyIndex,
      currentValue,
      queuedMessagesCount,
      onQueuePop,
      onChange,
      originalInput,
    ]
  );

  const reset = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalInput('');
  }, []);

  return {
    historyIndex,
    navigate,
    reset,
  };
}
