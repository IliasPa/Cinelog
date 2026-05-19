# Cinelog v1.0

A personal movie library and discovery app that runs locally in your browser.

![Cinelog](cinelog_app_icon.svg)

## What's new in v1.0

- **Wish List** — queue movies you want to watch; add from the search modal or directly from Suggestions; mark as watched to move them to your library
- **Calendar** — monthly grid showing a thumbnail for every movie on the day it was added; hover for details; navigate by month
- **Suggestions overhaul** — streaming platform badges; filters for type, genre, IMDb rating, and platform; whole card clicks to IMDb
- **Streaming platforms** — Netflix, Disney+, Amazon, Apple badges on Suggestion and Wish List cards, resolved from TMDB across all regions (not just US)
- **Group by Platform** — toggle in the Wish List header to group your queue by streaming service; movies on multiple platforms appear in each group
- **Add Movie modal** — "Add to Watched" and "Add to Wish List" side by side so you can queue without watching
- **Poster caching for Wish List** — wishlist posters are saved to disk just like watched movies; suggestions use remote URLs only
- **Platform auto-refresh** — on startup, any wishlist entry missing platform data is resolved automatically via the TMDB `/find` endpoint

## Features

- **My Movies** — add movies by searching IMDb or by IMDb/TMDB ID; track everything you've watched
- **Heart ratings (1–5)** — rate each movie with hearts directly on the card; filter by minimum rating
- **Wish List** — save movies to watch later; streaming platform badges; group by platform view
- **Calendar** — see your watching history laid out on a monthly grid
- **Suggestions** — personalised picks based on your genres, directors, and actors; platform filter to find what's streamable
- **IMDb links** — click any card to open it on IMDb
- **Filters** — genre, year, type, sort order, heart rating, IMDb score across all tabs
- **Trash** — deleted movies go to Trash; restore or delete permanently; live badge count
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

## Optional: TMDB API Key

By default Cinelog uses the free IMDb API (no key required) for search and suggestions.

For richer metadata, streaming platform data, and better suggestions, add a free [TMDB](https://www.themoviedb.org/settings/api) API key in **Settings**.

## Data

| File                 | Contents                   |
| -------------------- | -------------------------- |
| `data/movies.json`   | Your watched movie library |
| `data/wishlist.json` | Your wish list             |
| `data/posters/`      | Cached poster images       |
| `data/key.json`      | TMDB API key (if set)      |

All data files are excluded from git — your watch history stays private.

## Tech Stack

- **Backend** — Node.js + Express
- **Frontend** — plain HTML/CSS/JS (no framework, no build step)
- **Movie data** — [IMDb API](https://imdbapi.dev/) (free, no key) + optional TMDB v3

---

## Changelog

### v1.0

- Wish List tab with full CRUD, platform badges, group-by-platform view
- Calendar tab with monthly grid and hover tooltips
- Suggestions: full poster cards, platform badges, IMDb card links, type/genre/rating/platform filters
- Streaming platform data from TMDB across all regions
- "Add to Wish List" button in the Add Movie modal alongside "Add to Watched"
- Wishlist poster caching to disk; platform auto-refresh for existing entries
- Unified button sizing (btn-primary / btn-secondary same height)

### v0.1

- Trash bin with restore and permanent delete
- Heart ratings (1–5) and heart filter
- Local poster caching to `data/posters/`
- Trash nav badge
- SVG favicon
- Clearer TMDB 401 error message

### v0.0

- Initial release
- Library with IMDb search
- Heart ratings (1–5)
- IMDb links
- Filters (genre, year, sort, rating, IMDb score)
- Suggestions (personalized picks)
- Local JSON storage
