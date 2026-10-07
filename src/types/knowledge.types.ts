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
  /** Language of names and labels in the document (default English). */
  language?: 'en' | 'ta' | 'hi';
  replaceExisting?: boolean;
}

export interface GenerateCatalogResult {
  file: KbFile;
  /** Published products included (product module v2). */
  productCount: number;
  categoryCount: number;
  /** Products left out: drafts, archived, and published ones with no active variant. */
  skipped?: { drafts: number; archived: number; no_active_variants: number };
  replaced?: number;
  sizeBytes: number;
}

