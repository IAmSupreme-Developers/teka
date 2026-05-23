import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'teka.db')

// singleton — one connection for the lifetime of the Node process
// WAL mode so reads don't block writes. you're welcome.
let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id            INTEGER NOT NULL,
      type          TEXT NOT NULL,       -- 'movies' | 'animes' | 'series'
      name          TEXT NOT NULL,
      photo         TEXT NOT NULL DEFAULT '',
      filter        TEXT NOT NULL DEFAULT '',
      description   TEXT NOT NULL DEFAULT '',
      year          INTEGER,
      total_episodes INTEGER,
      PRIMARY KEY (id, type)             -- composite PK: id=1 can exist for both movies AND animes
    );

    CREATE TABLE IF NOT EXISTS videos (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      location      TEXT NOT NULL,       -- plain path/url OR JSON quality map
      source        TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'external' — drives download strategy
      date          TEXT NOT NULL DEFAULT '',
      released      TEXT NOT NULL DEFAULT '',
      playlist_type TEXT NOT NULL,
      playlist_id   INTEGER NOT NULL,
      idx           INTEGER NOT NULL DEFAULT 0,
      duration      INTEGER,             -- seconds, nullable until populated
      thumbnail     TEXT
    );

    -- without this index every playlist load is a full table scan. don't remove it.
    CREATE INDEX IF NOT EXISTS idx_videos_playlist ON videos(playlist_type, playlist_id);

    CREATE TABLE IF NOT EXISTS users (
      id    INTEGER PRIMARY KEY,
      name  TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      dob   TEXT NOT NULL DEFAULT '',
      tel   TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS logins (
      id       INTEGER PRIMARY KEY,
      userid   INTEGER NOT NULL REFERENCES users(id),
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL             -- plaintext for now. yes, we know.
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      text       TEXT NOT NULL,
      rate       INTEGER NOT NULL DEFAULT 0,
      vid        INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  seed(db)
}

// runs once on first boot — populates demo data
// if you're reading this in production, hi
function seed(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM playlists').get() as { c: number }).c
  if (count > 0) return // already seeded, move on

  const iP = db.prepare('INSERT OR IGNORE INTO playlists (id, type, name, photo, filter) VALUES (?,?,?,?,?)')
  const iV = db.prepare('INSERT OR IGNORE INTO videos (id, name, location, date, released, playlist_type, playlist_id, idx) VALUES (?,?,?,?,?,?,?,?)')
  const iU = db.prepare('INSERT OR IGNORE INTO users (id, name, email, dob, tel) VALUES (?,?,?,?,?)')
  const iL = db.prepare('INSERT OR IGNORE INTO logins (id, userid, username, password) VALUES (?,?,?,?)')

  // wrap in a transaction — all or nothing, not "half the anime got inserted"
  db.transaction(() => {
    iP.run(1,'movies','Test-Trials','testvideo/IAS.png',' test delete testvideo')
    iP.run(2,'movies','Mummies 2023','testvideo/IAS.png',' mummies animated 2023')
    iP.run(3,'movies','The Old Guard','movies/netflix.png',' the old guard 2020')
    iP.run(1,'animes','Dark Gathering','testvideo/IAS.png',' dark gathering')
    iP.run(2,'animes','Undead Unlock','testvideo/IAS.png',' undead unlock')
    iP.run(3,'animes','Death Note','testvideo/IAS.png',' death note kira light yagami')

    iV.run(1,'Test','testvideo/7btrrd.mp4','02-12-2023','02-12-2023','movies',1,0)
    iV.run(2,'Test Part 2','testvideo/videoplayback.mp4','02-12-2023','03-12-2023','movies',1,1)
    iV.run(34,'Mummies 2023','movies/Mummies 2023.mp4','07-12-2023','12-06-2023','movies',2,0)
    iV.run(35,'The Old Guard 2020','movies/The Old Guard (2020).mp4','07-12-2023','16-06-2020','movies',3,0)

    for (let i = 1; i <= 22; i++)
      iV.run(2+i,`Dark Gathering S1E${i}`,`animes/dark gathering/EP.${i}.mp4`,'02-12-2023','04-12-2023','animes',1,i-1)
    for (let i = 1; i <= 9; i++)
      iV.run(24+i,`Undead Unlock S1E${i}`,`animes/undead unlock/${i}.mp4`,'02-12-2023','04-12-2023','animes',2,i-1)
    for (let i = 1; i <= 37; i++)
      iV.run(35+i,`Death Note E${i}`,`animes/Death note/${i}.mp4`,'08-12-2023','16-06-2020','animes',3,i-1)

    iU.run(1,'Ace Tennyson','ace@gmail.com','2000-06-16','677381456')
    iL.run(1,1,'iamsupreme','qwerty')
  })()
}

// ── Query helpers ─────────────────────────────────────────────────────────────

// JOIN ensures we only return playlists that actually have matching videos
// DISTINCT because multiple episodes can match the same query — we want the playlist once
export function searchPlaylists(type: string, query: string, step = 0) {
  return getDb().prepare(`
    SELECT DISTINCT p.* FROM playlists p
    JOIN videos v ON v.playlist_type = p.type AND v.playlist_id = p.id
    WHERE p.type = ? AND (v.name LIKE ? OR p.filter LIKE ?)
    LIMIT 10 OFFSET ?
  `).all(type, `%${query}%`, `%${query}%`, step * 10)
}

// location may be stored as JSON (quality map) or plain string — parse it either way
export function getPlaylistVideos(type: string, id: number) {
  const rows = getDb().prepare(
    'SELECT * FROM videos WHERE playlist_type = ? AND playlist_id = ? ORDER BY idx ASC'
  ).all(type, id) as Array<Record<string, unknown>>
  return rows.map(r => ({
    ...r,
    index: r.idx,   // map DB column idx → Video.index
    location: (() => { try { return JSON.parse(r.location as string) } catch { return r.location } })()
  }))
}

// merges username onto the user object so the client doesn't need a separate logins query
export function authenticate(username: string, password: string) {
  const db = getDb()
  const login = db.prepare(
    'SELECT * FROM logins WHERE username = ? AND password = ?'
  ).get(username, password) as { id: number; userid: number; username: string } | undefined
  if (!login) return null
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(login.userid)
  return user ? { cipher: login, username: login.username, ...(user as object) } : null
}
