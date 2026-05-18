'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3737;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const MOVIES_FILE = path.join(DATA, 'movies.json');
const KEY_FILE = path.join(DATA, 'key.json');
const POSTERS_DIR = path.join(DATA, 'posters');

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.get('/cinelog_app_icon.svg', (req, res) => res.sendFile(path.join(ROOT, 'cinelog_app_icon.svg')));

// ── Storage ───────────────────────────────────────────────────────────────────

function getMovies() {
  try { return JSON.parse(fs.readFileSync(MOVIES_FILE, 'utf8')); } catch { return []; }
}
function saveMovies(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(MOVIES_FILE, JSON.stringify(list, null, 2));
}
function getSettings() {
  try { return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')); } catch { return {}; }
}
function saveSettings(obj) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(obj, null, 2));
}

async function cachePoster(movieId, url) {
  if (!url || !movieId) return null;
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
  for (const ext of ['jpg', 'png', 'webp']) {
    if (fs.existsSync(path.join(POSTERS_DIR, `${movieId}.${ext}`))) return `/api/posters/${movieId}`;
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    fs.writeFileSync(path.join(POSTERS_DIR, `${movieId}.${ext}`), Buffer.from(await r.arrayBuffer()));
    return `/api/posters/${movieId}`;
  } catch { return null; }
}

// ── IMDB (imdbapi.dev + IMDB suggestion API) ──────────────────────────────────

const IMDB_TYPE_MAP = {
  movie: 'movie', feature: 'movie', tvSeries: 'tvSeries',
  tvMiniSeries: 'tvMiniSeries', tvMovie: 'tvMovie', tvSpecial: 'tvSpecial', short: 'short'
};

async function imdbSearch(query) {
  const encoded = encodeURIComponent(query);
  const first = query.trim().charAt(0).toLowerCase().replace(/[^a-z0-9]/, '_');
  const url = `https://sg.media-imdb.com/suggestion/${first}/${encoded}.json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`IMDB search failed: ${r.status}`);
  const data = await r.json();
  return (data.d || [])
    .filter(item => item.qid && IMDB_TYPE_MAP[item.qid])
    .slice(0, 10)
    .map(item => ({
      imdbId: item.id,
      tmdbId: null,
      title: item.l,
      year: item.y || null,
      type: IMDB_TYPE_MAP[item.qid] || 'movie',
      poster: item.i?.imageUrl || null,
      cast: item.s || ''
    }));
}

async function imdbDetails(imdbId) {
  const r = await fetch(`https://api.imdbapi.dev/titles/${imdbId}`, {
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`IMDB API error: ${r.status}`);
  const d = await r.json();
  if (d.code) throw new Error(d.message || 'Not found');
  return {
    imdbId: d.id,
    tmdbId: null,
    title: d.primaryTitle,
    year: d.startYear || null,
    endYear: d.endYear || null,
    type: d.type || 'movie',
    genres: d.genres || [],
    rating: d.rating?.aggregateRating || null,
    voteCount: d.rating?.voteCount || 0,
    directors: (d.directors || []).slice(0, 3).map(x => ({ id: x.id, name: x.displayName })),
    stars: (d.stars || []).slice(0, 5).map(x => ({ id: x.id, name: x.displayName })),
    plot: d.plot || '',
    poster: d.primaryImage?.url || null,
    runtime: d.runtimeSeconds || null,
    source: 'imdb'
  };
}

async function imdbPopular(params = {}) {
  try {
    const qs = new URLSearchParams({ limit: '50', ...params });
    const r = await fetch(`https://api.imdbapi.dev/titles?${qs}`, {
      signal: AbortSignal.timeout(7000)
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data.titles || [];
  } catch {
    return [];
  }
}

// ── TMDB ──────────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

const TMDB_GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
};

const TMDB_GENRE_REVERSE = Object.fromEntries(
  Object.entries(TMDB_GENRE_MAP).map(([id, name]) => [name.toLowerCase(), parseInt(id)])
);

async function tmdbFetch(endpoint, apiKey, params = {}) {
  const qs = new URLSearchParams({ api_key: apiKey, language: 'en-US', ...params });
  const r = await fetch(`${TMDB_BASE}${endpoint}?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 401) throw new Error('You must grant a valid API key for TMDB.');
  if (!r.ok) throw new Error(`TMDB error ${r.status}`);
  return r.json();
}

async function tmdbSearch(query, apiKey) {
  const data = await tmdbFetch('/search/multi', apiKey, { query, include_adult: false });
  return (data.results || [])
    .filter(r => ['movie', 'tv'].includes(r.media_type))
    .slice(0, 10)
    .map(r => ({
      imdbId: null,
      tmdbId: r.id,
      title: r.title || r.name,
      year: parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || null,
      type: r.media_type === 'tv' ? 'tvSeries' : 'movie',
      poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
      cast: ''
    }));
}

async function tmdbDetails(tmdbId, mediaType, apiKey) {
  const isTv = mediaType === 'tvSeries' || mediaType === 'tv';
  const ep = isTv ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const [d, credits, ext] = await Promise.all([
    tmdbFetch(ep, apiKey),
    tmdbFetch(`${ep}/credits`, apiKey),
    tmdbFetch(`${ep}/external_ids`, apiKey)
  ]);
  const genres = (d.genres || []).map(g => g.name);
  const directors = isTv
    ? (d.created_by || []).slice(0, 3).map(c => ({ id: `tm_${c.id}`, name: c.name }))
    : (credits.crew || []).filter(c => c.job === 'Director').slice(0, 3).map(c => ({ id: `tm_${c.id}`, name: c.name }));
  const stars = (credits.cast || []).slice(0, 5).map(c => ({ id: `tm_${c.id}`, name: c.name }));
  return {
    imdbId: ext.imdb_id || null,
    tmdbId: d.id,
    title: d.title || d.name,
    year: parseInt((d.release_date || d.first_air_date || '').slice(0, 4)) || null,
    endYear: null,
    type: isTv ? 'tvSeries' : 'movie',
    genres,
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    voteCount: d.vote_count || 0,
    directors,
    stars,
    plot: d.overview || '',
    poster: d.poster_path ? `${TMDB_IMG}${d.poster_path}` : null,
    runtime: d.runtime ? d.runtime * 60 : (d.episode_run_time?.[0] ? d.episode_run_time[0] * 60 : null),
    source: 'tmdb'
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function buildProfile(watched) {
  const genres = {};
  const directorIds = new Set();
  const actorCounts = {};
  let ratingSum = 0, ratingCount = 0;

  for (const m of watched) {
    for (const g of (m.genres || [])) genres[g] = (genres[g] || 0) + 1;
    for (const d of (m.directors || [])) directorIds.add(d.id);
    for (const s of (m.stars || [])) actorCounts[s.id] = (actorCounts[s.id] || 0) + 1;
    if (m.rating) { ratingSum += m.rating; ratingCount++; }
  }

  const topActors = new Set(
    Object.entries(actorCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([id]) => id)
  );
  const avgRating = ratingCount ? ratingSum / ratingCount : 7;
  const genreTotal = Object.values(genres).reduce((a, b) => a + b, 0) || 1;

  return { genres, genreTotal, directorIds, topActors, avgRating };
}

function score(candidate, profile, watchedIds) {
  const cid = candidate.imdbId || candidate.tmdbId?.toString();
  if (!cid || watchedIds.has(cid)) return null;
  if (candidate.imdbId && watchedIds.has(candidate.imdbId)) return null;
  if (candidate.tmdbId && watchedIds.has(candidate.tmdbId?.toString())) return null;

  let points = 0;
  const reasons = [];

  // Genre (up to 40 pts)
  const matchGenres = [];
  for (const g of (candidate.genres || [])) {
    if (profile.genres[g]) {
      points += (profile.genres[g] / profile.genreTotal) * 40;
      matchGenres.push(g);
    }
  }
  if (matchGenres.length) reasons.push(`Genre: ${matchGenres.slice(0, 2).join(', ')}`);

  // Director (30 pts)
  const matchDirs = (candidate.directors || []).filter(d => profile.directorIds.has(d.id));
  if (matchDirs.length) { points += 30; reasons.push(`Director: ${matchDirs[0].name}`); }

  // Top actors (10 pts each, max 30)
  const matchActors = [];
  for (const s of (candidate.stars || [])) {
    if (profile.topActors.has(s.id)) { points += 10; matchActors.push(s.name); }
  }
  if (matchActors.length) reasons.push(`Stars: ${matchActors.slice(0, 2).join(', ')}`);

  // Rating (up to 20 pts)
  const r = candidate.rating || 5;
  points += Math.max(0, ((r - 5) / 5) * 20);

  return { points, reasons: reasons.length ? reasons : ['Popular pick'] };
}

// ── Suggestions ───────────────────────────────────────────────────────────────

async function suggestImdb(watched) {
  const profile = buildProfile(watched);
  const watchedIds = new Set([
    ...watched.map(m => m.imdbId).filter(Boolean),
    ...watched.map(m => m.tmdbId?.toString()).filter(Boolean)
  ]);

  const topGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a).slice(0, 4).map(([g]) => g);

  const lists = await Promise.all([
    ...topGenres.map(g => imdbPopular({ genres: g, titleType: 'movie' })),
    imdbPopular({ titleType: 'movie' })
  ]);

  const seen = new Set();
  const pool = [];
  for (const list of lists) {
    for (const item of list) {
      if (!seen.has(item.id) && !watchedIds.has(item.id)) {
        seen.add(item.id);
        pool.push(item);
      }
    }
  }

  // Pre-score with listing data (no director/actor info yet)
  const prescored = pool.map(item => ({
    imdbId: item.id, tmdbId: null,
    title: item.primaryTitle, year: item.startYear, type: item.type,
    genres: item.genres || [], rating: item.rating?.aggregateRating || null,
    directors: [], stars: [], plot: item.plot || '',
    poster: item.primaryImage?.url || null, runtime: item.runtimeSeconds || null
  })).map(c => {
    const s = score(c, profile, watchedIds);
    return s ? { ...c, ...s } : null;
  }).filter(Boolean).sort((a, b) => b.points - a.points);

  // Enrich top candidates with full details to get director/actor scores
  const top20 = prescored.slice(0, 20);
  const details = await Promise.allSettled(top20.map(c => imdbDetails(c.imdbId)));

  const enriched = details
    .map((r, i) => {
      if (r.status !== 'fulfilled') return top20[i];
      const det = r.value;
      const s = score(det, profile, watchedIds);
      return s ? { ...det, ...s } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);

  return enriched.length ? enriched : prescored.slice(0, 20);
}

async function suggestTmdb(watched, apiKey) {
  const profile = buildProfile(watched);
  const watchedIds = new Set([
    ...watched.map(m => m.imdbId).filter(Boolean),
    ...watched.map(m => m.tmdbId?.toString()).filter(Boolean)
  ]);

  const topGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a).slice(0, 3).map(([g]) => g);

  const topGenreIds = topGenres
    .map(g => TMDB_GENRE_REVERSE[g.toLowerCase()] ||
      Object.entries(TMDB_GENRE_REVERSE).find(([k]) => g.toLowerCase().includes(k))?.[1])
    .filter(Boolean);

  const tmdbWatched = watched.filter(m => m.tmdbId).slice(0, 5);

  const requests = [
    ...tmdbWatched.map(m =>
      tmdbFetch(`/movie/${m.tmdbId}/recommendations`, apiKey)
        .then(d => d.results || []).catch(() => [])
    ),
    topGenreIds.length
      ? tmdbFetch('/discover/movie', apiKey, {
          with_genres: topGenreIds.slice(0, 2).join('|'),
          sort_by: 'vote_average.desc', 'vote_count.gte': 200
        }).then(d => d.results || []).catch(() => [])
      : Promise.resolve([])
  ];

  const allLists = await Promise.all(requests);
  const seen = new Set();
  const pool = [];
  for (const list of allLists) {
    for (const r of list) {
      const id = r.id?.toString();
      if (!seen.has(id) && !watchedIds.has(id)) { seen.add(id); pool.push(r); }
    }
  }

  const detailResults = await Promise.allSettled(
    pool.slice(0, 40).map(r =>
      tmdbDetails(r.id, r.media_type === 'tv' ? 'tvSeries' : 'movie', apiKey)
    )
  );

  return detailResults
    .map(r => {
      if (r.status !== 'fulfilled') return null;
      const det = r.value;
      const s = score(det, profile, watchedIds);
      return s ? { ...det, ...s } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);
  try {
    const settings = getSettings();
    const results = settings.tmdb
      ? await tmdbSearch(q, settings.tmdb)
      : await imdbSearch(q);
    res.json(results);
  } catch (err) {
    console.error('Search:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/movie-details/:id', async (req, res) => {
  const { id } = req.params;
  const { type } = req.query;
  try {
    const settings = getSettings();
    let details;
    if (id.startsWith('tt')) {
      details = await imdbDetails(id);
    } else if (settings.tmdb) {
      details = await tmdbDetails(parseInt(id), type || 'movie', settings.tmdb);
    } else {
      return res.status(400).json({ error: 'TMDB API key required for TMDB movie IDs' });
    }
    res.json(details);
  } catch (err) {
    console.error('Details:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posters/:id', (req, res) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(req.params.id)) return res.status(400).end();
  for (const ext of ['jpg', 'png', 'webp']) {
    const p = path.join(POSTERS_DIR, `${req.params.id}.${ext}`);
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.status(404).end();
});

app.get('/api/movies', (req, res) => {
  const { type, year, genre, minRating, sort = 'addedAt', order = 'desc' } = req.query;
  let list = getMovies().filter(m => !m.deletedAt);
  if (type && type !== 'all') list = list.filter(m => m.type === type);
  if (year) list = list.filter(m => m.year === parseInt(year));
  if (genre) list = list.filter(m => m.genres?.includes(genre));
  if (minRating) list = list.filter(m => (m.rating || 0) >= parseFloat(minRating));
  list.sort((a, b) => {
    const av = a[sort] ?? 0, bv = b[sort] ?? 0;
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });
  res.json(list);
});

app.post('/api/movies', async (req, res) => {
  const { imdbId, tmdbId, type } = req.body;
  if (!imdbId && !tmdbId) return res.status(400).json({ error: 'imdbId or tmdbId required' });
  try {
    const movies = getMovies();
    if (imdbId && movies.find(m => m.imdbId === imdbId))
      return res.status(409).json({ error: 'Already in your list' });
    if (tmdbId && movies.find(m => m.tmdbId === tmdbId))
      return res.status(409).json({ error: 'Already in your list' });

    const settings = getSettings();
    let details;
    if (imdbId?.startsWith('tt')) {
      details = await imdbDetails(imdbId);
    } else if (tmdbId && settings.tmdb) {
      details = await tmdbDetails(tmdbId, type || 'movie', settings.tmdb);
    } else {
      return res.status(400).json({ error: 'Cannot fetch details. Add a TMDB API key in Settings.' });
    }

    const movie = { ...details, addedAt: new Date().toISOString() };
    const localPoster = await cachePoster(details.imdbId || details.tmdbId?.toString(), details.poster);
    if (localPoster) movie.poster = localPoster;
    movies.unshift(movie);
    saveMovies(movies);
    res.json(movie);
  } catch (err) {
    console.error('Add movie:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/movies/:id', (req, res) => {
  const { id } = req.params;
  const movies = getMovies();
  const movie = movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  movie.deletedAt = new Date().toISOString();
  saveMovies(movies);
  res.json({ ok: true });
});

app.get('/api/trash', (req, res) => {
  const trash = getMovies().filter(m => m.deletedAt);
  trash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  res.json(trash);
});

app.patch('/api/movies/:id/restore', (req, res) => {
  const { id } = req.params;
  const movies = getMovies();
  const movie = movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  delete movie.deletedAt;
  saveMovies(movies);
  res.json({ ok: true });
});

app.delete('/api/trash/:id', (req, res) => {
  const { id } = req.params;
  const movies = getMovies();
  const idx = movies.findIndex(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  movies.splice(idx, 1);
  saveMovies(movies);
  res.json({ ok: true });
});

app.delete('/api/trash', (req, res) => {
  saveMovies(getMovies().filter(m => !m.deletedAt));
  res.json({ ok: true });
});

app.patch('/api/movies/:id/hearts', (req, res) => {
  const { id } = req.params;
  const { hearts } = req.body;
  if (typeof hearts !== 'number' || hearts < 0 || hearts > 5) {
    return res.status(400).json({ error: 'hearts must be 0–5' });
  }
  const movies = getMovies();
  const movie = movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  movie.hearts = Math.round(hearts);
  saveMovies(movies);
  res.json({ ok: true, hearts: movie.hearts });
});

app.get('/api/suggestions', async (req, res) => {
  const watched = getMovies().filter(m => !m.deletedAt);
  if (!watched.length) return res.json([]);
  try {
    const settings = getSettings();
    const results = settings.tmdb
      ? await suggestTmdb(watched, settings.tmdb)
      : await suggestImdb(watched);
    res.json(results);
  } catch (err) {
    console.error('Suggestions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => res.json(getSettings()));

app.post('/api/settings', (req, res) => {
  const current = getSettings();
  const updated = { ...current, ...req.body };
  saveSettings(updated);
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`\n  🎬  Cinelog\n  → http://localhost:${PORT}\n`);
});
