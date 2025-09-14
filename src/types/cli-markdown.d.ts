declare module 'cli-markdown' {
  function cliMarkdown(markdown: string, options?: { theme?: string }): string;
  export = cliMarkdown;
}
