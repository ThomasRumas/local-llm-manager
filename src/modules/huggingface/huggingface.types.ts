export interface SearchResult {
  repoId: string;
  name: string;
  author: string;
  downloads: number;
  likes: number;
  lastModified: string;
  tags: string[];
}

export interface GGUFFile {
  filename: string;
  sizeBytes: number;
  repoId: string;
}

export interface DownloadProgress {
  filename: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}
