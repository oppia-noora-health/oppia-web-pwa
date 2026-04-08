/**
 * Media Download Service
 * Handles downloading and storing video/audio files from module.xml
 */

import { initDB, getMimeType } from "@/utils/courseStorageIDB";
import {
  storeMediaInCache,
  getMediaFromCache,
  isMediaInCache,
  deleteCourseMediaFromCache,
} from "@/utils/mediaCacheStorage";
import type {
  Media,
  MediaMetadata,
  MediaDownloadProgress,
} from "@/types/media";

// Re-export types for convenience
export type { Media, MediaMetadata, MediaDownloadProgress };

export function parseMediaFromXml(moduleXml: string): MediaMetadata[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(moduleXml, "text/xml");

  const mediaList: MediaMetadata[] = [];
  const seenFiles = new Set<string>(); // Avoid duplicates

  // Parse all <file> elements within <media> tags
  const fileElements = xmlDoc.querySelectorAll("media > file");

  fileElements.forEach((fileEl) => {
    const filename = fileEl.getAttribute("filename");
    const downloadUrl = fileEl.getAttribute("download_url");
    const digest = fileEl.getAttribute("digest");
    const length = fileEl.getAttribute("length");
    const filesize = fileEl.getAttribute("filesize");

    if (filename && downloadUrl && !seenFiles.has(filename)) {
      mediaList.push({
        filename,
        downloadUrl: downloadUrl, // Keep original staging URL for direct download
        digest: digest || "",
        length: length ? parseInt(length) : 0,
        fileSize: filesize ? parseFloat(filesize) : 0,
      });
      seenFiles.add(filename);
    }
  });

  return mediaList;
}

/**
 * Get all media metadata for a course from module.xml
 */
export async function getCourseMedia(courseId: string): Promise<Media[]> {
  const db = await initDB();

  // Try to get module.xml - first with exact key, then with path search
  const moduleXmlKey = `${courseId}_module.xml`;

  let moduleXmlFile = await db.get("files", moduleXmlKey);

  // If not found with exact key, search for any file ending with module.xml
  if (!moduleXmlFile) {
    try {
      const allKeys = await db.getAllKeys("files");
      const coursePrefix = `${courseId}_`;

      // Find any key that starts with courseId_ and ends with module.xml
      const moduleXmlKeyFound = allKeys.find(
        (key) =>
          String(key).startsWith(coursePrefix) &&
          String(key).endsWith("module.xml"),
      );

      if (moduleXmlKeyFound) {
        moduleXmlFile = await db.get("files", moduleXmlKeyFound);
      }
    } catch (e) {}
  }

  if (!moduleXmlFile) {
    // Try to list all keys to debug
    try {
      const allKeys = await db.getAllKeys("files");
      // Fix: Only match keys that START with courseId_
      const coursePrefix = `${courseId}_`;
      const matchingKeys = allKeys.filter((key) =>
        String(key).startsWith(coursePrefix),
      );

      // Also check if module.xml exists with any path
      const moduleXmlKeys = allKeys.filter((key) =>
        String(key).includes("module.xml"),
      );
    } catch (e) {}

    return [];
  }

  // Convert Uint8Array to string
  const moduleXml = new TextDecoder().decode(moduleXmlFile.content);

  // Parse media metadata
  const mediaMetadata = parseMediaFromXml(moduleXml);

  // Convert to Media objects and check download status
  const mediaList: Media[] = await Promise.all(
    mediaMetadata.map(async (meta) => {
      const isDownloaded = await isMediaDownloaded(courseId, meta.filename);
      return {
        ...meta,
        courses: [courseId],
        downloading: false,
        downloaded: isDownloaded,
        failed: false,
        progress: isDownloaded ? 100 : 0,
      };
    }),
  );

  return mediaList;
}

/**
 * Check if a media file is downloaded
 * Checks Cache Storage (new location for videos/audio)
 */
export async function isMediaDownloaded(
  courseId: string,
  filename: string,
): Promise<boolean> {
  // Check Cache Storage (new location for media files)
  const inCache = await isMediaInCache(courseId, filename);

  if (inCache) {
    return true;
  }

  // Fallback: Check IndexedDB (legacy location)
  const db = await initDB();
  const key = `${courseId}_${filename}`;
  const file = await db.get("files", key);
  const inIDB = !!file;

  if (inIDB) {
  } else {
  }

  return inIDB;
}

/**
 * Get missing media files for a course
 */
export async function getMissingMedia(courseId: string): Promise<Media[]> {
  const allMedia = await getCourseMedia(courseId);
  const missingMedia = allMedia.filter((m) => !m.downloaded);

  if (missingMedia.length > 0) {
  }

  return missingMedia;
}

/**
 * Download a single media file
 */
export async function downloadMedia(
  courseId: string,
  media: Media,
  onProgress?: (progress: MediaDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const directUrl = media.downloadUrl; // Use original staging URL directly

    onProgress?.({
      filename: media.filename,
      progress: 0,
      status: "downloading",
    });

    // Download directly from staging with CORS (no authentication needed)
    const fetchOpts: RequestInit = {
      mode: "cors",
      credentials: "omit",
    };
    if (signal) {
      (fetchOpts as any).signal = signal;
    }
    const response = await fetch(directUrl, fetchOpts);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
    );

    if (!response.body) {
      throw new Error("No response body");
    }

    // Read the stream with progress tracking
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch (err) {}
        throw new DOMException("Media download aborted", "AbortError");
      }
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      // Calculate and report progress
      if (contentLength > 0 && onProgress) {
        const progress = Math.floor((receivedLength / contentLength) * 100);
        onProgress({
          filename: media.filename,
          progress,
          status: "downloading",
        });
      }
    }

    // Combine chunks into single Uint8Array
    const fileData = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      fileData.set(chunk, position);
      position += chunk.length;
    }

    // Determine MIME type
    const mimeType = getMimeType(media.filename);

    await storeMediaInCache(courseId, media.filename, fileData, mimeType);

    onProgress?.({
      filename: media.filename,
      progress: 100,
      status: "completed",
    });

    return true;
  } catch (error) {
    onProgress?.({
      filename: media.filename,
      progress: 0,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return false;
  }
}

/**
 * Download all missing media files for a course
 */
export async function downloadAllMissingMedia(
  courseId: string,
  onProgress?: (progress: MediaDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<{ success: number; failed: number }> {
  const missingMedia = await getMissingMedia(courseId);

  // Some module.xml files can contain duplicate media references
  // (e.g., encoded/decoded filename variants). Dedupe them per batch.
  const normalizedKey = (media: Media) => {
    let decoded = media.filename;
    try {
      decoded = decodeURIComponent(media.filename);
    } catch {
      decoded = media.filename;
    }

    return `${decoded.trim().toLowerCase()}|${media.downloadUrl}`;
  };

  const dedupedMissingMedia = missingMedia.filter((media, index, arr) => {
    const key = normalizedKey(media);
    return index === arr.findIndex((m) => normalizedKey(m) === key);
  });

  if (dedupedMissingMedia.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;
  const attemptedKeys = new Set<string>();

  // Download one at a time to avoid overwhelming the connection
  for (let i = 0; i < dedupedMissingMedia.length; i++) {
    if (signal?.aborted) {
      break;
    }

    const media = dedupedMissingMedia[i];
    const key = normalizedKey(media);

    if (attemptedKeys.has(key)) {
      continue;
    }
    attemptedKeys.add(key);

    // Re-check before download in case another path completed this media already.
    const alreadyDownloaded = await isMediaDownloaded(courseId, media.filename);
    if (alreadyDownloaded) {
      continue;
    }

    const result = await downloadMedia(courseId, media, onProgress, signal);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get media file as Blob URL for playback
 * Checks Cache Storage first, then falls back to IndexedDB
 */
export async function getMediaBlobUrl(
  courseId: string,
  filename: string,
): Promise<string | null> {
  // Try Cache Storage first (new location)
  const cachedUrl = await getMediaFromCache(courseId, filename);
  if (cachedUrl) {
    return cachedUrl;
  }

  // Fallback to IndexedDB (legacy location)
  const db = await initDB();
  const key = `${courseId}_${filename}`;

  const file = await db.get("files", key);

  if (!file) {
    // Try to list similar keys for debugging
    try {
      const allKeys = await db.getAllKeys("files");
      const similarKeys = allKeys.filter((k) =>
        String(k).includes(filename.split(".")[0]),
      );
      if (similarKeys.length > 0) {
      }
    } catch (e) {}

    return null;
  }

  const mimeType = getMimeType(filename);
  // Create blob from Uint8Array - cast to any to handle ArrayBufferLike
  const blob = new Blob([file.content as any], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  return blobUrl;
}

/**
 * Delete all media files for a course
 * Removes from both Cache Storage and IndexedDB
 */
export async function deleteAllCourseMedia(courseId: string): Promise<void> {
  try {
    // Delete from Cache Storage
    await deleteCourseMediaFromCache(courseId);

    // Delete from IndexedDB (legacy)
    const db = await initDB();
    const filesTx = db.transaction("files", "readwrite");
    const store = filesTx.objectStore("files");
    const keys = await store.getAllKeys();

    let deletedCount = 0;
    for (const key of keys) {
      if (key.toString().startsWith(`${courseId}_`)) {
        // Check if it's a media file (not HTML/CSS/JS)
        const keyStr = key.toString();
        if (
          keyStr.endsWith(".mp4") ||
          keyStr.endsWith(".mp3") ||
          keyStr.endsWith(".webm") ||
          keyStr.endsWith(".m4v") ||
          keyStr.endsWith(".m4a")
        ) {
          await store.delete(key);
          deletedCount++;
        }
      }
    }

    await filesTx.done;
  } catch (error) {
    throw error;
  }
}
