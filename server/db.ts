import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.M4A_DATA_DIR
  ? path.resolve(process.env.M4A_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'movement4all.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    birth_date TEXT NOT NULL,
    sports_json TEXT NOT NULL,
    home_label TEXT NOT NULL,
    home_lat REAL NOT NULL,
    home_lng REAL NOT NULL,
    max_travel_km REAL NOT NULL,
    blood_type TEXT NOT NULL,
    medical_restrictions TEXT NOT NULL DEFAULT '',
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    emergency_contact_relation TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    remember_me INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sport TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    municipality TEXT NOT NULL,
    meeting_point TEXT NOT NULL,
    meeting_lat REAL NOT NULL,
    meeting_lng REAL NOT NULL,
    route_description TEXT NOT NULL,
    distance_km REAL NOT NULL,
    level_min REAL NOT NULL,
    level_max REAL NOT NULL,
    hydration_points TEXT NOT NULL DEFAULT '',
    additional_notes TEXT NOT NULL DEFAULT '',
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    workout_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    enrolled_at TEXT NOT NULL,
    PRIMARY KEY (workout_id, user_id),
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    caption TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_workouts_start ON workouts(start_at);
  CREATE INDEX IF NOT EXISTS idx_workouts_sport ON workouts(sport);
  CREATE INDEX IF NOT EXISTS idx_chat_workout ON chat_messages(workout_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
`);
