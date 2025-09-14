declare module 'marked-terminal' {
  import { Renderer } from 'marked';

  type TerminalRendererOptions = {
    code?: (text: string) => string;
    blockquote?: (text: string) => string;
    html?: (text: string) => string;
    heading?: (text: string) => string;
    hr?: (text: string) => string;
    listitem?: (text: string) => string;
    paragraph?: (text: string) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (text: string) => string;
    del?: (text: string) => string;
    link?: (text: string) => string;
    width?: number;
    showSectionPrefix?: boolean;
    reflowText?: boolean;
    tab?: number | string;
    emoji?: boolean;
    unescape?: boolean;
  };

  type HighlightOptions = {
    theme?: string;
  };

  export default class TerminalRenderer extends Renderer {
    constructor(
      options?: TerminalRendererOptions,
      highlightOptions?: HighlightOptions
    );
  }

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: HighlightOptions
  ): {
    renderer: Record<string, unknown>;
    useNewRenderer: boolean;
  };
}
