/**
 * Media Cache Storage Utility
 * Uses Cache Storage API for video/audio files (better for large media)
 * Cross-platform compatible: iOS, Android, Desktop
 */

const MEDIA_CACHE_NAME = "noora-health-media-v1";

/**
 * Store media file in Cache Storage
 */
export async function storeMediaInCache(
  courseId: string,
  filename: string,
  content: Uint8Array,
  mimeType: string
): Promise<void> {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);

    // Create unique URL for this media file
    const cacheUrl = `/media-cache/${courseId}/${filename}`;

    // Create Response object with media content
    const blob = new Blob([content as any], { type: mimeType });
    const response = new Response(blob, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": content.length.toString(),
        "Cache-Control": "max-age=31536000", // 1 year
      },
    });

    await cache.put(cacheUrl, response);
  } catch (error) {
    throw error;
  }
}

/**
 * Get media file from Cache Storage
 * Returns blob URL for use in video/audio elements
 */
export async function getMediaFromCache(
  courseId: string,
  filename: string
): Promise<string | null> {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cacheUrl = `/media-cache/${courseId}/${filename}`;

    const response = await cache.match(cacheUrl);

    if (response) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if media exists in Cache Storage
 */
export async function isMediaInCache(
  courseId: string,
  filename: string
): Promise<boolean> {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cacheUrl = `/media-cache/${courseId}/${filename}`;
    const response = await cache.match(cacheUrl);
    return !!response;
  } catch (error) {
    return false;
  }
}

/**
 * Delete media file from Cache Storage
 */
export async function deleteMediaFromCache(
  courseId: string,
  filename: string
): Promise<boolean> {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cacheUrl = `/media-cache/${courseId}/${filename}`;
    const deleted = await cache.delete(cacheUrl);

    if (deleted) {}

    return deleted;
  } catch (error) {
    return false;
  }
}

/**
 * Delete all media files for a course
 */
export async function deleteCourseMediaFromCache(
  courseId: string
): Promise<void> {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const requests = await cache.keys();

    const coursePrefix = `/media-cache/${courseId}/`;
    const deletePromises = requests
      .filter((request) => request.url.includes(coursePrefix))
      .map((request) => cache.delete(request));

    await Promise.all(deletePromises);
  } catch (error) {
    throw error;
  }
}

/**
 * Get cache storage usage statistics
 */
export async function getMediaCacheStats(): Promise<{
  usage: number;
  quota: number;
  usagePercent: number;
  usageMB: number;
  quotaMB: number;
}> {
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        usagePercent,
        usageMB: usage / 1024 / 1024,
        quotaMB: quota / 1024 / 1024,
      };
    }
  } catch (error) {}

  return {
    usage: 0,
    quota: 0,
    usagePercent: 0,
    usageMB: 0,
    quotaMB: 0,
  };
}

/**
 * Clear all media cache (for troubleshooting)
 */
export async function clearMediaCache(): Promise<void> {
  try {
    const deleted = await caches.delete(MEDIA_CACHE_NAME);
    if (deleted) {}
  } catch (error) {
    throw error;
  }
}
