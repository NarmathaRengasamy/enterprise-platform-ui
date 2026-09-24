export type KbFileStatus = 'pending' | 'processing' | 'active' | 'error';

export interface KbFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: KbFileStatus;
  chunkCount: number;
  folderId: string;
  folderName: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface KbFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  depth?: number;
  displayPath?: string;
  fileCount: number;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeStats {
  totalFiles: number;
  indexedFiles: number;
  notIndexed: number;
  totalChunks: number;
  totalSizeBytes: number;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export interface CreateMarkdownFileInput {
  name: string;
  content: string;
  folderId?: string;
}

export interface DeleteFolderResult {
  id: string;
  deleted: boolean;
  affectedAgents?: string[];
}

export interface GenerateCatalogInput {
  folderId?: string;
  includeProducts?: boolean;
  includeCategories?: boolean;
  template?: 'qa' | 'reference';
  replaceExisting?: boolean;
}

export interface GenerateCatalogResult {
  file: KbFile;
  productCount: number;
  categoryCount: number;
  sizeBytes: number;
}

