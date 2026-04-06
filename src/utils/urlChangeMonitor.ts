/**
 * URL Change Feature - Live Monitoring Utility
 *
 * Add this to the app to monitor URL changes and verify data cleanup in real-time.
 * Can be enabled in development or production for debugging.
 *
 * Usage:
 * 1. Import and initialize in layout.tsx or root component
 * 2. Open browser console to see logs
 * 3. Perform URL change
 * 4. Verify all checks pass
 */

export interface URLChangeMonitorConfig {
  enabled: boolean;
  verbose: boolean;
  alertOnIssues: boolean;
}

export class URLChangeMonitor {
  private config: URLChangeMonitorConfig;
  private lastApiUrl: string | null = null;
  private storageEventListener: ((e: StorageEvent) => void) | null = null;

  constructor(config: Partial<URLChangeMonitorConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === "development",
      verbose: false,
      alertOnIssues: false,
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize() {
    if (typeof window === "undefined") return;

    this.lastApiUrl = localStorage.getItem("custom_api_url");
    this.log("🔍 URL Change Monitor initialized");
    this.log(`📍 Current API URL: ${this.lastApiUrl || "Default"}`);

    // Monitor localStorage changes
    this.storageEventListener = (e: StorageEvent) => {
      if (e.key === "custom_api_url" && e.newValue !== e.oldValue) {
        this.onURLChange(e.oldValue, e.newValue);
      }
    };

    window.addEventListener("storage", this.storageEventListener);

    // Check on page visibility change (when tab becomes visible)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.checkURLChange();
      }
    });

    // Initial check
    setTimeout(() => this.checkURLChange(), 1000);
  }

  private log(message: string, data?: any) {
    if (!this.config.enabled) return;
  }

  private warn(message: string, data?: any) {
    if (!this.config.enabled) return;

    if (data) {
      console.warn(`[URL Monitor] ⚠️  ${message}`, data);
    } else {
      console.warn(`[URL Monitor] ⚠️  ${message}`);
    }

    if (this.config.alertOnIssues) {
      alert(`URL Monitor Warning: ${message}`);
    }
  }

  private error(message: string, data?: any) {
    if (!this.config.enabled) return;

    if (data) {
      console.error(`[URL Monitor] ❌ ${message}`, data);
    } else {
      console.error(`[URL Monitor] ❌ ${message}`);
    }

    if (this.config.alertOnIssues) {
      alert(`URL Monitor Error: ${message}`);
    }
  }

  private checkURLChange() {
    const currentUrl = localStorage.getItem("custom_api_url");

    if (currentUrl !== this.lastApiUrl) {
      if (this.lastApiUrl !== null) {
        // URL changed!
        this.onURLChange(this.lastApiUrl, currentUrl);
      }
      this.lastApiUrl = currentUrl;
    }
  }

  private async onURLChange(oldUrl: string | null, newUrl: string | null) {
    this.log("🔄 API URL Changed!");
    this.log(`  From: ${oldUrl || "Default"}`);
    this.log(`  To: ${newUrl || "Default"}`);

    // Wait a bit for logout to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify data cleanup
    await this.verifyDataCleanup();
  }

  private async verifyDataCleanup() {
    this.log("🧹 Verifying data cleanup...");

    const issues: string[] = [];

    // Check localStorage
    const localStorageIssues = this.checkLocalStorage();
    if (localStorageIssues.length > 0) {
      issues.push(...localStorageIssues);
    }

    // Check IndexedDB
    const indexedDBIssues = await this.checkIndexedDB();
    if (indexedDBIssues.length > 0) {
      issues.push(...indexedDBIssues);
    }

    // Check Cache Storage
    const cacheIssues = await this.checkCacheStorage();
    if (cacheIssues.length > 0) {
      issues.push(...cacheIssues);
    }

    // Report results
    if (issues.length === 0) {
      this.log("✅ All data cleanup checks passed!");
    } else {
      this.error("❌ Data cleanup issues found:", issues);
      issues.forEach((issue) => this.warn(issue));
    }

    return issues;
  }

  private checkLocalStorage(): string[] {
    const issues: string[] = [];

    // Keys that SHOULD exist after URL change
    const allowedKeys = new Set(["custom_api_url"]);

    // Keys that should NOT exist after logout
    const forbiddenPatterns = [
      "auth-storage",
      "apiKey",
      "user_",
      "visit-cached-pages",
      "noora_last_activity_",
      "noora_pretest_attempts",
    ];

    const allKeys = Object.keys(localStorage);

    allKeys.forEach((key) => {
      if (!allowedKeys.has(key)) {
        // Check if this key matches a forbidden pattern
        const isForbidden = forbiddenPatterns.some((pattern) =>
          key.includes(pattern),
        );

        if (isForbidden) {
          issues.push(`localStorage: Unexpected key still exists: ${key}`);
        } else if (this.config.verbose) {
          this.log(`localStorage: Non-standard key found: ${key}`);
        }
      }
    });

    if (issues.length === 0) {
      this.log("✅ localStorage cleaned correctly");
    }

    return issues;
  }

  private async checkIndexedDB(): Promise<string[]> {
    const issues: string[] = [];

    if (!("indexedDB" in window)) {
      this.warn("IndexedDB not supported");
      return issues;
    }

    const dbNames = [
      "NooraHealthCourses",
      "NooraHealthGamification",
      "NooraHealthOffline",
    ];

    for (const dbName of dbNames) {
      try {
        const db = await this.openIndexedDB(dbName);
        const recordCount = await this.countIndexedDBRecords(db);
        db.close();

        if (recordCount > 0) {
          issues.push(
            `IndexedDB: ${dbName} still contains ${recordCount} records`,
          );
        } else {
          this.log(`✅ IndexedDB: ${dbName} is empty`);
        }
      } catch (error) {
        // Database doesn't exist or error opening - that's good
        this.log(`✅ IndexedDB: ${dbName} deleted or doesn't exist`);
      }
    }

    return issues;
  }

  private openIndexedDB(dbName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async countIndexedDBRecords(db: IDBDatabase): Promise<number> {
    let totalCount = 0;

    const storeNames = Array.from(db.objectStoreNames);

    for (const storeName of storeNames) {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const count = await new Promise<number>((resolve) => {
          const countRequest = store.count();
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () => resolve(0);
        });
        totalCount += count;
      } catch (error) {
        // Ignore errors from individual stores
      }
    }

    return totalCount;
  }

  private async checkCacheStorage(): Promise<string[]> {
    const issues: string[] = [];

    if (!("caches" in window)) {
      this.warn("Cache Storage not supported");
      return issues;
    }

    try {
      const cacheNames = await caches.keys();
      const appCaches = cacheNames.filter((name) => name.startsWith("noora-"));

      for (const cacheName of appCaches) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        // API cache should be empty after URL change
        if (cacheName.includes("api") && keys.length > 0) {
          issues.push(
            `Cache Storage: ${cacheName} still contains ${keys.length} items`,
          );
        }

        // Media cache should be empty
        if (cacheName.includes("media") && keys.length > 0) {
          issues.push(
            `Cache Storage: ${cacheName} still contains ${keys.length} media files`,
          );
        }

        if (keys.length === 0) {
          this.log(`✅ Cache Storage: ${cacheName} is empty`);
        } else if (this.config.verbose) {
          this.log(`Cache Storage: ${cacheName} contains ${keys.length} items`);
        }
      }
    } catch (error: any) {
      this.warn(`Cache Storage check failed: ${error.message}`);
    }

    return issues;
  }

  public async manualCheck(): Promise<{
    passed: boolean;
    issues: string[];
  }> {
    const issues = await this.verifyDataCleanup();

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  public getStatus() {
    return {
      enabled: this.config.enabled,
      currentApiUrl: localStorage.getItem("custom_api_url"),
      lastCheckedUrl: this.lastApiUrl,
    };
  }

  public destroy() {
    if (this.storageEventListener) {
      window.removeEventListener("storage", this.storageEventListener);
      this.storageEventListener = null;
    }
  }
}

// Singleton instance
let monitorInstance: URLChangeMonitor | null = null;

export function initializeURLChangeMonitor(
  config?: Partial<URLChangeMonitorConfig>,
): URLChangeMonitor {
  if (typeof window === "undefined") {
    return null as any; // SSR safety
  }

  if (!monitorInstance) {
    monitorInstance = new URLChangeMonitor(config);
  }

  // Attach to window for console access
  (window as any).__urlChangeMonitor = monitorInstance;

  return monitorInstance;
}

export function getURLChangeMonitor(): URLChangeMonitor | null {
  return monitorInstance;
}

// Console helper
if (typeof window !== "undefined") {
  (window as any).checkURLChange = () => {
    const monitor = getURLChangeMonitor();
    if (monitor) {
      return monitor.manualCheck();
    } else {
      console.error(
        "URL Change Monitor not initialized. Call initializeURLChangeMonitor() first.",
      );
    }
  };
}
