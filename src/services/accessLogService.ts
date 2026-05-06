import type { AccessLogInput } from "@/types/accessLog";

const ACCESS_LOG_QUEUE_KEY = "noora_access_log_queue_v1";
const ACCESS_LOG_ENDPOINT = "/api/access-logs";
const FLUSH_DELAY_MS = 1500;
const BATCH_SIZE = 20;

type QueueItem = AccessLogInput;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

class AccessLogService {
  private queue: QueueItem[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  constructor() {
    if (isBrowser()) {
      this.queue = this.readQueueFromStorage();
      window.addEventListener("online", () => {
        void this.flushQueue();
      });

      if (navigator.onLine && this.queue.length > 0) {
        queueMicrotask(() => {
          void this.flushQueue();
        });
      }
    }
  }

  async log(entry: AccessLogInput, flushNow = false): Promise<void> {
    const loggedOffline = isBrowser() ? !navigator.onLine : false;

    console.log(
      `[ACCESS-LOG] Queuing entry: event=${entry.event}, activity=${entry.activityName || ""}, queueSize=${this.queue.length + 1}`,
    );
    this.queue.push({
      ...entry,
      offlineSynced: entry.offlineSynced ?? loggedOffline,
    });
    this.persistQueue();

    if (!isBrowser()) {
      return;
    }

    if (flushNow || this.queue.length >= BATCH_SIZE) {
      await this.flushQueue();
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      void this.flushQueue();
    }, FLUSH_DELAY_MS);
  }

  async flushQueue(): Promise<void> {
    if (!isBrowser() || this.isFlushing || this.queue.length === 0) {
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.isFlushing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, BATCH_SIZE);
        console.log(
          `[ACCESS-LOG-FLUSH] Flushing ${batch.length} entries to ${ACCESS_LOG_ENDPOINT}`,
        );
        const response = await fetch(ACCESS_LOG_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entries: batch }),
        });

        if (!response.ok) {
          console.error(
            `[ACCESS-LOG-FLUSH-ERROR] API returned status ${response.status}`,
          );
          break;
        }

        console.log(
          `[ACCESS-LOG-FLUSH-OK] Successfully flushed ${batch.length} entries`,
        );
        this.queue.splice(0, batch.length);
        this.persistQueue();
      }
    } catch (error) {
      // Keep queued entries for the next online opportunity.
    } finally {
      this.isFlushing = false;
    }
  }

  private readQueueFromStorage(): QueueItem[] {
    try {
      const raw = window.localStorage.getItem(ACCESS_LOG_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as QueueItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  private persistQueue(): void {
    if (!isBrowser()) return;

    try {
      window.localStorage.setItem(
        ACCESS_LOG_QUEUE_KEY,
        JSON.stringify(this.queue.slice(-200)),
      );
    } catch (error) {
      // Ignore quota failures; logging should never break the app.
    }
  }
}

export const accessLogService = new AccessLogService();
