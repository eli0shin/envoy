/**
 * Tests for files.ts module
 * Tests file system operations for configuration loading
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getConfigFilePaths,
  loadConfigFile,
  loadSystemPromptFile,
  isFilePath,
} from './files.js';
import type { Configuration } from './types.js';

// Mock dependencies
vi.mock('../shared/fileOperations.js', () => ({
  readJsonFile: vi.fn(),
  handleFileError: vi.fn(
    (error, operation, path) =>
      new Error(`${operation} failed for ${path}: ${error.message}`)
  ),
  getUserConfigPath: vi.fn(filename => `/mock/home/.config/envoy/${filename}`),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Mock process.cwd()
const mockCwd = '/mock/project';
vi.stubGlobal('process', {
  ...process,
  cwd: vi.fn(() => mockCwd),
});

import { readJsonFile, handleFileError } from '../shared/fileOperations.js';
import { readFile } from 'fs/promises';

describe('files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfigFilePaths', () => {
    it('should return config file paths in order of precedence', () => {
      const paths = getConfigFilePaths();

      expect(paths).toEqual([
        '/mock/project/.envoy.json', // Project level (highest precedence)
        '/mock/home/.config/envoy/config.json', // User level (getUserConfigPath)
        '/mock/home/.envoy.json', // User level (homedir)
      ]);
    });

    it('should use current working directory for project level config', () => {
      const paths = getConfigFilePaths();
      expect(paths[0]).toBe('/mock/project/.envoy.json');
    });

    it('should include user config directory path', () => {
      const paths = getConfigFilePaths();
      expect(paths[1]).toBe('/mock/home/.config/envoy/config.json');
    });

    it('should include home directory path', () => {
      const paths = getConfigFilePaths();
      expect(paths[2]).toBe('/mock/home/.envoy.json');
    });

    it('should return array with 3 paths', () => {
      const paths = getConfigFilePaths();
      expect(paths).toHaveLength(3);
    });
  });

  describe('loadConfigFile', () => {
    it('should load and validate configuration file', async () => {
      const mockConfig: Configuration = {
        providers: {
          default: 'anthropic',
        },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockConfig);

      const result = await loadConfigFile('/path/to/config.json');

      expect(result.config).toEqual(mockConfig);
      expect(result.error).toBeUndefined();
      expect(readJsonFile).toHaveBeenCalledWith(
        '/path/to/config.json',
        expect.any(Function)
      );
    });

    it('should return empty object when file does not exist', async () => {
      vi.mocked(readJsonFile).mockResolvedValue(null);

      const result = await loadConfigFile('/path/to/nonexistent.json');

      expect(result.config).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error when validation fails', async () => {
      const mockConfig = { invalid: 'config' };

      vi.mocked(readJsonFile).mockImplementation(async (path, validator) => {
        if (validator) {
          validator(mockConfig);
        }
        return mockConfig as Configuration;
      });

      const result = await loadConfigFile('/path/to/invalid.json');

      expect(result.config).toBeUndefined();
      expect(result.error).toContain(
        "Invalid configuration in /path/to/invalid.json: root: Unrecognized key(s) in object: 'invalid'"
      );
    });

    it('should return error when readJsonFile throws', async () => {
      vi.mocked(readJsonFile).mockRejectedValue(new Error('File read error'));

      const result = await loadConfigFile('/path/to/error.json');

      expect(result.config).toBeUndefined();
      expect(result.error).toBe('File read error');
    });

    it('should handle unknown errors', async () => {
      vi.mocked(readJsonFile).mockRejectedValue('string error');

      const result = await loadConfigFile('/path/to/error.json');

      expect(result.config).toBeUndefined();
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('loadSystemPromptFile', () => {
    it('should load system prompt file content', async () => {
      const mockContent = 'You are a helpful assistant.\nPlease be concise.';
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await loadSystemPromptFile('prompt.txt');

      expect(result).toBe('You are a helpful assistant.\nPlease be concise.');
      expect(readFile).toHaveBeenCalledWith(
        '/mock/project/prompt.txt',
        'utf-8'
      );
    });

    it('should expand environment variables in file path', async () => {
      process.env.PROMPT_DIR = '/custom/prompts';
      const mockContent = 'System prompt content';
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await loadSystemPromptFile('${PROMPT_DIR}/system.txt');

      expect(result).toBe('System prompt content');
      expect(readFile).toHaveBeenCalledWith(
        '/custom/prompts/system.txt',
        'utf-8'
      );

      delete process.env.PROMPT_DIR;
    });

    it('should resolve relative paths from current working directory', async () => {
      const mockContent = 'Relative path content';
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await loadSystemPromptFile('./prompts/system.txt');

      expect(result).toBe('Relative path content');
      expect(readFile).toHaveBeenCalledWith(
        '/mock/project/prompts/system.txt',
        'utf-8'
      );
    });

    it('should trim whitespace from file content', async () => {
      const mockContent = '  \n  System prompt with whitespace  \n  ';
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await loadSystemPromptFile('prompt.txt');

      expect(result).toBe('System prompt with whitespace');
    });

    it('should throw error when file cannot be read', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      vi.mocked(readFile).mockRejectedValue(fileError);
      vi.mocked(handleFileError).mockReturnValue(
        new Error(
          'load system prompt file failed for prompt.txt: ENOENT: no such file or directory'
        )
      );

      await expect(loadSystemPromptFile('prompt.txt')).rejects.toThrow(
        'load system prompt file failed for prompt.txt: ENOENT: no such file or directory'
      );

      expect(handleFileError).toHaveBeenCalledWith(
        fileError,
        'load system prompt file',
        'prompt.txt'
      );
    });

    it('should handle absolute paths', async () => {
      const mockContent = 'Absolute path content';
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await loadSystemPromptFile('/absolute/path/prompt.txt');

      expect(result).toBe('Absolute path content');
      expect(readFile).toHaveBeenCalledWith(
        '/absolute/path/prompt.txt',
        'utf-8'
      );
    });

    it('should preserve environment variables that do not exist', async () => {
      const mockContent = 'Missing env var content';
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await loadSystemPromptFile('${MISSING_VAR}/prompt.txt');

      expect(result).toBe('Missing env var content');
      expect(readFile).toHaveBeenCalledWith(
        '/mock/project/${MISSING_VAR}/prompt.txt',
        'utf-8'
      );
    });
  });

  describe('isFilePath', () => {
    it('should return true for paths with forward slashes', () => {
      expect(isFilePath('path/to/file.txt')).toBe(true);
      expect(isFilePath('./relative/path.txt')).toBe(true);
      expect(isFilePath('/absolute/path.txt')).toBe(true);
    });

    it('should return true for paths with backslashes', () => {
      expect(isFilePath('path\\to\\file.txt')).toBe(true);
      expect(isFilePath('.\\relative\\path.txt')).toBe(true);
      expect(isFilePath('C:\\absolute\\path.txt')).toBe(true);
    });

    it('should return true for files with .txt extension', () => {
      expect(isFilePath('prompt.txt')).toBe(true);
      expect(isFilePath('system-prompt.txt')).toBe(true);
    });

    it('should return true for files with .md extension', () => {
      expect(isFilePath('readme.md')).toBe(true);
      expect(isFilePath('instructions.md')).toBe(true);
    });

    it('should return true for files with .prompt extension', () => {
      expect(isFilePath('system.prompt')).toBe(true);
      expect(isFilePath('assistant.prompt')).toBe(true);
    });

    it('should return false for strings without path indicators', () => {
      expect(isFilePath('simple string')).toBe(false);
      expect(isFilePath('You are a helpful assistant')).toBe(false);
      expect(isFilePath('filename')).toBe(false);
      expect(isFilePath('config')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(isFilePath('')).toBe(false);
    });

    it('should handle mixed cases', () => {
      expect(isFilePath('path/to/PROMPT.TXT')).toBe(true);
      expect(isFilePath('PATH\\TO\\file.MD')).toBe(true);
      expect(isFilePath('simple.PROMPT')).toBe(true);
    });

    it('should return true for paths with multiple extensions', () => {
      expect(isFilePath('backup.prompt.txt')).toBe(true);
      expect(isFilePath('config.json.md')).toBe(true);
    });

    it('should return false for extensions not in the list', () => {
      expect(isFilePath('file.json')).toBe(false);
      expect(isFilePath('config.yaml')).toBe(false);
      expect(isFilePath('script.js')).toBe(false);
    });
  });
});
