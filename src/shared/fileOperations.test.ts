/**
 * Tests for shared file operations utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import {
  readJsonFile,
  writeJsonFile,
  ensureDirectory,
  handleFileError,
  getUserConfigPath,
  getUserDataPath,
} from './fileOperations.js';

// Mock os
vi.mock('os', () => ({
  homedir: vi.fn(() => '/test/home'),
}));

describe('File Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('readJsonFile', () => {
    it('should read and parse JSON file successfully', async () => {
      const mockData = { key: 'value', number: 42 };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const result = await readJsonFile('/test/path.json');

      expect(result).toEqual(mockData);
      expect(fs.readFile).toHaveBeenCalledWith('/test/path.json', 'utf-8');
    });

    it('should return null when file does not exist', async () => {
      const error = new Error('File not found');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await readJsonFile('/test/nonexistent.json');

      expect(result).toBeNull();
    });

    it('should throw error for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(readJsonFile('/test/invalid.json')).rejects.toThrow(
        'Invalid JSON in /test/invalid.json'
      );
    });

    it('should apply validator function when provided', async () => {
      const mockData = { name: 'test', value: 123 };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const validator = vi.fn().mockReturnValue(mockData);
      const result = await readJsonFile('/test/path.json', validator);

      expect(validator).toHaveBeenCalledWith(mockData);
      expect(result).toEqual(mockData);
    });

    it('should throw error when validator fails', async () => {
      const mockData = { invalid: 'data' };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const validator = vi.fn().mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await expect(readJsonFile('/test/path.json', validator)).rejects.toThrow(
        'Invalid data in /test/path.json: Validation failed'
      );
    });

    it('should handle file read errors other than ENOENT', async () => {
      const error = new Error('Permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(readJsonFile('/test/path.json')).rejects.toThrow(
        'Failed to read file /test/path.json: Permission denied'
      );
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON file with default options', async () => {
      const data = { key: 'value', number: 42 };
      vi.mocked(fs.writeFile).mockResolvedValue();

      await writeJsonFile('/test/path.json', data);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/path.json',
        JSON.stringify(data, null, 2),
        { mode: 0o600 }
      );
    });

    it('should write JSON file with custom options', async () => {
      const data = { key: 'value' };
      vi.mocked(fs.writeFile).mockResolvedValue();

      await writeJsonFile('/test/path.json', data, { mode: 0o644, indent: 4 });

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/path.json',
        JSON.stringify(data, null, 4),
        { mode: 0o644 }
      );
    });

    it('should handle write errors', async () => {
      const error = new Error('Write failed');
      vi.mocked(fs.writeFile).mockRejectedValue(error);

      await expect(writeJsonFile('/test/path.json', {})).rejects.toThrow(
        'Failed to write JSON file /test/path.json: Write failed'
      );
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory with default options', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await ensureDirectory('/test/dir');

      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', {
        recursive: true,
        mode: 0o755,
      });
    });

    it('should create directory with custom options', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await ensureDirectory('/test/dir', { mode: 0o700, recursive: false });

      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', {
        recursive: false,
        mode: 0o700,
      });
    });

    it('should handle existing directory gracefully', async () => {
      const error = new Error('Directory exists');
      (error as NodeJS.ErrnoException).code = 'EEXIST';
      vi.mocked(fs.mkdir).mockRejectedValue(error);

      await expect(ensureDirectory('/test/dir')).resolves.not.toThrow();
    });

    it('should throw error for other mkdir failures', async () => {
      const error = new Error('Permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      vi.mocked(fs.mkdir).mockRejectedValue(error);

      await expect(ensureDirectory('/test/dir')).rejects.toThrow(
        'Failed to create directory /test/dir: Permission denied'
      );
    });
  });

  describe('handleFileError', () => {
    it('should return custom message when provided', () => {
      const error = new Error('Original error');
      const customMessage = 'Custom error message';

      const result = handleFileError(
        error,
        'test operation',
        '/test/path',
        customMessage
      );

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(customMessage);
    });

    it('should format error message with Error object', () => {
      const error = new Error('Original error message');

      const result = handleFileError(error, 'test operation', '/test/path');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(
        'Failed to test operation /test/path: Original error message'
      );
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';

      const result = handleFileError(error, 'test operation', '/test/path');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(
        'Failed to test operation /test/path: Unknown error'
      );
    });
  });

  describe('getUserConfigPath', () => {
    it('should return config path with no segments', () => {
      const result = getUserConfigPath();

      expect(result).toBe('/test/home/.config/envoy');
    });

    it('should return config path with segments', () => {
      const result = getUserConfigPath('subdir', 'file.json');

      expect(result).toBe('/test/home/.config/envoy/subdir/file.json');
    });

    it('should call homedir to get user home directory', () => {
      getUserConfigPath();

      expect(homedir).toHaveBeenCalled();
    });
  });

  describe('getUserDataPath', () => {
    it('should return macOS application support path', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = getUserDataPath('data.json');

      expect(result).toBe(
        '/test/home/Library/Application Support/envoy/data.json'
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return Windows AppData path', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = getUserDataPath('data.json');

      expect(result).toBe('/test/home/AppData/Roaming/envoy/data.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return Linux XDG path', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = getUserDataPath('data.json');

      expect(result).toBe('/test/home/.local/share/envoy/data.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return path with no segments', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = getUserDataPath();

      expect(result).toBe('/test/home/Library/Application Support/envoy');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
