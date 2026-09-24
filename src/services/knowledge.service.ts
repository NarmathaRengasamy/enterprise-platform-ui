import { client } from './client';
import {
  KbFile,
  KbFolder,
  KnowledgeStats,
  CreateFolderInput,
  GenerateCatalogInput,
  GenerateCatalogResult,
} from '../types/knowledge.types';

export * from '../types/knowledge.types';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB limit per FRONTEND-API-GUIDE

export const knowledgeService = {
  /**
   * Fetch knowledge base metrics (totalFiles, indexedFiles, notIndexed, totalChunks, totalSizeBytes).
   * Corresponds to GET /api/v1/knowledge/stats
   */
  async getKnowledgeStats(folderId?: string): Promise<KnowledgeStats> {
    const res = await client.get<KnowledgeStats>('/knowledge/stats', {
      params: folderId ? { folderId } : undefined,
    });
    return (
      res.data || {
        totalFiles: 0,
        indexedFiles: 0,
        notIndexed: 0,
        totalChunks: 0,
        totalSizeBytes: 0,
      }
    );
  },

  /**
   * Fetch all knowledge base folders.
   * Corresponds to GET /api/v1/knowledge/folders
   */
  async getFolders(): Promise<KbFolder[]> {
    const res = await client.get<{ folders: KbFolder[] }>('/knowledge/folders');
    return res.data?.folders || [];
  },

  /**
   * Create a new folder in the knowledge base.
   * Corresponds to POST /api/v1/knowledge/folders
   */
  async createFolder(payload: CreateFolderInput): Promise<KbFolder> {
    const res = await client.post<{ folder: KbFolder }>('/knowledge/folders', payload);
    if (!res.data?.folder) {
      throw new Error(res.message || 'Failed to create folder');
    }
    return res.data.folder;
  },

  /**
   * List files across all folders or scoped to a specific folder.
   * Corresponds to GET /api/v1/knowledge/files
   */
  async getFiles(folderId?: string): Promise<KbFile[]> {
    const res = await client.get<{ total: number; folderId: string; files: KbFile[] }>(
      '/knowledge/files',
      { params: folderId ? { folderId } : undefined }
    );
    return res.data?.files || [];
  },

  /**
   * Upload a raw binary file directly from PC (PDF, DOCX, XLSX, MD, TXT, CSV, JPEG, PNG, etc.) up to 25MB.
   * Corresponds to POST /api/v1/knowledge/files/upload?name=&mime=&folderId=
   */
  async uploadRawFile(file: File, folderId?: string): Promise<KbFile> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('File size exceeds 25MB limit. Please choose a smaller file.');
    }

    const buffer = await file.arrayBuffer();
    const params: Record<string, string> = {
      name: file.name,
      mime: file.type || 'application/octet-stream',
    };
    if (folderId) params.folderId = folderId;

    const res = await client.post<{ file: KbFile }>('/knowledge/files/upload', buffer, {
      params,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    if (!res.data?.file) {
      throw new Error(res.message || 'Failed to upload file');
    }
    return res.data.file;
  },

  /**
   * Auto-generate a comprehensive Markdown document from products and categories catalog.
   * Corresponds to POST /api/v1/knowledge/catalog
   */
  async generateCatalog(payload: GenerateCatalogInput): Promise<GenerateCatalogResult> {
    const res = await client.post<GenerateCatalogResult>('/knowledge/catalog', {
      replaceExisting: true,
      ...payload,
    });
    if (!res.data) {
      throw new Error(res.message || 'Failed to generate catalog document');
    }
    return res.data;
  },

  /**
   * Create and upload a Markdown article directly from text.
   * Corresponds to POST /api/v1/knowledge/files
   */
  async createMarkdownFile(payload: {
    name: string;
    content: string;
    folderId?: string;
  }): Promise<KbFile> {
    const res = await client.post<{ file: KbFile }>('/knowledge/files', payload);
    if (!res.data?.file) {
      throw new Error(res.message || 'Failed to upload markdown file');
    }
    return res.data.file;
  },

  /**
   * Rename an existing knowledge base folder.
   * Corresponds to PATCH /api/v1/knowledge/folders/:id
   */
  async renameFolder(id: string, name: string): Promise<KbFolder> {
    const res = await client.patch<{ folder: KbFolder }>(
      `/knowledge/folders/${encodeURIComponent(id)}`,
      { name }
    );
    if (!res.data?.folder) {
      throw new Error(res.message || 'Failed to rename folder');
    }
    return res.data.folder;
  },

  /**
   * Delete an empty folder from the knowledge base.
   * Corresponds to DELETE /api/v1/knowledge/folders/:id
   */
  async deleteFolder(id: string): Promise<{ id: string; deleted: boolean; affectedAgents?: string[] }> {
    const res = await client.delete<{ id: string; deleted: boolean; affectedAgents?: string[] }>(
      `/knowledge/folders/${encodeURIComponent(id)}`
    );
    return res.data || { id, deleted: true };
  },

  /**
   * Delete a knowledge base file by ID.
   * Corresponds to DELETE /api/v1/knowledge/files/:id
   */
  async deleteFile(id: string): Promise<{ id: string; deleted: boolean }> {
    const res = await client.delete<{ id: string; deleted: boolean }>(
      `/knowledge/files/${encodeURIComponent(id)}`
    );
    return res.data || { id, deleted: true };
  },
};
