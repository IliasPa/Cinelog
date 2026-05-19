# Cinelog v2.1

A personal movie and book library app that runs locally in your browser.

![Cinelog](cinelog_app_icon.svg)

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

### Movies
- **My Movies** — add by searching IMDb or by IMDb/TMDB ID; track everything you've watched
- **Heart ratings (1–5)** — rate each title directly on the card; filter by minimum rating
- **Notes & Suggested by** — private notes per movie; remember who recommended it
- **Rewatch flag** — mark movies for a future rewatch; filter to see only flagged ones
- **Wish List** — save movies to watch later; streaming platform badges; group by platform view
- **Suggestions** — personalised picks based on your genres, directors, and actors; platform filter
- **IMDb links** — click any card to open on IMDb

### Books
- **My Books** — search Google Books (fallback: Open Library); covers cached locally
- **Notes & Suggested by** — private notes per book; remember who recommended it
- **Reread flag** — mark books for a future reread; filter to see only flagged ones
- **Book Wish List** — queue books to read; mark as read to move to your library
- **Book Suggestions** — NYT bestseller lists scored by your reading taste; falls back to Open Library trending if no NYT key is set
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
