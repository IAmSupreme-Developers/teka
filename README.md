# TéKã

A self-hosted streaming app built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **Capacitor**. Stream movies, anime, and TV series from your own server — with offline download support, quality selection, and a native mobile app via Capacitor.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | SQLite via `better-sqlite3` |
| State / Storage | Capacitor Preferences (native) + React Context |
| File Storage | Capacitor Filesystem (IndexedDB on web, native FS on device) |
| Event System | Custom EventBus (`lib/Eventbus.ts`) |
| Email | Nodemailer |
| Native | Capacitor 6 (iOS / Android) |

---

## Project Structure

```
teka/
├── app/
│   ├── api/
│   │   ├── pt/                     # Main content API
│   │   │   ├── checkonline/        # GET  — server health check
│   │   │   ├── login/              # POST — authenticate user
│   │   │   ├── movies/             # GET  — search movies
│   │   │   ├── animes/             # GET  — search anime
│   │   │   ├── series/             # GET  — search TV series
│   │   │   ├── playlist/           # POST — get videos for a playlist
│   │   │   ├── video/              # GET  — stream video (range requests, quality)
│   │   │   ├── photo/              # GET  — serve media images
│   │   │   ├── tekasafeblob/       # POST — chunked base64 download
│   │   │   └── downloadlimit/      # GET  — active download count / limit
│   │   └── shop/                   # Shop / media management API
│   │       ├── stream/             # GET  — stream in-memory media
│   │       ├── uploadM/            # POST — upload media in base64 slices
│   │       ├── deleteM/            # POST — delete media from memory
│   │       ├── prodmethod/         # POST — call a product method
│   │       └── addimage/           # POST — attach image to product
│   ├── home/page.tsx               # Home — featured banner + content grid
│   ├── search/page.tsx             # Search results / Downloads list
│   ├── video/page.tsx              # Video player + episode list + download
│   ├── settings/page.tsx           # Settings — downloads, playback, quality
│   ├── layout.tsx                  # Root layout with StoreProvider
│   ├── page.tsx                    # Redirects → /home
│   └── globals.css                 # Dark theme CSS variables + utilities
│
├── components/
│   ├── BottomBar.tsx               # Bottom nav: Search / Home / Settings
│   ├── SearchOverlay.tsx           # Full-screen search overlay with category pills
│   └── Pagination.tsx              # Paginator with ellipsis and prev/next
│
├── lib/
│   ├── types.ts                    # All shared TypeScript interfaces
│   ├── db.ts                       # SQLite connection, schema, seed, query helpers
│   ├── store.tsx                   # Global React context + Capacitor persistence
│   ├── models.ts                   # MediaManager, ProductManager, Base64Slices
│   ├── shopState.ts                # Singleton instances for shop managers
│   ├── downloadTracker.ts          # Concurrent base64 download counter
│   └── Eventbus.ts                 # Pub/sub event bus + singleton `bus` export
│
├── uploads/                        # Local video files (served by /api/pt/video)
├── media/                          # Additional local media (photos, etc.)
├── data/
│   └── teka.db                     # SQLite database (auto-created on first run)
└── public/
    └── placeholder.png             # Fallback image for missing thumbnails
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
cd teka
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

The SQLite database is created automatically at `data/teka.db` on first request, with demo playlists and videos seeded.

### Build for Production

```bash
npm run build
npm start
```

---

## Database

SQLite via `better-sqlite3`. The DB file lives at `data/teka.db` and is created automatically.

### Schema

**`playlists`** — composite PK `(id, type)` so `movies-1` and `animes-1` can coexist.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Part of composite PK |
| type | TEXT | `movies` \| `animes` \| `series` |
| name | TEXT | |
| photo | TEXT | Path or URL to cover image |
| filter | TEXT | Search keywords |
| description | TEXT | |
| year | INTEGER | Release year |
| total_episodes | INTEGER | Used to track download completion |

**`videos`** — indexed on `(playlist_type, playlist_id)`.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| location | TEXT | Plain path/URL **or** JSON quality map |
| source | TEXT | `local` \| `external` — drives download strategy |
| playlist_type | TEXT | |
| playlist_id | INTEGER | |
| idx | INTEGER | Episode order within playlist |
| duration | INTEGER | Seconds (optional) |
| thumbnail | TEXT | Per-episode thumbnail (optional) |

### Adding Content

**Single quality:**
```sql
INSERT INTO videos (name, location, source, playlist_type, playlist_id, idx)
VALUES ('Episode 1', 'https://cdn.example.com/ep1.mp4', 'external', 'animes', 1, 0);
```

**Multiple quality variants:**
```sql
INSERT INTO videos (name, location, source, playlist_type, playlist_id, idx)
VALUES ('Episode 1',
  '{"720p":"https://cdn.example.com/ep1.720p.mp4","360p":"https://cdn.example.com/ep1.360p.mp4"}',
  'external', 'animes', 1, 0);
```

**Local file** (place file in `uploads/` or `media/`):
```sql
INSERT INTO videos (name, location, source, playlist_type, playlist_id, idx)
VALUES ('Episode 1', 'MyShow/ep1.mp4', 'local', 'animes', 1, 0);
```

---

## API Reference

### `/api/pt`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pt/checkonline` | Returns `1` — used to verify server is reachable |
| POST | `/api/pt/login` | `{ username, password }` → user object |
| GET | `/api/pt/movies?query=&step=` | Search movies, paginated (10 per page) |
| GET | `/api/pt/animes?query=&step=` | Search anime |
| GET | `/api/pt/series?query=&step=` | Search TV series |
| POST | `/api/pt/playlist` | `{ query: id, type }` → sorted video array |
| GET | `/api/pt/video?vid=&quality=` | Stream video with HTTP range support. `vid` can be a plain path/URL or JSON quality map. `quality`: `auto`\|`360p`\|`720p`\|`1080p` |
| GET | `/api/pt/photo?content=` | Serve image file or proxy external URL |
| POST | `/api/pt/tekasafeblob` | `{ vid, start }` → base64 chunk. Loads full file into RAM on first request, serves chunks from cache. |
| GET | `/api/pt/downloadlimit` | `{ active, limit, available }` — check server download capacity |

### `/api/shop`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/shop/stream?media=` | Stream in-memory media buffer |
| POST | `/api/shop/uploadM` | Upload media in base64 slices |
| POST | `/api/shop/deleteM` | `{ name }` — remove media from memory |
| POST | `/api/shop/prodmethod` | `{ id, method, argument }` — call product method |
| POST | `/api/shop/addimage` | `{ id, media }` — attach image name to product |

---

## Key Concepts

### Video Streaming

The `/api/pt/video` route handles HTTP range requests (required for browser `<video>` seeking). It supports:
- **Local files** — reads from `uploads/` or `media/` directories
- **External URLs** — proxies the upstream range request transparently
- **Quality fallback** — if requested quality isn't available, falls back through `1080p → 720p → 360p → auto → first available`

### Download Strategy

Downloads use one of two strategies, chosen automatically:

| Condition | Strategy |
|---|---|
| `source === 'local'` AND server under limit | **Base64 chunked** — server loads file into RAM, client pulls ~512KB chunks. Fast on local network. |
| `source === 'external'` OR server at limit | **Capacitor `downloadFile`** — native HTTP download, no RAM buffering. |

The limit is set in `lib/downloadTracker.ts`:
```ts
export const BASE64_DOWNLOAD_LIMIT = 3
```

### State Persistence

App state (`TEKA`) is persisted via **Capacitor Preferences**:
- Native: secure key-value store
- Web: IndexedDB

Downloaded video blobs are stored via **Capacitor Filesystem**:
- Native: device filesystem
- Web: IndexedDB (no 5MB localStorage cap)

### EventBus

A singleton pub/sub bus (`lib/Eventbus.ts`) handles cross-component communication without prop drilling.

```ts
import { bus } from '@/lib/Eventbus'

// dispatch
bus.dispatch('download:progress', 42.5)
bus.dispatch('download:done')

// subscribe
bus.subscribe('download:progress', (pct: number) => setProgress(pct))
bus.subscribe('download:done', () => setProgress(undefined))

// cleanup
bus.unSubscribe('download:progress', handler)
```

Current events:

| Event | Payload | Description |
|---|---|---|
| `download:progress` | `number` (0–100) | Download progress percentage |
| `download:done` | — | Download completed or stopped |

---

## Types

Key interfaces in `lib/types.ts`:

```ts
// Video location — plain string or quality map
type VideoLocation = string | Partial<Record<'auto' | '360p' | '720p' | '1080p', string>>

interface Video {
  id: number
  name: string
  location: VideoLocation
  source: 'local' | 'external'
  playlist_type: string
  playlist_id: number
  index: number          // episode order (mapped from DB `idx`)
  duration?: number      // seconds
  thumbnail?: string
}

interface Playlist {
  id: number
  name: string
  photo: string
  filter: string
  type: string
  description?: string
  year?: number
  totalEpisodes?: number
}

// Resume progress keyed by "type-id"
type ResumeMap = Record<string, {
  currentVid: number
  currentTime: number
  lastWatched: string    // ISO date
}>

interface Preferences {
  vidsticky: boolean     // pin player while scrolling
  lighttheme: boolean
  eng: boolean           // language (EN/FR)
  offlinemode: boolean   // play from downloads only
  autoplay: boolean
  quality: 'auto' | '360p' | '720p' | '1080p'
}
```

---

## Branch Strategy

| Branch | Contents |
|---|---|
| `origin/main` | Full app — frontend + API routes + Capacitor |
| `origin/server` | API routes only (`app/api/`) — deploy as standalone server |

Changes to one branch do not affect the other.

---

## Capacitor (Native App)

```bash
# Initialize (first time)
npx cap init

# Build web assets
npm run build

# Add platforms
npx cap add ios
npx cap add android

# Sync and open
npx cap sync
npx cap open ios
npx cap open android
```

The `capacitor.config.ts` is pre-configured with app ID `com.goldenspear.teka`.

---

## License

MIT
