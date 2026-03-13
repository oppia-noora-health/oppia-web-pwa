/**
 * Media Types for OppiaMobile Video/Audio System
 */

export interface MediaMetadata {
  filename: string; // e.g., "M1L1 - S 2.mp4" (with spaces, as in XML)
  digest: string; // MD5 hash for verification
  fileSize: number; // Size in bytes
  downloadUrl: string; // URL to download from
  length: number; // Duration in seconds
}

export interface Media extends MediaMetadata {
  courses: string[]; // Course IDs using this media
  downloading: boolean; // Download in progress
  downloaded: boolean; // Download complete
  failed: boolean; // Download failed
  progress: number; // Download progress 0-100
}

export interface MediaDownloadProgress {
  filename: string;
  progress: number;
  status: "pending" | "downloading" | "completed" | "failed";
  error?: string;
}
