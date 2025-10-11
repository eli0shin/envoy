import { useRef, useEffect } from 'react';
import { useKeys, parseKeys } from '../keys/index.js';
import type { ScrollBoxRenderable } from '@opentui/core';
import type { KeyScope } from '../keys/types.js';

type UseScrollBoxOptions = {
  autoScrollOnChange?: boolean;
  scrollDependencies?: unknown[];
  keybindingsScope?: KeyScope;
  enableKeybindings?: boolean;
};

export function useScrollBox({
  autoScrollOnChange = true,
  scrollDependencies = [],
  keybindingsScope = 'messages',
  enableKeybindings = true,
}: UseScrollBoxOptions = {}) {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  const scrollToBottom = () => {
    if (scrollBoxRef.current) {
      const maxScrollTop =
        scrollBoxRef.current.scrollHeight -
        scrollBoxRef.current.viewport.height;
      scrollBoxRef.current.scrollTop = Math.max(0, maxScrollTop);
    }
  };

  const scrollBy = (delta: number) => {
    if (!scrollBoxRef.current) return;
    const maxScrollTop =
      scrollBoxRef.current.scrollHeight - scrollBoxRef.current.viewport.height;
    scrollBoxRef.current.scrollTop = Math.max(
      0,
      Math.min(maxScrollTop, scrollBoxRef.current.scrollTop + delta)
    );
  };

  const scrollPage = (direction: 1 | -1) => {
    if (!scrollBoxRef.current) return;
    const page = Math.max(
      1,
      Math.floor(scrollBoxRef.current.viewport.height * 0.9)
    );
    scrollBy(direction * page);
  };

  const scrollTop = () => {
    if (!scrollBoxRef.current) return;
    scrollBoxRef.current.scrollTop = 0;
  };

  const scrollBottom = () => {
    scrollToBottom();
  };

  // Auto-scroll to bottom when dependencies change
  useEffect(() => {
    if (autoScrollOnChange) {
      setImmediate(() => {
        scrollToBottom();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, scrollDependencies);

  // Keybindings for scrolling
  useKeys(
    (key) => {
      if (!enableKeybindings) return false;
      return (
        parseKeys(
          key,
          'messages.scrollPageUp',
          () => scrollPage(-1),
          keybindingsScope
        ) ||
        parseKeys(
          key,
          'messages.scrollPageDown',
          () => scrollPage(1),
          keybindingsScope
        ) ||
        parseKeys(
          key,
          'messages.scrollTop',
          () => scrollTop(),
          keybindingsScope
        ) ||
        parseKeys(
          key,
          'messages.scrollBottom',
          () => scrollBottom(),
          keybindingsScope
        )
      );
    },
    { scope: keybindingsScope, enabled: enableKeybindings }
  );

  return {
    scrollBoxRef,
    scrollBy,
    scrollPage,
    scrollTop,
    scrollBottom,
    scrollToBottom,
  };
}
