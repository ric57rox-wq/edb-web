/**
 * EDB domain entities (local Dexie shape). camelCase fields, uuid string `id`
 * as the global primary key (same id used as the Supabase row id — no FK
 * translation needed). Calendar dates (`acquired`, `installed`, session `date`)
 * are plain 'YYYY-MM-DD' strings to avoid timezone drift; only the sync
 * timestamps (`createdAt`/`updatedAt`/`deletedAt`) are `Date` objects.
 */

/** Columns every synced row carries. `id` is the global uuid (also the Supabase PK). */
export interface SyncFields {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  /** Soft-delete clock for the REMOTE row. Locally always null (deletes are hard). */
  deletedAt: Date | null;
}

export interface Rifle extends SyncFields {
  name: string;
  caliber?: string;
  manufacturer?: string;
  model?: string;
  acquired?: string; // YYYY-MM-DD
  /** Default optic; pre-fills a new session's scope field. */
  scope?: string;
  /** Default suppressor; pre-fills a new session's suppressor field. */
  suppressor?: string;
  notes?: string;
}

export interface Barrel extends SyncFields {
  rifleId: string;
  label?: string;
  length?: string;
  twist?: string;
  installed?: string; // YYYY-MM-DD
  /** Target barrel life in rounds (drives the health badge). */
  life?: number;
  /** Current round count (maintained by the session round-count integration). */
  rounds: number;
  notes?: string;
}

export interface Ammunition extends SyncFields {
  rifleId: string;
  label: string;
  notes?: string;
}

export type WeatherSource = 'manual' | 'auto';

/** A course of fire. */
export interface Session extends SyncFields {
  rifleId: string;
  barrelId?: string;
  ammunitionId?: string;
  target?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  distance?: number;
  targetType?: string;
  timeLimit?: string;
  position?: string;
  barricade?: string;
  scope?: string;
  suppressor?: string;
  velocity?: number;
  dopeElevation?: string;
  dopeWindage?: string;
  hits: number;
  misses: number;
  shotSequence?: string;
  weatherTemp?: number;
  windSpeed?: number;
  windDir?: string;
  humidity?: number;
  pressure?: number;
  light?: string;
  weatherSource?: WeatherSource;
  notes?: string;
}

export interface SessionPhoto extends SyncFields {
  sessionId: string;
  /** Supabase Storage object key: session-photos/{owner}/{id}.jpg (set on upload). */
  storagePath?: string;
  width?: number;
  height?: number;
}

/**
 * Local-only binary cache for a photo, keyed by the `session_photos` row id.
 * Never synced as a row — the bytes go to Supabase Storage; this is the offline
 * copy (both the capture queued before upload and the download cache).
 */
export interface PhotoBlob {
  id: string;
  blob: Blob;
}

/** Fields a caller supplies on create (sync columns are stamped by the repository). */
export type NewRow<T extends SyncFields> = Omit<T, keyof SyncFields>;
