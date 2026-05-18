# Cinelog v0.1

A personal movie library and discovery app that runs locally in your browser.

![Cinelog](cinelog_app_icon.svg)

## What's new in v0.1

- **Trash bin** — delete sends movies to Trash; restore them or delete permanently
- **Empty Trash** — clear all trashed movies in one click
- **Heart ratings (1–5)** — rate movies with hearts directly on each card
- **Heart filter** — filter your library by minimum heart rating
- **Local poster cache** — posters are downloaded once to `data/posters/` and served from disk (no repeated external requests)
- **Trash badge** — the Trash nav button shows a live count of trashed movies
- **SVG favicon**
- **Clearer TMDB error messages** — 401 now explicitly tells you to check your API key

## Features

- **Library** — add movies by searching IMDb, track what you've watched
- **User ratings** — give each movie 1–5 hearts after watching
- **IMDb links** — one-click to open any movie on IMDb
- **Filters** — filter by genre, year, sort order, your heart rating, and IMDb score
- **Discover** — personalized suggestions based on genres you watch, favourite directors, favourite actors, and film ratings
- **Local storage** — all data lives in a JSON file on your machine, nothing goes to the cloud

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

If you want richer metadata you can add a [TMDB](https://www.themoviedb.org/settings/api) API key in **Settings** (gear icon). TMDB is free for personal use.

## Data

Your movie library is stored at `data/movies.json`. Cached posters are stored in `data/posters/`. Both are excluded from git — your watch history stays private.

## Tech Stack

- **Backend** — Node.js + Express
- **Frontend** — plain HTML/CSS/JS (no framework, no build step)
- **Movie data** — [IMDb API](https://imdbapi.dev/) (free, no key) + optional TMDB v3

---

## Changelog

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
- Star ratings (1–5)
- IMDb links
- Filters (genre, year, sort, rating, IMDb score)
- Discover (personalized suggestions)
- Local JSON storage
