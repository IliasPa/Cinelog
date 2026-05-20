'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3737;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const MOVIES_FILE = path.join(DATA, 'movies.json');
const WISHLIST_FILE = path.join(DATA, 'wishlist.json');
const KEY_FILE = path.join(DATA, 'key.json');
const POSTERS_DIR = path.join(DATA, 'posters');
const BOOKS_FILE = path.join(DATA, 'books.json');
const BOOK_COVERS_DIR = path.join(DATA, 'book-covers');
const BOOKS_WISHLIST_FILE = path.join(DATA, 'books-wishlist.json');

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
function getWishlist() {
  try { return JSON.parse(fs.readFileSync(WISHLIST_FILE, 'utf8')); } catch { return []; }
}
function saveWishlist(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(WISHLIST_FILE, JSON.stringify(list, null, 2));
}
function getBooks() {
  try { return JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8')); } catch { return []; }
}
function saveBooks(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(BOOKS_FILE, JSON.stringify(list, null, 2));
}
function getBookWishlist() {
  try { return JSON.parse(fs.readFileSync(BOOKS_WISHLIST_FILE, 'utf8')); } catch { return []; }
}
function saveBookWishlist(list) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(BOOKS_WISHLIST_FILE, JSON.stringify(list, null, 2));
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

// ── Book cover cache ──────────────────────────────────────────────────────────

async function cacheBookCover(bookId, url) {
  if (!url || !bookId) return null;
  const safeId = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  fs.mkdirSync(BOOK_COVERS_DIR, { recursive: true });
  for (const ext of ['jpg', 'png', 'webp']) {
    if (fs.existsSync(path.join(BOOK_COVERS_DIR, `${safeId}.${ext}`))) return `/api/book-covers/${safeId}`;
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    fs.writeFileSync(path.join(BOOK_COVERS_DIR, `${safeId}.${ext}`), Buffer.from(await r.arrayBuffer()));
    return `/api/book-covers/${safeId}`;
  } catch { return null; }
}

// ── Google Books API ──────────────────────────────────────────────────────────

function googleBooksItemToBook(item) {
  const info = item.volumeInfo || {};
  const links = info.imageLinks || {};
  const rawCover = links.thumbnail || links.smallThumbnail || null;
  const cover = rawCover ? rawCover.replace('http://', 'https://').replace('&zoom=1', '&zoom=2') : null;
  const isbn = (info.industryIdentifiers || [])
    .find(i => i.type === 'ISBN_13' || i.type === 'ISBN_10')?.identifier || null;
  const cats = (info.categories || []).flatMap(c => c.split(' / '));
  const genres = [...new Set(cats)].slice(0, 5);
  return {
    googleBooksId: item.id,
    openLibraryId: null,
    title: info.title || 'Unknown',
    authors: info.authors || [],
    year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) || null : null,
    genres,
    rating: info.averageRating || null,
    ratingCount: info.ratingsCount || 0,
    description: info.description || '',
    cover,
    publisher: info.publisher || '',
    pageCount: info.pageCount || null,
    isbn,
    itemType: 'book',
    source: 'google-books',
  };
}

async function googleBooksSearch(query) {
  const qs = new URLSearchParams({ q: query, maxResults: '10' });
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Google Books search failed: ${r.status}`);
  const data = await r.json();
  return (data.items || []).map(googleBooksItemToBook);
}

async function googleBooksDetails(volumeId) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Google Books details failed: ${r.status}`);
  return googleBooksItemToBook(await r.json());
}

// ── Open Library API (fallback) ───────────────────────────────────────────────

async function openLibrarySearch(query) {
  const qs = new URLSearchParams({
    q: query, limit: '10',
    fields: 'key,title,author_name,first_publish_year,subject,cover_i,isbn,publisher',
  });
  const r = await fetch(`https://openlibrary.org/search.json?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Open Library search failed: ${r.status}`);
  const data = await r.json();
  return (data.docs || []).map(doc => ({
    googleBooksId: null,
    openLibraryId: doc.key?.split('/').pop() || null,
    title: doc.title || 'Unknown',
    authors: doc.author_name || [],
    year: doc.first_publish_year || null,
    genres: (doc.subject || []).slice(0, 5),
    rating: null,
    ratingCount: 0,
    description: '',
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    publisher: (doc.publisher || [])[0] || '',
    pageCount: null,
    isbn: (doc.isbn || [])[0] || null,
    itemType: 'book',
    source: 'open-library',
  }));
}

async function openLibraryDetails(workId) {
  const r = await fetch(`https://openlibrary.org/works/${encodeURIComponent(workId)}.json`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Open Library details failed: ${r.status}`);
  const data = await r.json();
  let description = '';
  if (data.description) {
    description = typeof data.description === 'string' ? data.description : (data.description.value || '');
  }
  const coverId = (data.covers || [])[0];
  const genres = (data.subjects || [])
    .map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean).slice(0, 5);
  return {
    googleBooksId: null,
    openLibraryId: workId,
    title: data.title || 'Unknown',
    authors: [],
    year: data.first_publish_date ? parseInt(data.first_publish_date.match(/\d{4}/)?.[0]) || null : null,
    genres,
    rating: null,
    ratingCount: 0,
    description,
    cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
    publisher: '',
    pageCount: null,
    isbn: null,
    itemType: 'book',
    source: 'open-library',
  };
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

async function tmdbFindByImdbId(imdbId, apiKey) {
  try {
    const data = await tmdbFetch(`/find/${imdbId}`, apiKey, { external_source: 'imdb_id' });
    const movie = (data.movie_results || [])[0];
    const tv = (data.tv_results || [])[0];
    if (movie) return { id: movie.id, isTv: false };
    if (tv) return { id: tv.id, isTv: true };
    return null;
  } catch { return null; }
}

async function tmdbWatchProviders(tmdbId, isTv, apiKey, country = 'US') {
  try {
    const ep = isTv ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
    const data = await tmdbFetch(`${ep}/watch/providers`, apiKey);
    const PLATFORM_IDS = { 8: 'Netflix', 337: 'Disney+', 119: 'Amazon', 350: 'Apple' };
    const countryData = (data.results || {})[country] || {};
    const providers = countryData.flatrate || [];
    return [...new Set(providers.map(p => PLATFORM_IDS[p.provider_id]).filter(Boolean))];
  } catch { return []; }
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

async function suggestTmdb(watched, apiKey, country = 'US') {
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
    pool.slice(0, 40).map(r => {
      const isTv = r.media_type === 'tv';
      return Promise.all([
        tmdbDetails(r.id, isTv ? 'tvSeries' : 'movie', apiKey),
        tmdbWatchProviders(r.id, isTv, apiKey, country)
      ]);
    })
  );

  return detailResults
    .map(r => {
      if (r.status !== 'fulfilled') return null;
      const [det, platforms] = r.value;
      const s = score(det, profile, watchedIds);
      return s ? { ...det, platforms, ...s } : null;
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

app.patch('/api/movies/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes, suggestedBy } = req.body;
  const movies = getMovies();
  const movie = movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  movie.notes = typeof notes === 'string' ? notes : '';
  movie.suggestedBy = typeof suggestedBy === 'string' ? suggestedBy : '';
  saveMovies(movies);
  res.json({ ok: true });
});

app.patch('/api/movies/:id/rewatch', (req, res) => {
  const { id } = req.params;
  const movies = getMovies();
  const movie = movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  movie.rewatch = !movie.rewatch;
  saveMovies(movies);
  res.json({ ok: true, rewatch: movie.rewatch });
});

// ── Wishlist ──────────────────────────────────────────────────────────────────

app.get('/api/wishlist', (req, res) => res.json(getWishlist()));

app.post('/api/wishlist', async (req, res) => {
  const { imdbId, tmdbId, type } = req.body;
  if (!imdbId && !tmdbId) return res.status(400).json({ error: 'imdbId or tmdbId required' });
  try {
    const wishlist = getWishlist();
    if (imdbId && wishlist.find(m => m.imdbId === imdbId))
      return res.status(409).json({ error: 'Already in your wish list' });
    if (tmdbId && wishlist.find(m => m.tmdbId === tmdbId))
      return res.status(409).json({ error: 'Already in your wish list' });

    const settings = getSettings();
    let details;
    if (imdbId?.startsWith('tt')) {
      details = await imdbDetails(imdbId);
    } else if (tmdbId && settings.tmdb) {
      details = await tmdbDetails(tmdbId, type || 'movie', settings.tmdb);
    } else {
      return res.status(400).json({ error: 'Cannot fetch details. Add a TMDB API key in Settings.' });
    }

    let platforms = [];
    let resolvedTmdbId = details.tmdbId;
    let resolvedIsTv = details.type === 'tvSeries' || details.type === 'tvMiniSeries' || details.type === 'tvMovie';
    if (settings.tmdb && !resolvedTmdbId && details.imdbId) {
      const found = await tmdbFindByImdbId(details.imdbId, settings.tmdb);
      if (found) { resolvedTmdbId = found.id; resolvedIsTv = found.isTv; }
    }
    if (settings.tmdb && resolvedTmdbId) {
      platforms = await tmdbWatchProviders(resolvedTmdbId, resolvedIsTv, settings.tmdb, settings.country || 'US');
    }
    const movie = { ...details, tmdbId: resolvedTmdbId || details.tmdbId, platforms, addedAt: new Date().toISOString() };
    const localPoster = await cachePoster(details.imdbId || resolvedTmdbId?.toString(), details.poster);
    if (localPoster) movie.poster = localPoster;
    wishlist.unshift(movie);
    saveWishlist(wishlist);
    res.json(movie);
  } catch (err) {
    console.error('Add wishlist:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wishlist/refresh-platforms', async (req, res) => {
  const settings = getSettings();
  if (!settings.tmdb) return res.json({ updated: 0 });
  const wishlist = getWishlist();
  let updated = 0;
  for (const m of wishlist) {
    if ((m.platforms || []).length > 0) continue;
    let tmdbId = m.tmdbId;
    let isTv = m.type === 'tvSeries' || m.type === 'tvMiniSeries' || m.type === 'tvMovie';
    if (!tmdbId && m.imdbId) {
      const found = await tmdbFindByImdbId(m.imdbId, settings.tmdb);
      if (found) { tmdbId = found.id; isTv = found.isTv; if (!m.tmdbId) m.tmdbId = tmdbId; }
    }
    if (tmdbId) {
      const platforms = await tmdbWatchProviders(tmdbId, isTv, settings.tmdb, settings.country || 'US');
      m.platforms = platforms;
      updated++;
    }
  }
  saveWishlist(wishlist);
  res.json({ updated });
});

app.delete('/api/wishlist/:id', (req, res) => {
  const { id } = req.params;
  const wishlist = getWishlist();
  const idx = wishlist.findIndex(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  wishlist.splice(idx, 1);
  saveWishlist(wishlist);
  res.json({ ok: true });
});

app.patch('/api/wishlist/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes, suggestedBy } = req.body;
  const wishlist = getWishlist();
  const movie = wishlist.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  movie.notes = typeof notes === 'string' ? notes : '';
  movie.suggestedBy = typeof suggestedBy === 'string' ? suggestedBy : '';
  saveWishlist(wishlist);
  res.json({ ok: true });
});

app.patch('/api/wishlist/:id/hearts', (req, res) => {
  const { id } = req.params;
  const { hearts } = req.body;
  if (typeof hearts !== 'number' || hearts < 0 || hearts > 5)
    return res.status(400).json({ error: 'hearts must be 0–5' });
  const wishlist = getWishlist();
  const movie = wishlist.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  movie.hearts = Math.round(hearts);
  saveWishlist(wishlist);
  res.json({ ok: true, hearts: movie.hearts });
});

app.patch('/api/wishlist/:id/watched', (req, res) => {
  const { id } = req.params;
  const wishlist = getWishlist();
  const idx = wishlist.findIndex(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const movie = wishlist[idx];
  const movies = getMovies();
  const active = movies.filter(m => !m.deletedAt);
  if ((movie.imdbId && active.find(m => m.imdbId === movie.imdbId)) ||
      (movie.tmdbId && active.find(m => m.tmdbId === movie.tmdbId)))
    return res.status(409).json({ error: 'Already in your watched list' });
  wishlist.splice(idx, 1);
  const watched = { ...movie, addedAt: new Date().toISOString() };
  delete watched.platforms;
  movies.unshift(watched);
  saveMovies(movies);
  saveWishlist(wishlist);
  res.json(watched);
});

app.get('/api/suggestions', async (req, res) => {
  const watched = getMovies().filter(m => !m.deletedAt);
  if (!watched.length) return res.json([]);
  try {
    const settings = getSettings();
    const results = settings.tmdb
      ? await suggestTmdb(watched, settings.tmdb, settings.country || 'US')
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

// ── Book suggestions ──────────────────────────────────────────────────────────

function buildBookProfile(books) {
  const genres = {};
  const authors = new Set();
  for (const b of books) {
    for (const g of (b.genres || [])) genres[g] = (genres[g] || 0) + 1;
    for (const a of (b.authors || [])) authors.add(a.toLowerCase().trim());
  }
  const genreTotal = Object.values(genres).reduce((s, v) => s + v, 0) || 1;
  return { genres, genreTotal, authors };
}

async function resolveBookByIsbn(isbn) {
  if (!isbn) return null;
  try {
    const results = await googleBooksSearch(`isbn:${isbn}`);
    if (results.length > 0) return await googleBooksDetails(results[0].googleBooksId);
  } catch { /* fall through */ }
  try {
    const results = await openLibrarySearch(isbn);
    if (results.length > 0) return results[0];
  } catch { /* fall through */ }
  return null;
}

const NYT_BOOKS_BASE = 'https://api.nytimes.com/svc/books/v3';
const NYT_LISTS = [
  'hardcover-fiction',
  'hardcover-nonfiction',
  'combined-print-and-e-book-fiction',
  'combined-print-and-e-book-nonfiction',
];

async function nytBooksList(listName, apiKey) {
  const r = await fetch(
    `${NYT_BOOKS_BASE}/lists/current/${listName}.json?api-key=${apiKey}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!r.ok) throw new Error(`NYT Books API error ${r.status}`);
  const data = await r.json();
  return (data.results?.books || []).map(b => ({
    googleBooksId: null,
    openLibraryId: null,
    title: b.title || 'Unknown',
    authors: b.author ? [b.author] : [],
    year: null,
    genres: [],
    rating: null,
    ratingCount: 0,
    description: b.description || '',
    cover: b.book_image || null,
    publisher: b.publisher || '',
    pageCount: null,
    isbn: b.primary_isbn13 || b.primary_isbn10 || null,
    itemType: 'book',
    source: 'nyt',
    nytRank: b.rank,
    nytWeeksOnList: b.weeks_on_list || 0,
    nytListName: listName,
  }));
}

async function suggestBooksNyt(books, apiKey) {
  const profile = buildBookProfile(books);
  const readIsbns = new Set(books.map(b => b.isbn).filter(Boolean));
  const readIds = new Set([
    ...books.map(b => b.googleBooksId).filter(Boolean),
    ...books.map(b => b.openLibraryId).filter(Boolean),
  ]);

  const allLists = await Promise.allSettled(NYT_LISTS.map(l => nytBooksList(l, apiKey)));
  const seen = new Set();
  const pool = [];

  for (const res of allLists) {
    if (res.status !== 'fulfilled') continue;
    for (const book of res.value) {
      if (!book.isbn || seen.has(book.isbn) || readIsbns.has(book.isbn)) continue;
      seen.add(book.isbn);
      const authorBonus = (book.authors || []).some(a => profile.authors.has(a.toLowerCase().trim())) ? 30 : 0;
      const popularityScore = Math.min((book.nytWeeksOnList || 0) * 2, 20);
      pool.push({ ...book, points: authorBonus + popularityScore });
    }
  }

  return pool.sort((a, b) => b.points - a.points).slice(0, 20);
}

async function suggestBooksOpenLibrary(books) {
  const profile = buildBookProfile(books);
  const readIds = new Set([
    ...books.map(b => b.googleBooksId).filter(Boolean),
    ...books.map(b => b.openLibraryId).filter(Boolean),
    ...books.map(b => b.isbn).filter(Boolean),
  ]);

  try {
    const r = await fetch('https://openlibrary.org/trending/weekly.json?limit=40', {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('OL trending failed');
    const data = await r.json();

    const seen = new Set();
    const pool = [];

    for (const work of (data.works || [])) {
      const olId = work.key?.split('/').pop();
      if (!olId || seen.has(olId) || readIds.has(olId)) continue;
      seen.add(olId);

      const genreScore = (work.subject || []).reduce((sum, s) => {
        return sum + (profile.genres[s] ? (profile.genres[s] / profile.genreTotal) * 30 : 0);
      }, 0);
      const authorBonus = (work.author_name || []).some(a => profile.authors.has(a.toLowerCase().trim())) ? 30 : 0;

      pool.push({
        googleBooksId: null,
        openLibraryId: olId,
        title: work.title || 'Unknown',
        authors: work.author_name || [],
        year: work.first_publish_year || null,
        genres: (work.subject || []).slice(0, 5),
        rating: null,
        ratingCount: 0,
        description: '',
        cover: work.cover_i ? `https://covers.openlibrary.org/b/id/${work.cover_i}-M.jpg` : null,
        publisher: '',
        pageCount: null,
        isbn: null,
        itemType: 'book',
        source: 'open-library',
        points: genreScore + authorBonus,
      });
    }

    return pool.sort((a, b) => b.points - a.points).slice(0, 20);
  } catch (e) {
    console.error('OL trending:', e.message);
    return [];
  }
}

// ── Books ─────────────────────────────────────────────────────────────────────

app.get('/api/search-books', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);
  try {
    let results;
    try { results = await googleBooksSearch(q); }
    catch (e) {
      console.error('Google Books failed, trying Open Library:', e.message);
      results = await openLibrarySearch(q);
    }
    res.json(results);
  } catch (err) {
    console.error('Book search:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/book-details/:id', async (req, res) => {
  const { id } = req.params;
  const { source } = req.query;
  try {
    let details;
    if (source === 'open-library') {
      details = await openLibraryDetails(id);
    } else {
      try { details = await googleBooksDetails(id); }
      catch { details = await openLibraryDetails(id); }
    }
    res.json(details);
  } catch (err) {
    console.error('Book details:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/book-covers/:id', (req, res) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(req.params.id)) return res.status(400).end();
  for (const ext of ['jpg', 'png', 'webp']) {
    const p = path.join(BOOK_COVERS_DIR, `${req.params.id}.${ext}`);
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.status(404).end();
});

app.get('/api/books', (req, res) => {
  const { sort = 'addedAt', order = 'desc', genre, minRating } = req.query;
  let list = getBooks().filter(b => !b.deletedAt);
  if (genre) list = list.filter(b => b.genres?.includes(genre));
  if (minRating) list = list.filter(b => (b.rating || 0) >= parseFloat(minRating));
  list.sort((a, b) => {
    const av = a[sort] ?? '', bv = b[sort] ?? '';
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });
  res.json(list);
});

async function resolveAndAddBook(body, existingList, targetFile) {
  const { googleBooksId, openLibraryId, source, isbn } = body;
  if (!googleBooksId && !openLibraryId && !isbn)
    throw Object.assign(new Error('googleBooksId, openLibraryId, or isbn required'), { status: 400 });

  if (googleBooksId && existingList.find(b => b.googleBooksId === googleBooksId && !b.deletedAt))
    throw Object.assign(new Error('Already in your list'), { status: 409 });
  if (openLibraryId && existingList.find(b => b.openLibraryId === openLibraryId && !b.deletedAt))
    throw Object.assign(new Error('Already in your list'), { status: 409 });

  let details;
  if (googleBooksId && source !== 'open-library') {
    try { details = await googleBooksDetails(googleBooksId); }
    catch { details = openLibraryId ? await openLibraryDetails(openLibraryId) : null; }
  } else if (openLibraryId) {
    details = await openLibraryDetails(openLibraryId);
  } else if (isbn) {
    details = await resolveBookByIsbn(isbn);
    if (!details) {
      details = {
        googleBooksId: null, openLibraryId: null, isbn,
        title: body.title || 'Unknown', authors: body.authors || [],
        year: null, genres: [], rating: null, ratingCount: 0, description: body.description || '',
        cover: body.cover || null, publisher: '', pageCount: null,
        itemType: 'book', source: 'nyt',
      };
    }
  }
  if (!details) throw Object.assign(new Error('Could not fetch book details'), { status: 400 });

  const book = { ...details, addedAt: new Date().toISOString() };
  const coverId = (googleBooksId || openLibraryId || isbn || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const localCover = await cacheBookCover(coverId, details.cover);
  if (localCover) book.cover = localCover;
  return book;
}

app.post('/api/books', async (req, res) => {
  try {
    const books = getBooks();
    const book = await resolveAndAddBook(req.body, books, BOOKS_FILE);
    books.unshift(book);
    saveBooks(books);
    res.json(book);
  } catch (err) {
    console.error('Add book:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/books/:id', (req, res) => {
  const { id } = req.params;
  const books = getBooks();
  const book = books.find(b => b.googleBooksId === id || b.openLibraryId === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  book.deletedAt = new Date().toISOString();
  saveBooks(books);
  res.json({ ok: true });
});

app.patch('/api/books/:id/hearts', (req, res) => {
  const { id } = req.params;
  const { hearts } = req.body;
  if (typeof hearts !== 'number' || hearts < 0 || hearts > 5)
    return res.status(400).json({ error: 'hearts must be 0–5' });
  const books = getBooks();
  const book = books.find(b => b.googleBooksId === id || b.openLibraryId === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  book.hearts = Math.round(hearts);
  saveBooks(books);
  res.json({ ok: true, hearts: book.hearts });
});

app.patch('/api/books/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes, suggestedBy } = req.body;
  const books = getBooks();
  const book = books.find(b => b.googleBooksId === id || b.openLibraryId === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  book.notes = typeof notes === 'string' ? notes : '';
  book.suggestedBy = typeof suggestedBy === 'string' ? suggestedBy : '';
  saveBooks(books);
  res.json({ ok: true });
});

app.patch('/api/books/:id/reread', (req, res) => {
  const { id } = req.params;
  const books = getBooks();
  const book = books.find(b => b.googleBooksId === id || b.openLibraryId === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  book.rewatch = !book.rewatch;
  saveBooks(books);
  res.json({ ok: true, rewatch: book.rewatch });
});

app.get('/api/books-trash', (req, res) => {
  const trash = getBooks().filter(b => b.deletedAt);
  trash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  res.json(trash);
});

app.patch('/api/books/:id/restore', (req, res) => {
  const { id } = req.params;
  const books = getBooks();
  const book = books.find(b => b.googleBooksId === id || b.openLibraryId === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  delete book.deletedAt;
  saveBooks(books);
  res.json({ ok: true });
});

app.delete('/api/books-trash/:id', (req, res) => {
  const { id } = req.params;
  const books = getBooks();
  const idx = books.findIndex(b => b.googleBooksId === id || b.openLibraryId === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  books.splice(idx, 1);
  saveBooks(books);
  res.json({ ok: true });
});

app.delete('/api/books-trash', (req, res) => {
  saveBooks(getBooks().filter(b => !b.deletedAt));
  res.json({ ok: true });
});

// ── Book suggestions ──────────────────────────────────────────────────────────

app.get('/api/book-suggestions', async (req, res) => {
  const books = getBooks().filter(b => !b.deletedAt);
  try {
    const settings = getSettings();
    const results = settings.nyt
      ? await suggestBooksNyt(books, settings.nyt)
      : await suggestBooksOpenLibrary(books);
    res.json({ results, source: settings.nyt ? 'nyt' : 'open-library' });
  } catch (err) {
    console.error('Book suggestions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Books Wishlist ────────────────────────────────────────────────────────────

app.get('/api/books-wishlist', (req, res) => res.json(getBookWishlist()));

app.post('/api/books-wishlist', async (req, res) => {
  try {
    const wishlist = getBookWishlist();
    const book = await resolveAndAddBook(req.body, wishlist, BOOKS_WISHLIST_FILE);
    wishlist.unshift(book);
    saveBookWishlist(wishlist);
    res.json(book);
  } catch (err) {
    console.error('Add book wishlist:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/books-wishlist/:id', (req, res) => {
  const { id } = req.params;
  const wishlist = getBookWishlist();
  const idx = wishlist.findIndex(b => b.googleBooksId === id || b.openLibraryId === id || b.isbn === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  wishlist.splice(idx, 1);
  saveBookWishlist(wishlist);
  res.json({ ok: true });
});

app.patch('/api/books-wishlist/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes, suggestedBy } = req.body;
  const wishlist = getBookWishlist();
  const book = wishlist.find(b => b.googleBooksId === id || b.openLibraryId === id || b.isbn === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  book.notes = typeof notes === 'string' ? notes : '';
  book.suggestedBy = typeof suggestedBy === 'string' ? suggestedBy : '';
  saveBookWishlist(wishlist);
  res.json({ ok: true });
});

app.patch('/api/books-wishlist/:id/hearts', (req, res) => {
  const { id } = req.params;
  const { hearts } = req.body;
  if (typeof hearts !== 'number' || hearts < 0 || hearts > 5)
    return res.status(400).json({ error: 'hearts must be 0–5' });
  const wishlist = getBookWishlist();
  const book = wishlist.find(b => b.googleBooksId === id || b.openLibraryId === id || b.isbn === id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  book.hearts = Math.round(hearts);
  saveBookWishlist(wishlist);
  res.json({ ok: true, hearts: book.hearts });
});

app.patch('/api/books-wishlist/:id/read', (req, res) => {
  const { id } = req.params;
  const wishlist = getBookWishlist();
  const idx = wishlist.findIndex(b => b.googleBooksId === id || b.openLibraryId === id || b.isbn === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const book = wishlist[idx];
  const books = getBooks();
  const active = books.filter(b => !b.deletedAt);
  if ((book.googleBooksId && active.find(b => b.googleBooksId === book.googleBooksId)) ||
      (book.openLibraryId && active.find(b => b.openLibraryId === book.openLibraryId)))
    return res.status(409).json({ error: 'Already in your book list' });
  wishlist.splice(idx, 1);
  const read = { ...book, addedAt: new Date().toISOString() };
  books.unshift(read);
  saveBooks(books);
  saveBookWishlist(wishlist);
  res.json(read);
});

app.listen(PORT, () => {
  console.log(`\n  🎬  Cinelog\n  → http://localhost:${PORT}\n`);
  retryMissingPosters().catch(() => {});
});

function posterFileExists(movieId) {
  return ['jpg', 'png', 'webp'].some(ext =>
    fs.existsSync(path.join(POSTERS_DIR, `${movieId}.${ext}`))
  );
}

function coverFileExists(coverId) {
  const safe = coverId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return ['jpg', 'png', 'webp'].some(ext =>
    fs.existsSync(path.join(BOOK_COVERS_DIR, `${safe}.${ext}`))
  );
}

async function retryMissingPosters() {
  // ── Movies ──
  const movies = getMovies();
  let moviesChanged = false;
  for (const movie of movies) {
    if (movie.deletedAt) continue;
    const movieId = movie.imdbId || movie.tmdbId?.toString();
    if (!movieId) continue;
    const needsFile = movie.poster?.startsWith('/api/posters/') && !posterFileExists(movieId);
    const isExternal = movie.poster && !movie.poster.startsWith('/api/');
    if (!needsFile && !isExternal) continue;

    let local = null;
    if (isExternal) local = await cachePoster(movieId, movie.poster);
    if (!local && movie.imdbId?.startsWith('tt')) {
      try {
        const details = await imdbDetails(movie.imdbId);
        if (details.poster) local = await cachePoster(movieId, details.poster);
      } catch { /* ignore */ }
    }
    if (!local && movie.tmdbId && getSettings().tmdb) {
      try {
        const details = await tmdbDetails(movie.tmdbId, movie.type || 'movie', getSettings().tmdb);
        if (details.poster) local = await cachePoster(movieId, details.poster);
      } catch { /* ignore */ }
    }
    if (local) {
      movie.poster = local;
      moviesChanged = true;
      console.log(`  ✅  Poster cached: ${movie.title}`);
    } else {
      console.log(`  ⚠️  Could not cache poster: ${movie.title}`);
    }
  }
  if (moviesChanged) saveMovies(movies);

  // ── Wishlist ──
  const wishlist = getWishlist();
  let wishlistChanged = false;
  for (const movie of wishlist) {
    const movieId = movie.imdbId || movie.tmdbId?.toString();
    if (!movieId) continue;
    const needsFile = movie.poster?.startsWith('/api/posters/') && !posterFileExists(movieId);
    const isExternal = movie.poster && !movie.poster.startsWith('/api/');
    if (!needsFile && !isExternal) continue;

    let local = null;
    if (isExternal) local = await cachePoster(movieId, movie.poster);
    if (!local && movie.imdbId?.startsWith('tt')) {
      try {
        const details = await imdbDetails(movie.imdbId);
        if (details.poster) local = await cachePoster(movieId, details.poster);
      } catch { /* ignore */ }
    }
    if (local) { movie.poster = local; wishlistChanged = true; console.log(`  ✅  Wishlist poster cached: ${movie.title}`); }
  }
  if (wishlistChanged) saveWishlist(wishlist);

  // ── Books ──
  const books = getBooks();
  let booksChanged = false;
  for (const book of books) {
    if (book.deletedAt) continue;
    const coverId = (book.googleBooksId || book.openLibraryId || book.isbn || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!coverId) continue;
    const needsFile = book.cover?.startsWith('/api/book-covers/') && !coverFileExists(coverId);
    const isExternal = book.cover && !book.cover.startsWith('/api/');
    if (!needsFile && !isExternal) continue;

    let local = null;
    if (isExternal) local = await cacheBookCover(coverId, book.cover);
    if (!local && book.googleBooksId) {
      try {
        const details = await googleBooksDetails(book.googleBooksId);
        if (details.cover) local = await cacheBookCover(coverId, details.cover);
      } catch { /* ignore */ }
    }
    if (!local && book.openLibraryId) {
      try {
        const details = await openLibraryDetails(book.openLibraryId);
        if (details.cover) local = await cacheBookCover(coverId, details.cover);
      } catch { /* ignore */ }
    }
    if (local) { book.cover = local; booksChanged = true; console.log(`  ✅  Book cover cached: ${book.title}`); }
    else { console.log(`  ⚠️  Could not cache cover: ${book.title}`); }
  }
  if (booksChanged) saveBooks(books);

  // ── Books Wishlist ──
  const bwl = getBookWishlist();
  let bwlChanged = false;
  for (const book of bwl) {
    const coverId = (book.googleBooksId || book.openLibraryId || book.isbn || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!coverId) continue;
    const needsFile = book.cover?.startsWith('/api/book-covers/') && !coverFileExists(coverId);
    const isExternal = book.cover && !book.cover.startsWith('/api/');
    if (!needsFile && !isExternal) continue;

    let local = null;
    if (isExternal) local = await cacheBookCover(coverId, book.cover);
    if (!local && book.googleBooksId) {
      try {
        const details = await googleBooksDetails(book.googleBooksId);
        if (details.cover) local = await cacheBookCover(coverId, details.cover);
      } catch { /* ignore */ }
    }
    if (local) { book.cover = local; bwlChanged = true; console.log(`  ✅  Book wishlist cover cached: ${book.title}`); }
  }
  if (bwlChanged) saveBookWishlist(bwl);
}
