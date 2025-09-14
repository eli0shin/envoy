/**
 * Input handling utilities
 * Handles stdin reading and message validation functionality
 */

/**
 * Reads input from stdin
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = '';

    process.stdin.setEncoding('utf8');

    // Handle case where no input is provided
    const timeout = setTimeout(() => {
      if (input === '') {
        reject(new Error('No input provided via stdin'));
      }
    }, 1000);

    process.stdin.on('data', (chunk) => {
      input += chunk;
      clearTimeout(timeout);
    });

    process.stdin.on('end', () => {
      resolve(input.trim());
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Validates that a message is non-empty and meaningful
 */
export function validateMessage(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return message.trim().length > 0;
}
