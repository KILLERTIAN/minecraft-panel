import Database from "better-sqlite3";
import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { config } from "./config";

let db: Database.Database | null = null;

function init(): Database.Database {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  const file = path.join(config.dataDir, "panel.db");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      filename     TEXT NOT NULL,
      gdrive_file_id TEXT,
      size_bytes   INTEGER,
      type         TEXT NOT NULL DEFAULT 'manual',
      status       TEXT NOT NULL DEFAULT 'complete',
      created_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return db;
}

export interface BackupRow {
  id: number;
  filename: string;
  gdrive_file_id: string | null;
  size_bytes: number | null;
  type: string;
  status: string;
  created_at: string;
}

export function listBackups(): BackupRow[] {
  return init()
    .prepare("SELECT * FROM backups ORDER BY created_at DESC")
    .all() as BackupRow[];
}

export function getBackup(id: number): BackupRow | undefined {
  return init().prepare("SELECT * FROM backups WHERE id = ?").get(id) as
    | BackupRow
    | undefined;
}

export function insertBackup(b: {
  filename: string;
  gdrive_file_id: string | null;
  size_bytes: number | null;
  type: string;
  status?: string;
}): number {
  const r = init()
    .prepare(
      `INSERT INTO backups (filename, gdrive_file_id, size_bytes, type, status, created_at)
       VALUES (@filename, @gdrive_file_id, @size_bytes, @type, @status, @created_at)`
    )
    .run({
      ...b,
      status: b.status || "complete",
      created_at: new Date().toISOString(),
    });
  return Number(r.lastInsertRowid);
}

export function deleteBackup(id: number): void {
  init().prepare("DELETE FROM backups WHERE id = ?").run(id);
}

export function getSetting(key: string): string | null {
  const r = init().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return r?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  init()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}
