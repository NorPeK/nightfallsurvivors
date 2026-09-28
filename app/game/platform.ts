/** Runtime boundary shared by the web game and the isolated Playables build.
 * SDK contract verified against the official v1 reference, 2026-09-28.
 * The SDK is supplied by YouTube; it is never replaced by this module.
 */
export interface PlayablesSdk {
  IN_PLAYABLES_ENV: boolean;
  game: {
    firstFrameReady(): void;
    gameReady(): void;
    loadData(): Promise<string>;
    saveData(data: string): Promise<void>;
  };
  system: {
    isAudioEnabled(): boolean;
    onAudioEnabledChange(callback: (enabled: boolean) => void): () => void;
    onPause(callback: () => void): () => void;
    onResume(callback: () => void): () => void;
  };
  health?: { logError(): void };
}

declare global {
  interface Window { ytgame?: PlayablesSdk }
}

export const SAVE_KEY = "norpek-nightfall-save-v1";
const BACKUP_KEY = `${SAVE_KEY}-backup`;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PlatformOptions {
  target?: "web" | "playables";
  sdk?: PlayablesSdk;
  storage?: StorageLike;
}

export class SaveConflictError extends Error {
  constructor() {
    super("Your progress changed in another window. Reload to use the latest save.");
    this.name = "SaveConflictError";
  }
}

export class GamePlatform {
  private initialized = false;
  private firstFrameSent = false;
  private readySent = false;
  private loaded = false;
  private lastRead: string | null = null;
  private previewData: string | null = null;
  private paused = false;
  private enabled = true;
  private pauseWriteAvailable = false;
  private writesInFlight = 0;
  private frameRequested = false;
  private readyRequested = false;
  private resumeWaiters = new Set<{ resolve(): void; reject(error: Error): void }>();
  private pauseListeners = new Set<() => void>();
  private resumeListeners = new Set<() => void>();
  private audioListeners = new Set<(enabled: boolean) => void>();
  private disposers: (() => void)[] = [];

  constructor(private options: PlatformOptions = {}) {}

  private get sdk(): PlayablesSdk | undefined {
    return this.options.sdk ?? (typeof window === "undefined" ? undefined : window.ytgame);
  }

  get isPlayables(): boolean {
    return this.options.target === "playables" ||
      (this.options.target === undefined && process.env.NEXT_PUBLIC_GAME_TARGET === "playables") ||
      this.sdk?.IN_PLAYABLES_ENV === true;
  }

  get inPlayablesEnvironment(): boolean { return this.sdk?.IN_PLAYABLES_ENV === true; }
  get storageKind(): "browser" | "cloud" | "preview" {
    return this.inPlayablesEnvironment ? "cloud" : this.isPlayables ? "preview" : "browser";
  }
  get suspended(): boolean { return this.paused; }
  get audioEnabled(): boolean { return this.initialized ? this.enabled : this.sdk?.system.isAudioEnabled() ?? true; }

  private get storage(): StorageLike {
    if (this.options.storage) return this.options.storage;
    if (typeof window === "undefined") throw new Error("Browser storage is not available.");
    return window.localStorage;
  }

  init(): void {
    if (this.initialized) return;
    if (this.isPlayables && !this.sdk) {
      throw new Error("YouTube could not be connected. Check your connection and reload.");
    }
    if (this.isPlayables && this.sdk) {
      const disposers: (() => void)[] = [];
      try {
        this.enabled = this.sdk.system.isAudioEnabled();
        disposers.push(this.sdk.system.onPause(() => this.setPaused(true)));
        disposers.push(this.sdk.system.onResume(() => this.setPaused(false)));
        disposers.push(this.sdk.system.onAudioEnabledChange((enabled) => {
          this.enabled = enabled;
          for (const listener of this.audioListeners) listener(enabled);
        }));
        this.disposers.push(...disposers);
      } catch (error) {
        for (const dispose of disposers) { try { dispose(); } catch { /* preserve the initialization error */ } }
        throw error;
      }
    } else if (typeof document !== "undefined" && typeof window !== "undefined") {
      // Browser-only lifecycle. Playables MUST use the SDK instead.
      const visibility = () => this.setPaused(document.hidden);
      const pageHide = () => this.setPaused(true);
      const pageShow = () => this.setPaused(document.hidden);
      document.addEventListener("visibilitychange", visibility);
      window.addEventListener("pagehide", pageHide);
      window.addEventListener("pageshow", pageShow);
      this.paused = document.hidden;
      this.disposers.push(() => {
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("pagehide", pageHide);
        window.removeEventListener("pageshow", pageShow);
      });
    }
    this.initialized = true;
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.pauseWriteAvailable = paused;
    for (const listener of paused ? this.pauseListeners : this.resumeListeners) listener();
    if (!paused) {
      for (const waiter of this.resumeWaiters) waiter.resolve();
      this.resumeWaiters.clear();
      if (this.frameRequested) this.firstFrameReady();
      if (this.readyRequested) this.gameReady();
    }
  }

  private async waitUntilResumed(): Promise<void> {
    while (this.paused) await new Promise<void>((resolve, reject) => this.resumeWaiters.add({ resolve, reject }));
  }

  onPause(callback: () => void): () => void {
    this.pauseListeners.add(callback);
    return () => { this.pauseListeners.delete(callback); };
  }
  onResume(callback: () => void): () => void {
    this.resumeListeners.add(callback);
    return () => { this.resumeListeners.delete(callback); };
  }
  onAudioChanged(callback: (enabled: boolean) => void): () => void {
    this.audioListeners.add(callback);
    return () => { this.audioListeners.delete(callback); };
  }

  firstFrameReady(): void {
    this.init();
    this.frameRequested = true;
    if (this.paused) return;
    if (this.firstFrameSent) return;
    if (this.isPlayables) this.sdk?.game.firstFrameReady();
    this.firstFrameSent = true;
  }

  gameReady(): void {
    this.init();
    if (!this.frameRequested) throw new Error("Loading must be presented before the game becomes ready.");
    this.readyRequested = true;
    if (this.paused) return;
    if (!this.firstFrameSent) throw new Error("Loading must be presented before the game becomes ready.");
    if (this.readySent) return;
    if (this.isPlayables) this.sdk?.game.gameReady();
    this.readySent = true;
  }

  async loadData(): Promise<string | null> {
    this.init();
    while (this.paused) await this.waitUntilResumed();
    // A rejection leaves saving locked. The caller must retry loading successfully.
    this.loaded = false;
    const raw = this.storageKind === "cloud"
      ? await this.sdk!.game.loadData()
      : this.storageKind === "preview" ? this.previewData : this.storage.getItem(SAVE_KEY);
    this.lastRead = this.storageKind === "browser" ? raw : raw || null;
    this.loaded = true;
    return this.lastRead;
  }

  async loadBackup(): Promise<string | null> {
    this.init();
    return this.storageKind === "browser" ? this.storage.getItem(BACKUP_KEY) : null;
  }

  async saveData(data: string, options?: { preserveBackup?: boolean; pauseCheckpoint?: boolean }): Promise<void> {
    this.init();
    // The SDK permits a short onPause save window. Only one explicitly marked
    // boundary checkpoint may bypass the gate; ordinary queued work waits.
    if (options?.pauseCheckpoint && this.paused && this.pauseWriteAvailable && this.loaded && !this.writesInFlight) this.pauseWriteAvailable = false;
    else while (this.paused) await this.waitUntilResumed();
    if (!this.loaded) throw new Error("Progress must finish loading before it can be saved.");
    if (new TextEncoder().encode(data).byteLength >= 3 * 1024 * 1024) {
      throw new Error("Your save is too large. Existing saved progress has been kept.");
    }
    if (this.storageKind === "cloud") {
      this.writesInFlight++;
      try { await this.sdk!.game.saveData(data); }
      finally { this.writesInFlight--; }
    } else if (this.storageKind === "preview") {
      // The official SDK is a no-op locally. Preview progress lasts for this page only.
      this.previewData = data;
    } else {
      const storage = this.storage;
      const current = storage.getItem(SAVE_KEY);
      if (current !== this.lastRead) throw new SaveConflictError();
      if (this.lastRead && !options?.preserveBackup) {
        try { storage.setItem(BACKUP_KEY, this.lastRead); } catch { /* backup is best effort */ }
      }
      storage.setItem(SAVE_KEY, data);
    }
    this.lastRead = data;
  }

  reportError(): void { if (!this.paused) this.sdk?.health?.logError(); }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.pauseListeners.clear();
    this.resumeListeners.clear();
    this.audioListeners.clear();
    for (const waiter of this.resumeWaiters) waiter.reject(new Error("The game session was closed."));
    this.resumeWaiters.clear();
    this.initialized = false;
    this.loaded = false;
  }
}

export const platform = new GamePlatform();
