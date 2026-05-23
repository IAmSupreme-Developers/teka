// either a plain path/url string, or a quality map — server picks the right one
// yes, storing JSON in a TEXT column. no, we're not sorry.
export type VideoQuality = 'auto' | '360p' | '720p' | '1080p'
export type VideoLocation = string | Partial<Record<VideoQuality, string>>

export interface Video {
  id: number
  name: string
  location: VideoLocation       // plain string OR { '720p': '...', '360p': '...' }
  source: 'local' | 'external' // decides download strategy — base64 vs Capacitor
  date: string
  released: string
  playlist_type: string         // replaces the old "is" string hack e.g. "animes-1"
  playlist_id: number
  index: number                 // episode order within playlist
  duration?: number             // seconds — needed for progress bar, not yet populated
  thumbnail?: string            // per-episode thumbnail, falls back to playlist photo
  cont?: { start: number }
}

export interface Playlist {
  id: number
  name: string
  photo: string
  filter: string                // search keywords — doubles as a poor man's tag system
  type: string                  // 'movies' | 'animes' | 'series'
  description?: string
  year?: number
  totalEpisodes?: number        // used to determine if a download is complete
}

export interface Review {
  id: number                    // DB AUTOINCREMENT — not a client-generated "name-ISO" string anymore
  name: string
  email: string
  text: string
  rate: number
  vid: number
  createdAt: string             // ISO date from DB default datetime('now')
}

export interface DownloadEntry {
  list: Playlist
  videos: Video[]               // only the episodes actually downloaded, not the full playlist
  downloadedAt: string          // ISO date — updated on each new episode download
  complete: boolean             // true when videos.length === playlist.totalEpisodes
}

// keyed by "type-id" e.g. "animes-1" — flat map beats an array of Playlist objects
export type ResumeMap = Record<string, {
  currentVid: number
  currentTime: number           // seconds — restored on next play
  lastWatched: string           // ISO date — sort by this for "continue watching"
}>

export interface User {
  id: number
  name: string
  username: string              // merged from logins table on auth response
  email: string
  dob: string
  tel: number
  avatar?: string
  downloads: DownloadEntry[]
  reviews: Review[]
}

// what you get back from /api/pt/login — User + the raw cipher row
export interface LoggedInUser extends User {
  cipher: { id: number; userid: number; username: string; password: string }
}

export interface LoginRecord {
  id: number
  username: string
  password: string
}

interface Runtime {
  searchdata: Playlist[]        // current search results shown in /search
  cPlaylist?: Playlist          // the playlist currently open in /video
  resume: ResumeMap             // persisted watch progress across sessions
  downloading?: number          // 0-100 progress — undefined when idle
}

interface Preferences {
  vidsticky: boolean            // pin video player to top while scrolling
  lighttheme: boolean
  eng: boolean                  // language toggle
  offlinemode: boolean          // use downloaded files instead of streaming
  autoplay: boolean             // auto-advance to next episode
  quality: VideoQuality         // preferred stream quality
}

// the entire app state — serialized to Capacitor Preferences as 'PreLoaded'
export interface TEKA {
  runtime: Runtime              // ephemeral-ish, but persisted for resume
  user: User
  preferences: Preferences
}
