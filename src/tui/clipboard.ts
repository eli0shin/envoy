import clipboardy from 'clipboardy';

/**
 * Copy text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  await clipboardy.write(text);
}

/**
 * Read text from the system clipboard
 */
export async function pasteFromClipboard(): Promise<string> {
  return await clipboardy.read();
}
