/**
 * DevSync Repository Service
 * Real-time backend API integration for repositories, branches, files, uploads, and team members.
 * Supports normalization across Django REST, custom server.py endpoints, and repository cached fallbacks.
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
      if (res && Array.isArray(res.results)) return res.results;
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
      if (Array.isArray(res)) return { members: res, membersCount: res.length };
    } catch (err) {
      console.warn(`[RepositoryService] getMembers(${repoId}) failed:`, err);
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

  async getBranches(repoId, fallbackRepo = null) {
    try {
      const res = await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/branches`);
      if (res && Array.isArray(res.branches)) {
        const normalized = res.branches.map(b => ({
          name: typeof b === 'string' ? b : (b.name || 'main'),
          isDefault: typeof b === 'object' ? Boolean(b.isDefault || b.is_default) : (b === (res.defaultBranch || 'main')),
          filesCount: b.filesCount || 0,
          lastCommit: b.lastCommit || b.commitSha || b.sha || 'Direct branch commit',
          lastActor: b.lastActor || b.author || b.author_name || '',
          updatedAt: b.updatedAt || b.updated || b.created_at || 'Recently'
        }));
        return { repository: res.repository || repoId, defaultBranch: res.defaultBranch || 'main', branches: normalized, branchesCount: normalized.length };
      }
      if (Array.isArray(res)) {
        const normalized = res.map(b => ({
          name: typeof b === 'string' ? b : (b.name || 'main'),
          isDefault: typeof b === 'object' ? Boolean(b.is_default || b.isDefault) : false,
          filesCount: 0,
          lastCommit: b.sha || b.lastCommit || 'Direct branch commit',
          lastActor: b.author_name || b.lastActor || '',
          updatedAt: b.created_at || b.updatedAt || 'Recently'
        }));
        return { repository: repoId, defaultBranch: 'main', branches: normalized, branchesCount: normalized.length };
      }
    } catch (err) {
      console.warn(`[RepositoryService] getBranches(${repoId}) failed, checking fallback:`, err);
    }

    // Fallback to loaded repo metadata
    if (fallbackRepo && Array.isArray(fallbackRepo.branches)) {
      const defaultBranchName = fallbackRepo.defaultBranch || 'main';
      const normalized = fallbackRepo.branches.map(b => {
        const bName = typeof b === 'string' ? b : (b.name || 'main');
        const isDef = typeof b === 'object' ? Boolean(b.isDefault || b.is_default) : (bName === defaultBranchName);
        const bFiles = fallbackRepo.files?.[bName] || fallbackRepo.branchFiles?.[bName] || [];
        const lastF = bFiles[bFiles.length - 1] || {};
        return {
          name: bName,
          isDefault: isDef,
          filesCount: bFiles.length,
          lastCommit: b.lastCommit || lastF.last_commit || lastF.commitMessage || 'Direct branch commit',
          lastActor: b.lastActor || lastF.last_actor || fallbackRepo.owner || 'developer',
          updatedAt: b.updatedAt || lastF.updated_at || fallbackRepo.updated || 'Recently'
        };
      });
      return { repository: fallbackRepo.name || repoId, defaultBranch: defaultBranchName, branches: normalized, branchesCount: normalized.length };
    }

    return { repository: repoId, defaultBranch: 'main', branches: [{ name: 'main', isDefault: true, filesCount: 0, lastCommit: 'Initial commit', lastActor: 'developer', updatedAt: 'Recently' }], branchesCount: 1 };
  },

  async createBranch(repoId, branchData) {
    return await apiClient.post(`/repositories/${encodeURIComponent(repoId)}/branches`, branchData);
  },

  async getFiles(repoId, branch = 'main', path = '', recursive = false, fallbackRepo = null) {
    const cleanDir = (path || '').trim().replace(/^\/|\/$/g, '');
    try {
      const query = new URLSearchParams({ branch, path: cleanDir, recursive: recursive ? 'true' : 'false' }).toString();
      const res = await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/files?${query}`);

      if (res && Array.isArray(res.files)) {
        const normalized = res.files.map(f => ({
          name: f.name || (f.path ? f.path.split('/').pop() : 'file'),
          path: (f.path || f.name || '').replace(/^\//, ''),
          type: (f.type === 'dir' || f.type === 'directory') ? 'dir' : 'file',
          size: f.size || 0,
          lastCommit: f.last_commit || f.lastCommit || f.commitMessage || 'Direct commit',
          lastActor: f.last_actor || f.lastActor || '',
          updatedAt: f.updated_at || f.updated || 'Recently',
          content: f.content
        }));
        return { ...res, path: cleanDir, files: normalized, filesCount: normalized.length };
      }

      // If response is a direct list of file objects (e.g., from Django REST)
      if (Array.isArray(res)) {
        const results = [];
        const seenDirs = new Set();
        for (const f of res) {
          const fPath = (f.path || f.name || '').replace(/^\//, '');
          if (cleanDir) {
            if (!fPath.startsWith(cleanDir + '/')) continue;
            const rel = fPath.substring(cleanDir.length + 1);
            const parts = rel.split('/');
            if (parts.length > 1) {
              const dName = parts[0];
              if (!seenDirs.has(dName)) {
                seenDirs.add(dName);
                results.push({
                  name: dName,
                  path: `${cleanDir}/${dName}`,
                  type: 'dir',
                  size: 0,
                  lastCommit: f.message || f.last_commit || 'Direct commit',
                  lastActor: f.author_name || f.last_actor || '',
                  updatedAt: f.created_at || 'Recently'
                });
              }
            } else {
              results.push({
                name: parts[0],
                path: fPath,
                type: 'file',
                size: f.size || (f.content ? f.content.length : 0),
                lastCommit: f.message || f.last_commit || 'Direct commit',
                lastActor: f.author_name || f.last_actor || '',
                updatedAt: f.created_at || 'Recently',
                content: f.content
              });
            }
          } else {
            const parts = fPath.split('/');
            if (parts.length > 1) {
              const dName = parts[0];
              if (!seenDirs.has(dName)) {
                seenDirs.add(dName);
                results.push({
                  name: dName,
                  path: dName,
                  type: 'dir',
                  size: 0,
                  lastCommit: f.message || f.last_commit || 'Direct commit',
                  lastActor: f.author_name || f.last_actor || '',
                  updatedAt: f.created_at || 'Recently'
                });
              }
            } else {
              results.push({
                name: parts[0],
                path: fPath,
                type: 'file',
                size: f.size || (f.content ? f.content.length : 0),
                lastCommit: f.message || f.last_commit || 'Direct commit',
                lastActor: f.author_name || f.last_actor || '',
                updatedAt: f.created_at || 'Recently',
                content: f.content
              });
            }
          }
        }
        return { repository: repoId, branch, path: cleanDir, files: results, filesCount: results.length };
      }
    } catch (err) {
      console.warn(`[RepositoryService] getFiles failed, evaluating fallback:`, err);
    }

    // Fallback: evaluate files directly from repository object
    if (fallbackRepo) {
      const allBranchFiles = fallbackRepo.files?.[branch] || fallbackRepo.branchFiles?.[branch] || [];
      if (allBranchFiles.length > 0) {
        const results = [];
        const seenDirs = new Set();
        for (const f of allBranchFiles) {
          const fPath = (f.path || f.name || '').replace(/^\//, '');
          if (cleanDir) {
            if (!fPath.startsWith(cleanDir + '/')) continue;
            const rel = fPath.substring(cleanDir.length + 1);
            const parts = rel.split('/');
            if (parts.length > 1) {
              const dName = parts[0];
              if (!seenDirs.has(dName)) {
                seenDirs.add(dName);
                results.push({
                  name: dName,
                  path: `${cleanDir}/${dName}`,
                  type: 'dir',
                  size: 0,
                  lastCommit: f.last_commit || f.commitMessage || 'Direct commit',
                  lastActor: f.last_actor || fallbackRepo.owner || '',
                  updatedAt: f.updated_at || 'Recently'
                });
              }
            } else {
              results.push({
                name: f.name || parts[0],
                path: fPath,
                type: 'file',
                size: f.size || (f.content ? f.content.length : 0),
                lastCommit: f.last_commit || f.commitMessage || 'Direct commit',
                lastActor: f.last_actor || fallbackRepo.owner || '',
                updatedAt: f.updated_at || 'Recently',
                content: f.content
              });
            }
          } else {
            const parts = fPath.split('/');
            if (parts.length > 1) {
              const dName = parts[0];
              if (!seenDirs.has(dName)) {
                seenDirs.add(dName);
                results.push({
                  name: dName,
                  path: dName,
                  type: 'dir',
                  size: 0,
                  lastCommit: f.last_commit || f.commitMessage || 'Direct commit',
                  lastActor: f.last_actor || fallbackRepo.owner || '',
                  updatedAt: f.updated_at || 'Recently'
                });
              }
            } else {
              results.push({
                name: f.name || parts[0],
                path: fPath,
                type: 'file',
                size: f.size || (f.content ? f.content.length : 0),
                lastCommit: f.last_commit || f.commitMessage || 'Direct commit',
                lastActor: f.last_actor || fallbackRepo.owner || '',
                updatedAt: f.updated_at || 'Recently',
                content: f.content
              });
            }
          }
        }
        return { repository: fallbackRepo.name || repoId, branch, path: cleanDir, files: results, filesCount: results.length };
      }
    }

    return { repository: repoId, branch, path: cleanDir, files: [], filesCount: 0 };
  },

  async getFile(repoId, branch = 'main', path = '', fallbackRepo = null) {
    const cleanPath = (path || '').trim().replace(/^\//, '');
    try {
      const query = new URLSearchParams({ branch, path: cleanPath }).toString();
      const res = await apiClient.get(`/repositories/${encodeURIComponent(repoId)}/file?${query}`);
      if (res && res.file) return res.file;
      if (res && (res.content !== undefined || res.path)) return res;
    } catch (err) {
      console.warn(`[RepositoryService] getFile(${cleanPath}) API failed, checking fallback:`, err);
    }

    // Fallback: search in loaded repository object
    if (fallbackRepo) {
      const branchFiles = fallbackRepo.files?.[branch] || fallbackRepo.branchFiles?.[branch] || [];
      const matched = branchFiles.find(f => (f.path || f.name || '').replace(/^\//, '') === cleanPath || f.name === cleanPath);
      if (matched) {
        return {
          name: matched.name || cleanPath.split('/').pop(),
          path: (matched.path || cleanPath).replace(/^\//, ''),
          size: matched.size || (matched.content ? matched.content.length : 0),
          last_commit: matched.last_commit || matched.commitMessage || 'Direct commit',
          last_actor: matched.last_actor || fallbackRepo.owner || 'developer',
          updated_at: matched.updated_at || 'Recently',
          content: matched.content !== undefined ? matched.content : `// Empty file: ${cleanPath}`
        };
      }
    }

    throw new Error(`File '${cleanPath}' not found in repository.`);
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
