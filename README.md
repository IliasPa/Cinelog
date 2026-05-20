# Cinelog v3.0

A personal movie and book library app that runs locally in your browser.

![Cinelog](cinelog_app_icon.svg)

## What's new in v3.0

- **Smarter suggestions (beta)** — the recommendation engine has been fully redesigned; only titles you've rated 3–5 hearts shape your taste profile, and every dimension is amplified by how much you loved each title (your hearts rating acts as a multiplier); movie scoring now covers genre, director, IMDb rating tiers, mood/tone tags (via TMDB keywords), actors, decade, language, and type; book scoring covers genre, author, rating, subject tags, language, decade, and series flag
- **Rating multiplier** — a director or author from a film/book you rated 🐐 (5 hearts) pulls three times harder than one from something you rated 😐 (2 hearts); the formula is `effective weight = aspect weight × (hearts / 5)`
- **Already-seen penalty** — any title already in your library is automatically excluded from suggestions (score zeroed out)
- **TMDB keywords** — when using a TMDB API key, suggestions now fetch keyword/tag data alongside credits so mood and tone matching works out of the box

## What's new in v2.3

- **Scrollable grid pages** — My Movies, My Books, Suggestions, Wish List, and Trash now scroll naturally; cards are no longer compressed to fit the viewport and take as much space as they need to show all their information
- **Self-healing poster cache** — on every server start, any movie or book whose poster/cover file is missing from disk (or was never downloaded) is automatically re-fetched from IMDb, TMDB, Google Books, or Open Library; covers all four data sets (movies, wishlist, books, book wishlist)
- **Suggested by filter** — My Movies, My Books, Wish List (movies and books) each show a "Suggested by" dropdown when at least one item has a suggester recorded; selecting a name filters to only their recommendations; the dropdown appears and updates in real time as you add or edit notes
- **Notes on Wish List cards** — the 💬 button now appears on the top-left of every wish list card (movies and books) so you can record who suggested it and add a note before you've even watched or read it

## What's new in v2.2

- **Overview tab** — a new first tab with at-a-glance stats for your entire library: monthly and yearly counts, best month, top suggester, hearts distribution bar chart, and a prominent average hearts display; heart filter in the top-right corner to scope all stats to a minimum rating; Movies and Books shown in separate sections side by side on wide screens
- **Monthly Activity chart** — bar chart of the last 12 months with separate coloured bars for movies (purple) and books (gold); collapses to a single bar when the Library Tabs setting is set to one content type
- **Library Tabs now controls tab toggles** — when set to Movies-only or Books-only, the mode-toggle buttons inside Calendar, Suggestions, and Wish List are automatically hidden and each tab is locked to the active content type; switching back to Both restores all toggles

## What's new in v2.1

- **Notes** — add a private note and a "Suggested by" name to any movie or book; tap 💬 on any card; autocomplete suggests names you've used before
- **Rewatch / Reread flag** — mark movies and books you want to revisit with 🚩; filter your library to show only flagged items
- **Streaming Region** — choose your country in Settings so platform badges (Netflix, Disney+, Amazon, Apple) reflect what's actually available near you
- **Uniform filter bar** — all filter elements are the same height for a consistent look

## What's new in v2.0

- **My Books** — a full book library alongside movies; search via Google Books API with automatic Open Library fallback; cover images cached locally
- **Book Wish List** — queue books you want to read; mark as read to move them to your library
- **Book Suggestions** — personalised picks powered by the NYT Books API (optional key) with Open Library fallback
- **Calendar mode toggle** — switch the monthly calendar between your movie history and your book history
- **Library Tabs setting** — triple toggle (📚 🎭 🎬) to show Books only, Movies only, or both; data is never deleted when toggling
- **Trash separation** — deleted books appear in their own section in Trash, clearly separated from movies
- **Sidebar stats** — bottom-left shows Movies and Books counts with a larger font; no genres clutter

## Features

### Overview
- **Stats** — monthly and yearly counts of watched movies and read books, best month (with item count), top suggester (person whose recommendations appear most)
- **Hearts distribution** — bar chart of how many items have each heart rating (1–5), shown separately for Movies and Books
- **Average hearts** — prominently displayed average heart rating per content type
- **Monthly Activity** — bar chart covering the last 12 months; dual-coloured bars when both content types are enabled
- **Heart filter** — top-right filter scopes all stats to items with a minimum number of hearts
- **Responsive layout** — Movies and Books sections sit side by side on wide screens, stacked on narrow ones
- **Respects Library Tabs** — shows only the active content type(s) set in Settings

### Movies
- **My Movies** — add by searching IMDb or by IMDb/TMDB ID; track everything you've watched
- **Heart ratings (1–5)** — rate each title directly on the card; filter by minimum rating
- **Notes & Suggested by** — private notes per movie; remember who recommended it; filter your library by suggester
- **Rewatch flag** — mark movies for a future rewatch; filter to see only flagged ones
- **Wish List** — save movies to watch later; notes and suggester per entry; filter by suggester; streaming platform badges; group by platform view
- **Suggestions** *(beta)* — personalised picks scored across genre, director, rating, mood tags, actors, decade, language, and type; only your 3–5 heart titles shape the profile; platform filter
- **IMDb links** — click any card to open on IMDb

### Books
- **My Books** — search Google Books (fallback: Open Library); covers cached locally
- **Notes & Suggested by** — private notes per book; remember who recommended it; filter your library by suggester
- **Reread flag** — mark books for a future reread; filter to see only flagged ones
- **Book Wish List** — queue books to read; notes and suggester per entry; filter by suggester; mark as read to move to your library
- **Book Suggestions** *(beta)* — NYT bestseller lists scored across genre, author, rating, subject tags, language, decade, and series flag; falls back to Open Library trending if no NYT key is set
- **Google Books links** — click any book card to open on Google Books

### Shared
- **Calendar** — monthly grid of your watched/read history; hover for details; mode toggle between movies and books
- **Suggestions toggle** — switch the Suggestions tab between movie and book recommendations
- **Wish List toggle** — switch the Wish List tab between movies and books
- **Trash** — soft delete for both movies and books; restore or delete permanently; live badge count
- **Filters** — genre, year, type, sort, heart rating, IMDb/reader score across all tabs
- **Local storage** — all data lives in JSON files on your machine; nothing goes to the cloud

## Requirements

- [Node.js](https://nodejs.org/) v18 or later

## Installation

```bash
git clone https://github.com/IliasPa/Cinelog.git
cd Cinelog
npm install
```

## Running

**macOS — double-click launcher:**

```
start.command
```

This opens the app in your browser automatically.

**Or from the terminal:**

```bash
npm start
```

Then open [http://localhost:3737](http://localhost:3737) in your browser.

## Optional API Keys

Both keys are free and optional. Add them in **Settings**.

| Key | Where to get it | What it unlocks |
|-----|----------------|-----------------|
| **TMDB** | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Richer movie metadata, streaming platform badges, better movie suggestions |
| **NYT Books** | [developer.nytimes.com](https://developer.nytimes.com/) | NYT bestseller-based book suggestions (falls back to Open Library without it) |

## Data

| File | Contents |
|------|----------|
| `data/movies.json` | Your watched movie library |
| `data/books.json` | Your read book library |
| `data/wishlist.json` | Your movie wish list |
| `data/books-wishlist.json` | Your book wish list |
| `data/posters/` | Cached movie poster images |
| `data/book-covers/` | Cached book cover images |
| `data/key.json` | API keys and settings (TMDB, NYT, streaming region) |

All data files are excluded from git — your library stays private.

## Tech Stack

- **Backend** — Node.js + Express
- **Frontend** — plain HTML/CSS/JS (no framework, no build step)
- **Movie data** — [IMDb API](https://imdbapi.dev/) (free, no key) + optional TMDB v3
- **Book data** — Google Books API (free, no key) + Open Library API (free, no key)
- **Book suggestions** — NYT Books API (optional free key) + Open Library trending

---

## Changelog

### v3.0

- Redesigned suggestion algorithm (beta) for movies, series, and books
- Profile is built only from titles rated 3–5 hearts; lower-rated entries are ignored
- Rating multiplier: each contribution is weighted by `hearts / 5`, so heavily-loved titles pull harder on every dimension
- Movie scoring: genre (20%), director (20%), IMDb rating tiers ≥8/7/5 (15%), mood/tone tags via TMDB keywords (15%), actors (10%), decade (10%), language (5%), type (5%)
- Book scoring: genre (20%), author (20%), rating tiers (15%), subject tags (15%), language (8%), decade (5%), series flag (5%)
- Already-seen penalty: titles already in your library are hard-excluded (score = 0)
- TMDB details now fetch keywords alongside credits so tag matching works immediately for TMDB users
- TMDB recommendation seeds now only pull from your 3–5 heart entries

### v2.3

- Grid pages (My Movies, My Books, Suggestions, Wish List, Trash) now scroll the full page instead of squishing cards into a fixed-height container; cards render at their natural size regardless of how many items are in the list
- Poster/cover self-healing: at startup, the server scans all movies, books, wishlist entries, and book wishlist entries for missing or externally-linked images and re-downloads them; handles both never-downloaded files and `/api/` paths where the file was deleted from disk
- "Suggested by" filter dropdown added to My Movies, My Books, Wish List movies, and Wish List books; hidden until at least one item has a suggester recorded; updates in real time as notes are saved
- Notes button (💬) added to Wish List movie and book cards (top-left of poster), backed by new `/api/wishlist/:id/notes` and `/api/books-wishlist/:id/notes` endpoints

### v2.2

- Overview tab (first in sidebar) with per-type stats: monthly count, yearly count, best month, top suggester, hearts distribution chart, and large average hearts display
- Monthly Activity bar chart spanning the last 12 months — dual-colour bars (purple = movies, gold = books) when both types are active, single bar otherwise
- Heart filter on Overview — scopes all stats and charts to items with a minimum heart rating
- Overview sections shown side by side on wide screens (≥ 1100 px), stacked on narrow screens
- Library Tabs setting now also hides the mode-toggle button in Calendar, Suggestions, and Wish List when only one content type is active; switching back to Both restores all toggles

### v2.1

- Notes button (💬) on every movie and book card — stores a note and a "Suggested by" name; autocomplete from existing names
- Rewatch / Reread flag (🚩) on every card — toggle on/off; filter bar button to show flagged items only
- Streaming Region setting — pick your country; platform badges now show what's available in your region (requires TMDB key)
- Filter bar height fix — heart filter and flag filter now match the height of search inputs and dropdowns

### v2.0

- My Books tab with full CRUD, cover caching, Google Books + Open Library APIs
- Book Wish List with "Mark as Read" to move books to the library
- Book Suggestions via NYT bestseller lists (scored by taste) with Open Library fallback
- Calendar mode toggle to switch between movie and book history
- Suggestions tab toggle between movie and book suggestions
- Wish List tab toggle between movie and book wish lists
- Library Tabs setting: triple toggle to show Books only, Movies only, or both
- Trash separation: movies and books in clearly labelled sections
- Sidebar stats: Movies + Books counts, larger font, no genres

### v1.0

- Wish List tab with full CRUD, platform badges, group-by-platform view
- Calendar tab with monthly grid and hover tooltips
- Suggestions: full poster cards, platform badges, IMDb card links, type/genre/rating/platform filters
- Streaming platform data from TMDB
- "Add to Wish List" button in the Add Movie modal alongside "Add to Watched"
- Wishlist poster caching to disk; platform auto-refresh for existing entries

### v0.1

- Trash bin with restore and permanent delete
- Heart ratings (1–5) and heart filter
- Local poster caching to `data/posters/`
- Trash nav badge
- SVG favicon

### v0.0

- Initial release
- Library with IMDb search
- Heart ratings (1–5)
- IMDb links
- Filters (genre, year, sort, rating, IMDb score)
- Suggestions (personalized picks)
- Local JSON storage
