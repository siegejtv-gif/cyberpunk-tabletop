PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, handle TEXT UNIQUE NOT NULL, display_name TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, name TEXT NOT NULL, system TEXT NOT NULL, level INTEGER DEFAULT 1, role_class TEXT, stats_json TEXT NOT NULL, derived_json TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS npcs (id TEXT PRIMARY KEY, owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, name TEXT NOT NULL, system TEXT NOT NULL, archetype TEXT, stats_json TEXT NOT NULL, derived_json TEXT, disposition TEXT DEFAULT 'neutral', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, system TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, rules_json TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS inventories (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL CHECK (actor_type IN ('character','npc')), actor_id TEXT NOT NULL, capacity_json TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(actor_type, actor_id));
CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL REFERENCES inventories(id) ON DELETE CASCADE, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL DEFAULT 1, state_json TEXT, attuned INTEGER DEFAULT 0, equipped_slot TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS cyberware (id TEXT PRIMARY KEY, system TEXT NOT NULL, name TEXT NOT NULL, slot TEXT, rules_json TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS actor_cyberware (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL CHECK (actor_type IN ('character','npc')), actor_id TEXT NOT NULL, cyberware_id TEXT NOT NULL REFERENCES cyberware(id) ON DELETE RESTRICT, state_json TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(actor_type, actor_id, cyberware_id));
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, system TEXT NOT NULL, started_at TEXT, ended_at TEXT, gm_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, notes TEXT);
CREATE TABLE IF NOT EXISTS rolls (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL, roller_type TEXT NOT NULL CHECK (roller_type IN ('character','npc','system')), roller_id TEXT, expression TEXT NOT NULL, inputs_json TEXT, result_total INTEGER NOT NULL, results_json TEXT NOT NULL, context TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE, author_type TEXT NOT NULL CHECK (author_type IN ('user','system')), author_id TEXT, body TEXT NOT NULL, tags TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS maps (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL, name TEXT NOT NULL, source TEXT, grid_size INTEGER DEFAULT 5, meta_json TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE, actor_type TEXT NOT NULL CHECK (actor_type IN ('character','npc')), actor_id TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, rotation REAL DEFAULT 0, state_json TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS actor_tags (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL CHECK (actor_type IN ('character','npc')), actor_id TEXT NOT NULL, tag TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(actor_type, actor_id, tag));
CREATE VIEW IF NOT EXISTS actor_view AS
  SELECT 'character' AS actor_type, id AS actor_id, name, system, stats_json, derived_json FROM characters
  UNION ALL
  SELECT 'npc' AS actor_type, id AS actor_id, name, system, stats_json, derived_json FROM npcs;
CREATE INDEX IF NOT EXISTS idx_characters_system ON characters(system);
CREATE INDEX IF NOT EXISTS idx_npcs_system ON npcs(system);
CREATE INDEX IF NOT EXISTS idx_rolls_session ON rolls(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_session ON logs(session_id);
CREATE INDEX IF NOT EXISTS idx_tokens_map ON tokens(map_id);
