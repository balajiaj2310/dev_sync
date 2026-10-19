/**
 * DevSync Repository Service
 * Real-time backend API integration for repositories, branches, files, uploads, and team members.
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const RepositoryService = {
  async getRepositories(filters = {}) {
    try {
      const cleanFilters = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== '') cleanFilters[k] = v;
      }
      const params = new URLSearchParams(cleanFilters).toString();
      const res = await apiClient.get(`/repositories${params ? '?' + params : ''}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn('[RepositoryService] getRepositories API failed, falling back:', err);
    }
    return await MockAPI.getRepositories(filters);
  },

  async getRepository(id) {
    try {
      const res = await apiClient.get(`/repositories/${encodeURIComponent(id)}`);
      if (res && res.name) return res;
    } catch (err) {
      console.warn(`[RepositoryService] getRepository(${id}) API failed, falling back:`, err);
    }
    return await MockAPI.getRepositoryById(id);
  },

  async createRepository(data) {
    try {
      const res = await apiClient.post('/repositories', data);
      if (res && (res.repository || res.name)) return res.repository || res;
    } catch (err) {
      console.warn('[RepositoryService] createRepository API failed:', err);
      throw err;
    }
    return await MockAPI.createRepository(data);
  },

  async getMembers(repoId) {
    try {
      const res = await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/members`);
      if (res && Array.isArray(res.members)) return res;
    } catch (err) {
      console.warn(`[RepositoryService] getMembers(${repoId}) failed:`, err);
      throw err;
    }
    return { members: [], membersCount: 0 };
  },

  async inviteMember(repoId, memberData) {
    return await apiClient.post(`/repositories/${encodeURIComponent(repoId)}/members`, memberData);
  },

  async updateMember(repoId, username, data) {
    return await apiClient.patch(`/repositories/${encodeURIComponent(repoId)}/members/${encodeURIComponent(username)}`, data);
  },

  async removeMember(repoId, username) {
    return await apiClient.delete(`/repositories/${encodeURIComponent(repoId)}/members/${encodeURIComponent(username)}`);
  },

  async getBranches(repoId) {
    try {
      const res = await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/branches`);
      if (res && Array.isArray(res.branches)) return res;
    } catch (err) {
      console.warn(`[RepositoryService] getBranches(${repoId}) failed:`, err);
      throw err;
    }
    return { branches: [{ name: 'main', isDefault: true }], branchesCount: 1 };
  },

  async createBranch(repoId, branchData) {
    return await apiClient.post(`/repositories/${encodeURIComponent(repoId)}/branches`, branchData);
  },

  async getFiles(repoId, branch = 'main', path = '', recursive = false) {
    try {
      const query = new URLSearchParams({ branch, path, recursive: recursive ? 'true' : 'false' }).toString();
      const res = await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/files?${query}`);
      if (res && Array.isArray(res.files)) return res;
    } catch (err) {
      console.warn(`[RepositoryService] getFiles failed:`, err);
      throw err;
    }
    return { files: [], filesCount: 0 };
  },

  async getFile(repoId, branch = 'main', path = '') {
    const query = new URLSearchParams({ branch, path }).toString();
    return await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/file?${query}`);
  },

  async uploadFile(repoId, uploadData) {
    return await apiClient.post(`/repositories/${encodeURIComponent(repoId)}/upload`, uploadData);
  },

  async getAttachments(repoId) {
    return await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/attachments`);
  },

  async uploadAttachment(repoId, attachmentData) {
    return await apiClient.post(`/repositories/${encodeURIComponent(repoId)}/attachments`, attachmentData);
  },

  async getActivity(repoId) {
    return await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/activity`);
  }
};
