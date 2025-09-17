import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function fuzzyGitSearch(pattern: string): Promise<string[]> {
  if (!pattern) {
    // Just @ alone - show files in current directory from git
    try {
      const { stdout } = await execAsync('git ls-files | head -10');
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  // Direct fzf pipeline - no pre-listing
  try {
    const { stdout } = await execAsync(
      `git ls-files | fzf --filter="${pattern}" --exact | head -10`
    );
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback if fzf not available - simple grep
    try {
      const { stdout } = await execAsync(
        `git ls-files | grep -i "${pattern}" | head -10`
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

export async function browseDirectory(pattern: string): Promise<string[]> {
  const lastSlash = pattern.lastIndexOf('/');
  const dir = pattern.slice(0, lastSlash + 1) || './';
  const filePrefix = pattern.slice(lastSlash + 1);

  try {
    const entries = await fs.readdir(path.resolve(dir), {
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.name.startsWith(filePrefix))
      .slice(0, 10)
      .map((entry) => {
        const relativePath = path.join(dir, entry.name);
        return entry.isDirectory() ? `${relativePath}/` : relativePath;
      });
  } catch {
    return []; // Directory doesn't exist or not accessible
  }
}
