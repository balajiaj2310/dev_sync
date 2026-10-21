/**
 * DevSync Code Workspace Service
 * Real-time API client for Browser IDE, file tree, code execution,
 * Git operations, and external IDE integration.
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient } from '../core/api-client.js';

export const WorkspaceService = {
  /**
   * Get workspace info, repository metadata, permissions, and supported languages
   */
  async getInfo(repoId) {
    try {
      return await apiClient.get(`/workspace/${encodeURIComponent(repoId)}/info`);
    } catch (err) {
      console.error('[WorkspaceService] getInfo failed:', err);
      throw err;
    }
  },

  /**
   * Get hierarchical and flat file tree for the branch
   */
  async getTree(repoId, branch) {
    try {
      const q = branch ? `?branch=${encodeURIComponent(branch)}` : '';
      return await apiClient.get(`/workspace/${encodeURIComponent(repoId)}/tree${q}`);
    } catch (err) {
      console.error('[WorkspaceService] getTree failed:', err);
      throw err;
    }
  },

  /**
   * Read file content and metadata
   */
  async getFile(repoId, branch, filePath) {
    try {
      const b = branch ? `branch=${encodeURIComponent(branch)}&` : '';
      return await apiClient.get(`/workspace/${encodeURIComponent(repoId)}/file?${b}path=${encodeURIComponent(filePath)}`);
    } catch (err) {
      console.error(`[WorkspaceService] getFile(${filePath}) failed:`, err);
      throw err;
    }
  },

  /**
   * Save / update file content
   */
  async saveFile(repoId, { branch, path, content, commitMessage }) {
    try {
      return await apiClient.post(`/workspace/${encodeURIComponent(repoId)}/file`, {
        branch,
        path,
        content,
        commitMessage: commitMessage || `Update ${path}`
      });
    } catch (err) {
      console.error(`[WorkspaceService] saveFile(${path}) failed:`, err);
      throw err;
    }
  },

  /**
   * Create a new file or directory
   */
  async createFile(repoId, { branch, path, type = 'file', content = '', commitMessage }) {
    try {
      return await apiClient.post(`/workspace/${encodeURIComponent(repoId)}/files/create`, {
        branch,
        path,
        type,
        content,
        commitMessage: commitMessage || `Create ${path}`
      });
    } catch (err) {
      console.error(`[WorkspaceService] createFile(${path}) failed:`, err);
      throw err;
    }
  },

  /**
   * Rename or move a file / directory
   */
  async renameFile(repoId, { branch, oldPath, newPath, commitMessage }) {
    try {
      return await apiClient.post(`/workspace/${encodeURIComponent(repoId)}/files/rename`, {
        branch,
        oldPath,
        newPath,
        commitMessage: commitMessage || `Rename ${oldPath} to ${newPath}`
      });
    } catch (err) {
      console.error(`[WorkspaceService] renameFile(${oldPath}) failed:`, err);
      throw err;
    }
  },

  /**
   * Delete a file or directory
   */
  async deleteFile(repoId, branch, filePath, commitMessage) {
    try {
      const b = branch ? `branch=${encodeURIComponent(branch)}&` : '';
      const m = commitMessage ? `&message=${encodeURIComponent(commitMessage)}` : '';
      return await apiClient.delete(`/workspace/${encodeURIComponent(repoId)}/file?${b}path=${encodeURIComponent(filePath)}${m}`);
    } catch (err) {
      console.error(`[WorkspaceService] deleteFile(${filePath}) failed:`, err);
      throw err;
    }
  },

  /**
   * Execute code in sandbox runner
   */
  async executeCode(repoId, { branch, filePath, sourceCode, language, stdin = '', args = [], provider }) {
    try {
      return await apiClient.post(`/workspace/${encodeURIComponent(repoId)}/execute`, {
        branch,
        filePath,
        sourceCode,
        language,
        stdin,
        args,
        provider
      });
    } catch (err) {
      console.error('[WorkspaceService] executeCode failed:', err);
      throw err;
    }
  },

  /**
   * Get execution history
   */
  async getHistory(repoId, limit = 20) {
    try {
      return await apiClient.get(`/workspace/${encodeURIComponent(repoId)}/history?limit=${limit}`);
    } catch (err) {
      console.error('[WorkspaceService] getHistory failed:', err);
      throw err;
    }
  },

  /**
   * Get Git status and recent commits
   */
  async getGitStatus(repoId, branch) {
    try {
      const q = branch ? `?branch=${encodeURIComponent(branch)}` : '';
      return await apiClient.get(`/workspace/${encodeURIComponent(repoId)}/git/status${q}`);
    } catch (err) {
      console.error('[WorkspaceService] getGitStatus failed:', err);
      throw err;
    }
  },

  /**
   * Create a Git commit
   */
  async commitChanges(repoId, { branch, message, files = [] }) {
    try {
      return await apiClient.post(`/workspace/${encodeURIComponent(repoId)}/git/commit`, {
        branch,
        message,
        files
      });
    } catch (err) {
      console.error('[WorkspaceService] commitChanges failed:', err);
      throw err;
    }
  },

  /**
   * Get external IDE configuration and deep links
   */
  async getIdeConfig(repoId, branch) {
    try {
      const q = branch ? `?branch=${encodeURIComponent(branch)}` : '';
      return await apiClient.get(`/workspace/${encodeURIComponent(repoId)}/ide-config${q}`);
    } catch (err) {
      console.error('[WorkspaceService] getIdeConfig failed:', err);
      throw err;
    }
  },

  /**
   * Generate download URL for project ZIP archive
   */
  getArchiveUrl(repoId, branch) {
    const b = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return `${APP_CONFIG.apiBaseUrl}/workspace/${encodeURIComponent(repoId)}/archive.zip${b}`;
  }
};
