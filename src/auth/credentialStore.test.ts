/**
 * Tests for credential storage system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as CredentialStore from './credentialStore.js';
import type { AuthInfo } from './credentialStore.js';
import { readJsonFile, writeJsonFile } from '../shared/fileOperations.js';

// Mock shared file operations
vi.mock('../shared/fileOperations.js', () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  ensureDirectory: vi.fn(),
  getUserConfigPath: vi.fn(() => '/test/home/.config/envoy/auth.json'),
}));

describe('CredentialStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return stored credentials', async () => {
      const mockCredentials = {
        anthropic: {
          type: 'oauth',
          access: 'test-token',
          refresh: 'refresh-token',
          expires: Date.now() + 3600000,
        },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockCredentials);

      const result = await CredentialStore.get('anthropic');

      expect(result).toEqual(mockCredentials.anthropic);
    });

    it('should return undefined for non-existent provider', async () => {
      vi.mocked(readJsonFile).mockResolvedValue({});

      const result = await CredentialStore.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should handle missing auth file', async () => {
      vi.mocked(readJsonFile).mockResolvedValue(null);

      const result = await CredentialStore.get('anthropic');

      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should store OAuth credentials with proper validation and merging', async () => {
      const existingCredentials = {
        openai: { type: 'api', key: 'sk-existing' },
      };
      const newCredentials = {
        type: 'oauth' as const,
        access: 'test-token',
        refresh: 'refresh-token',
        expires: Date.now() + 3600000,
      };

      vi.mocked(readJsonFile).mockResolvedValue(existingCredentials);

      await CredentialStore.set('anthropic', newCredentials);

      // Verify the actual data structure being written
      const writeCall = vi.mocked(writeJsonFile).mock.calls[0];
      const writtenData = writeCall[1];

      expect(writtenData).toEqual({
        openai: { type: 'api', key: 'sk-existing' },
        anthropic: newCredentials,
      });
      expect(writeCall[2]).toEqual({ mode: 0o600 });
    });

    it('should store API key credentials and overwrite existing provider data', async () => {
      const existingCredentials = {
        anthropic: {
          type: 'oauth',
          access: 'old-token',
          refresh: 'old-refresh',
          expires: 123,
        },
      };
      const newCredentials = {
        type: 'api' as const,
        key: 'sk-ant-test-key',
      };

      vi.mocked(readJsonFile).mockResolvedValue(existingCredentials);

      await CredentialStore.set('anthropic', newCredentials);

      // Verify the credential was overwritten with the new type
      const writeCall = vi.mocked(writeJsonFile).mock.calls[0];
      const writtenData = writeCall[1];

      expect(writtenData).toEqual({
        anthropic: newCredentials,
      });
      expect(writeCall[2]).toEqual({ mode: 0o600 });
    });

    it('should validate credentials before storing', async () => {
      const invalidCredentials = {
        type: 'invalid',
        someField: 'value',
      } as unknown;

      await expect(
        CredentialStore.set('anthropic', invalidCredentials as AuthInfo)
      ).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('should remove provider credentials while preserving others', async () => {
      const mockCredentials = {
        anthropic: {
          type: 'oauth',
          access: 'token',
          refresh: 'refresh',
          expires: Date.now(),
        },
        openai: { type: 'api', key: 'sk-test' },
        google: { type: 'api', key: 'google-key' },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockCredentials);

      await CredentialStore.remove('anthropic');

      // Verify the actual data structure after removal
      const writeCall = vi.mocked(writeJsonFile).mock.calls[0];
      const writtenData = writeCall[1];

      expect(writtenData).toEqual({
        openai: { type: 'api', key: 'sk-test' },
        google: { type: 'api', key: 'google-key' },
      });
      expect(writeCall[2]).toEqual({ mode: 0o600 });
    });

    it('should handle removing non-existent provider', async () => {
      const mockCredentials = {
        openai: { type: 'api', key: 'sk-test' },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockCredentials);

      await CredentialStore.remove('nonexistent');

      // Should still write the original data unchanged
      const writeCall = vi.mocked(writeJsonFile).mock.calls[0];
      const writtenData = writeCall[1];

      expect(writtenData).toEqual(mockCredentials);
    });
  });

  describe('list', () => {
    it('should return all stored credentials', async () => {
      const mockCredentials = {
        anthropic: {
          type: 'oauth',
          access: 'token',
          refresh: 'refresh',
          expires: Date.now(),
        },
        openai: { type: 'api', key: 'sk-test' },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockCredentials);

      const result = await CredentialStore.list();

      expect(result).toEqual(mockCredentials);
    });

    it('should filter out invalid credentials', async () => {
      const mockCredentials = {
        anthropic: {
          type: 'oauth',
          access: 'token',
          refresh: 'refresh',
          expires: Date.now(),
        },
        invalid: { type: 'unknown', badField: 'value' },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockCredentials);

      const result = await CredentialStore.list();

      expect(result).toEqual({
        anthropic: mockCredentials.anthropic,
      });
    });
  });

  describe('has', () => {
    it('should return true if provider has credentials', async () => {
      const mockCredentials = {
        anthropic: {
          type: 'oauth',
          access: 'token',
          refresh: 'refresh',
          expires: Date.now(),
        },
      };

      vi.mocked(readJsonFile).mockResolvedValue(mockCredentials);

      const result = await CredentialStore.has('anthropic');

      expect(result).toBe(true);
    });

    it('should return false if provider has no credentials', async () => {
      vi.mocked(readJsonFile).mockResolvedValue({});

      const result = await CredentialStore.has('anthropic');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove auth file', async () => {
      await CredentialStore.clear();

      expect(vi.mocked(fs.unlink)).toHaveBeenCalled();
    });

    it('should handle missing auth file gracefully', async () => {
      vi.mocked(fs.unlink).mockRejectedValue({ code: 'ENOENT' });

      await expect(CredentialStore.clear()).resolves.not.toThrow();
    });
  });
});
