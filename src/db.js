import initSqlJs from 'sql.js'

let _dbPromise

export async function getDB() {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      try {
        // 1) Load sql.js with a local wasm path
        const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
        console.log('sql.js initialized (wasm located)')

        const db = new SQL.Database()

        // Always enable FKs
        db.exec(`PRAGMA foreign_keys = ON;`)

        // 2) Fetch schema + seed with logs
        const [schemaResp, seedResp] = await Promise.all([
          fetch('/schema.sql'),
          fetch('/seed.json')
        ])
        console.log('schema status:', schemaResp.status, 'seed status:', seedResp.status)

        const schemaText = await schemaResp.text()
        const seed = await seedResp.json()
        console.log('schema bytes:', schemaText.length, 'seed keys:', Object.keys(seed))

        // 3) Apply schema (if present)
        try {
          if (schemaText?.trim()) {
            db.exec(schemaText)
            console.log('schema applied')
          } else {
            console.warn('schema.sql empty? skipping')
          }
        } catch (e) {
          console.error('schema exec error:', e)
          throw e
        }

        // 3.5) Safety net: ensure required tables exist even if schema.sql missed them
        db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  system TEXT,
  started_at TEXT,
  ended_at TEXT,
  gm_user_id TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS rolls (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  roller_type TEXT NOT NULL CHECK (roller_type IN ('character','npc','system')),
  roller_id TEXT,
  expression TEXT NOT NULL,
  inputs_json TEXT,
  result_total INTEGER NOT NULL,
  results_json TEXT NOT NULL,
  context TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`)

        // Ensure there is a default session used by addRoll()
        const hasDefaultSession = db.exec(`SELECT 1 FROM sessions WHERE id='sess_001' LIMIT 1`)
        if (!(hasDefaultSession[0]?.values?.length)) {
          db.run(
            `INSERT INTO sessions (id, title, system, started_at)
             VALUES ('sess_001','Default Session','cyberpunk-red', datetime('now'))`
          )
          console.log("Inserted default session 'sess_001'")
        }

        // 4) Insert seed rows (minimal path: characters + sessions + logs if present)
        if (Array.isArray(seed.characters) && seed.characters.length) {
          const insertChar = db.prepare(
            `INSERT INTO characters
             (id,name,system,role_class,level,stats_json,derived_json,notes)
             VALUES (?,?,?,?,?,?,?,?)`
          )
          seed.characters.forEach(c => {
            insertChar.run([
              c.id, c.name, c.system, c.role_class ?? null, c.level ?? 1,
              JSON.stringify(c.stats_json || {}),
              JSON.stringify(c.derived_json || {}),
              c.notes ?? null
            ])
          })
          insertChar.free()
        }

        if (Array.isArray(seed.sessions) && seed.sessions.length) {
          const insertSess = db.prepare(
            `INSERT INTO sessions (id,title,system,started_at,gm_user_id)
             VALUES (?,?,?,?,?)`
          )
          seed.sessions.forEach(s => {
            // try insert; ignore duplicates by wrapping in try/catch
            try { insertSess.run([s.id, s.title, s.system, s.started_at ?? null, s.gm_user_id ?? null]) } catch {}
          })
          insertSess.free()
        }

        if (Array.isArray(seed.logs) && seed.logs.length) {
          const insertLog = db.prepare(
            `INSERT INTO logs (id, session_id, author_type, body, tags, created_at)
             VALUES (?,?,?,?,?,?)`
          )
          seed.logs.forEach(l => {
            try { insertLog.run([l.id, l.session_id ?? 'sess_001', l.author_type, l.body, l.tags ?? null, l.created_at ?? null]) } catch {}
          })
          insertLog.free()
        }

        const cnt = db.exec('SELECT COUNT(*) FROM characters')[0]?.values?.[0]?.[0]
        console.log('characters inserted:', cnt)

        // Show table list for sanity
        const tlist = db.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        console.log('Tables:', tlist[0]?.values?.map(v => v[0]))

        return db
      } catch (e) {
        console.error('DB init error:', e)
        throw e
      }
    })()
  }
  return _dbPromise
}

/** Persist a roll for the default session */
export async function addRoll({ sessionId = 'sess_001', expr, faces = [], total = 0 }) {
  const db = await getDB()
  const id = `roll_${Date.now()}`
  const resultsJson = JSON.stringify({ faces })
  db.run(
    `INSERT INTO rolls (id, session_id, roller_type, roller_id, expression, inputs_json, result_total, results_json, context, created_at)
     VALUES (?, ?, 'character', 'char_eden', ?, NULL, ?, ?, NULL, datetime('now'))`,
    [id, sessionId, expr, total, resultsJson]
  )
  return id
}

/** Read recent rolls (prepared statement for robustness) */
export async function listRolls({ sessionId = 'sess_001', limit = 25 } = {}) {
  const db = await getDB()
  const stmt = db.prepare(
    `SELECT expression, result_total, results_json, created_at
     FROM rolls
     WHERE session_id = ?
     ORDER BY datetime(created_at) DESC
     LIMIT ?`
  )
  const out = []
  stmt.bind([sessionId, limit])
  while (stmt.step()) {
    const row = stmt.getAsObject()
    out.push({
      expr: row.expression,
      total: row.result_total,
      faces: JSON.parse(row.results_json || '{}').faces ?? [],
      created: row.created_at
    })
  }
  stmt.free()
  return out
}

