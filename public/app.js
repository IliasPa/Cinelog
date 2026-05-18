'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  section: 'movies',
  movies: [],
  suggestions: [],
  settings: {},
  filters: { type: '', year: '', genre: '', minRating: '', sort: 'addedAt', order: 'desc', q: '' },
  modal: { open: false, results: [], selected: null },
  loading: { movies: false, suggestions: false }
};

// ── API client ────────────────────────────────────────────────────────────────

const api = {
  async req(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  },
  get: (url) => api.req('GET', url),
  post: (url, body) => api.req('POST', url, body),
  del: (url) => api.req('DELETE', url),
  search: (q) => api.get(`/api/search?q=${encodeURIComponent(q)}`),
  movieDetails: (id, type) => api.get(`/api/movie-details/${id}?type=${encodeURIComponent(type || '')}`),
  getMovies(filters = {}) {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    delete params.q;
    const qs = new URLSearchParams(params);
    return api.get(`/api/movies?${qs}`);
  },
  addMovie: (data) => api.post('/api/movies', data),
  removeMovie: (id) => api.del(`/api/movies/${id}`),
  getSuggestions: () => api.get('/api/suggestions'),
  getSettings: () => api.get('/api/settings'),
  saveSettings: (data) => api.post('/api/settings', data)
};

// ── Utils ─────────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function el(id) { return document.getElementById(id); }

function formatRuntime(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function typeLabel(type) {
  return { movie: 'Movie', tvSeries: 'TV Series', tvMiniSeries: 'Mini Series', tvMovie: 'TV Movie', tvSpecial: 'TV Special', short: 'Short' }[type] || (type || 'Movie');
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderSidebar() {
  const genreCount = new Set(state.movies.flatMap(m => m.genres || [])).size;
  el('sidebar-stats').innerHTML = state.movies.length
    ? `<div class="stats">
        <div class="stat-item">
          <span class="stat-num">${state.movies.length}</span>
          <span class="stat-label">movies</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">${genreCount}</span>
          <span class="stat-label">genres</span>
        </div>
      </div>`
    : '';
}

function movieCard(m, isSuggestion) {
  const poster = m.poster
    ? `<img class="poster" src="${esc(m.poster)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const noPostDisplay = m.poster ? 'none' : 'flex';
  const noPoster = `<div class="no-poster" style="display:${noPostDisplay}">🎬</div>`;

  const genreHtml = (m.genres || []).slice(0, 3)
    .map(g => `<span class="genre-tag">${esc(g)}</span>`).join('');

  const reasonsHtml = (m.reasons || []).length
    ? `<div class="reasons">${(m.reasons || []).map(r => `<span class="reason-pill">${esc(r)}</span>`).join('')}</div>`
    : '';

  const movieId = esc(m.imdbId || m.tmdbId || '');

  const action = isSuggestion
    ? `<button class="btn-small btn-add-suggestion"
         data-imdb="${esc(m.imdbId || '')}"
         data-tmdb="${esc(m.tmdbId || '')}"
         data-type="${esc(m.type || 'movie')}">+ Watched</button>`
    : `<button class="btn-small btn-remove" data-id="${movieId}">Remove</button>`;

  return `
    <div class="movie-card">
      <div class="poster-wrap">
        ${poster}${noPoster}
        <div class="card-overlay">
          ${m.rating ? `<span class="rating-badge">★ ${Number(m.rating).toFixed(1)}</span>` : '<span></span>'}
          <span class="type-badge">${esc(typeLabel(m.type))}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(m.title)}</h3>
        <div class="card-meta">
          ${m.year ? `<span>${m.year}</span>` : ''}
          ${m.runtime ? `<span>${formatRuntime(m.runtime)}</span>` : ''}
        </div>
        <div class="genres-list">${genreHtml}</div>
        ${m.directors?.length ? `<div class="directors">Dir: ${esc(m.directors.map(d => d.name).join(', '))}</div>` : ''}
        ${m.plot ? `<div class="plot">${esc(m.plot.slice(0, 110))}${m.plot.length > 110 ? '…' : ''}</div>` : ''}
        ${reasonsHtml}
        <div class="card-footer">${action}</div>
      </div>
    </div>`;
}

function renderMovies() {
  const grid = el('movies-grid');
  if (state.loading.movies) {
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading…</span></div>';
    return;
  }
  let list = state.movies;
  if (state.filters.q) {
    const q = state.filters.q.toLowerCase();
    list = list.filter(m => m.title?.toLowerCase().includes(q));
  }
  if (!list.length) {
    grid.innerHTML = state.movies.length
      ? '<div class="empty"><span>No movies match your filters.</span></div>'
      : `<div class="empty">
           <span>No movies yet.</span>
           <span>Click <strong>+ Add Movie</strong> to get started.</span>
         </div>`;
    return;
  }
  grid.innerHTML = list.map(m => movieCard(m, false)).join('');
}

function updateFilterOptions() {
  const years = [...new Set(state.movies.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
  const genres = [...new Set(state.movies.flatMap(m => m.genres || []))].sort();

  el('filter-year').innerHTML = '<option value="">All Years</option>'
    + years.map(y => `<option value="${y}" ${state.filters.year == y ? 'selected' : ''}>${y}</option>`).join('');

  el('filter-genre').innerHTML = '<option value="">All Genres</option>'
    + genres.map(g => `<option value="${g}" ${state.filters.genre === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
}

function renderSuggestions() {
  const grid = el('suggestions-grid');
  if (state.loading.suggestions) {
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Finding recommendations… this may take a moment</span></div>';
    return;
  }
  if (!state.movies.length) {
    grid.innerHTML = '<div class="empty"><span>Add some movies to your watched list first to get suggestions.</span></div>';
    return;
  }
  if (!state.suggestions.length) {
    grid.innerHTML = '<div class="empty"><span>No suggestions found. Try adding more movies to your list.</span></div>';
    return;
  }
  grid.innerHTML = state.suggestions.map(m => movieCard(m, true)).join('');
}

function renderSettings() {
  el('setting-tmdb').value = state.settings.tmdb || '';
  const hasKey = Boolean(state.settings.tmdb);
  el('data-source').textContent = hasKey ? 'TMDB (rich metadata, active)' : 'IMDb via imdbapi.dev (free)';
  el('source-dot').style.background = hasKey ? 'var(--primary)' : 'var(--success)';
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal() {
  state.modal = { open: true, results: [], selected: null };
  el('modal-overlay').classList.remove('hidden');
  el('search-results').innerHTML = '';
  el('search-input').value = '';
  el('movie-preview').classList.add('hidden');
  el('modal-search-panel').style.display = '';
  setTimeout(() => el('search-input').focus(), 50);
}

function closeModal() {
  state.modal.open = false;
  el('modal-overlay').classList.add('hidden');
}

function showSearchResults(results) {
  state.modal.results = results;
  if (!results.length) {
    el('search-results').innerHTML = '<div class="no-results">No results found. Try a different title, or paste an IMDb ID (e.g. tt1375666).</div>';
    return;
  }
  el('search-results').innerHTML = results.map(r => `
    <div class="search-result" data-imdb="${esc(r.imdbId || '')}" data-tmdb="${esc(r.tmdbId || '')}" data-type="${esc(r.type || 'movie')}">
      <div class="result-poster">
        ${r.poster
          ? `<img src="${esc(r.poster)}" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="no-poster-sm">🎬</div>`}
      </div>
      <div class="result-info">
        <div class="result-title">${esc(r.title)}</div>
        <div class="result-meta">
          ${r.year ? `<span>${r.year}</span>` : ''}
          <span class="type-badge-sm">${esc(typeLabel(r.type))}</span>
          ${r.cast ? `<span class="cast-hint">${esc(r.cast)}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
}

async function showMoviePreview(imdbId, tmdbId, type) {
  el('modal-search-panel').style.display = 'none';
  el('movie-preview').classList.remove('hidden');
  el('movie-preview').innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const id = imdbId || tmdbId;
    const details = await api.movieDetails(id, type);
    state.modal.selected = details;

    el('movie-preview').innerHTML = `
      <button class="btn-link" id="back-btn">← Back to results</button>
      <div class="preview-content">
        <div class="preview-poster">
          ${details.poster
            ? `<img src="${esc(details.poster)}" alt="${esc(details.title)}">`
            : `<div class="no-poster-lg">🎬</div>`}
        </div>
        <div class="preview-info">
          <h2>${esc(details.title)}</h2>
          <div class="preview-meta">
            ${details.year ? `<span>${details.year}</span>` : ''}
            ${details.runtime ? `<span>${formatRuntime(details.runtime)}</span>` : ''}
            <span class="type-badge">${esc(typeLabel(details.type))}</span>
            ${details.rating ? `<span class="rating-badge">★ ${Number(details.rating).toFixed(1)}</span>` : ''}
          </div>
          <div class="genres-list" style="margin-bottom:4px">
            ${(details.genres || []).map(g => `<span class="genre-tag">${esc(g)}</span>`).join('')}
          </div>
          ${details.directors?.length
            ? `<p><strong>Director:</strong> ${esc(details.directors.map(d => d.name).join(', '))}</p>` : ''}
          ${details.stars?.length
            ? `<p><strong>Stars:</strong> ${esc(details.stars.slice(0, 3).map(s => s.name).join(', '))}</p>` : ''}
          ${details.plot ? `<p class="preview-plot">${esc(details.plot)}</p>` : ''}
          <button id="btn-confirm-add" class="btn-primary" style="margin-top:14px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add to Watched
          </button>
        </div>
      </div>`;

    el('back-btn').addEventListener('click', () => {
      el('movie-preview').classList.add('hidden');
      el('modal-search-panel').style.display = '';
    });

    el('btn-confirm-add').addEventListener('click', () => confirmAdd(details));
  } catch (err) {
    el('movie-preview').innerHTML = `
      <button class="btn-link" id="back-btn">← Back to results</button>
      <div class="error" style="margin-top:12px">Failed to load details: ${esc(err.message)}</div>`;
    el('back-btn').addEventListener('click', () => {
      el('movie-preview').classList.add('hidden');
      el('modal-search-panel').style.display = '';
    });
  }
}

async function confirmAdd(details) {
  const btn = el('btn-confirm-add');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner-sm" style="display:inline-block"></div> Adding…`;
  try {
    const movie = await api.addMovie({ imdbId: details.imdbId, tmdbId: details.tmdbId, type: details.type });
    state.movies.unshift(movie);
    closeModal();
    goToSection('movies');
    renderMovies();
    updateFilterOptions();
    renderSidebar();
    showToast(`"${details.title}" added to your list!`, 'success');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to Watched`;
    showToast(err.message, 'error');
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  el('toast-container').appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goToSection(name) {
  state.section = name;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  el(`section-${name}`)?.classList.remove('hidden');
  document.querySelector(`.nav-btn[data-section="${name}"]`)?.classList.add('active');
  if (name === 'suggestions' && !state.suggestions.length) loadSuggestions();
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadMovies() {
  state.loading.movies = true;
  renderMovies();
  try {
    state.movies = await api.getMovies(state.filters);
  } catch (err) {
    showToast(err.message, 'error');
  }
  state.loading.movies = false;
  renderMovies();
  updateFilterOptions();
  renderSidebar();
}

async function loadSuggestions() {
  state.loading.suggestions = true;
  renderSuggestions();
  try {
    state.suggestions = await api.getSuggestions();
  } catch (err) {
    showToast(`Suggestions failed: ${err.message}`, 'error');
  }
  state.loading.suggestions = false;
  renderSuggestions();
}

async function loadSettings() {
  try {
    state.settings = await api.getSettings();
    renderSettings();
  } catch { /* ignore */ }
}

// ── Remove movie ──────────────────────────────────────────────────────────────

async function removeMovie(id) {
  const movie = state.movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  if (!confirm(`Remove "${movie?.title || 'this movie'}" from your watched list?`)) return;
  try {
    await api.removeMovie(id);
    state.movies = state.movies.filter(m => m.imdbId !== id && m.tmdbId?.toString() !== id);
    renderMovies();
    updateFilterOptions();
    renderSidebar();
    showToast('Movie removed', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Search (debounced) ────────────────────────────────────────────────────────

const doSearch = debounce(async (query) => {
  if (!query.trim()) { el('search-results').innerHTML = ''; return; }
  el('search-spinner').classList.remove('hidden');
  el('search-results').innerHTML = '';
  try {
    const results = await api.search(query);
    showSearchResults(results);
  } catch (err) {
    el('search-results').innerHTML = `<div class="no-results">Search error: ${esc(err.message)}</div>`;
  } finally {
    el('search-spinner').classList.add('hidden');
  }
}, 380);

// ── Event wiring ──────────────────────────────────────────────────────────────

function init() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => goToSection(btn.dataset.section));
  });

  // Add movie button
  el('btn-add').addEventListener('click', openModal);

  // Modal close
  el('modal-overlay').addEventListener('click', e => { if (e.target === el('modal-overlay')) closeModal(); });
  el('modal-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.modal.open) closeModal(); });

  // Search input
  el('search-input').addEventListener('input', e => {
    const q = e.target.value.trim();
    if (/^tt\d+$/.test(q)) {
      showMoviePreview(q, null, 'movie');
    } else {
      doSearch(e.target.value);
    }
  });

  // Click on search result
  el('search-results').addEventListener('click', e => {
    const result = e.target.closest('.search-result');
    if (result) showMoviePreview(result.dataset.imdb || null, result.dataset.tmdb || null, result.dataset.type);
  });

  // Filters
  el('search-movies').addEventListener('input', debounce(e => { state.filters.q = e.target.value; renderMovies(); }, 250));
  el('filter-type').addEventListener('change', e => { state.filters.type = e.target.value; loadMovies(); });
  el('filter-year').addEventListener('change', e => { state.filters.year = e.target.value; loadMovies(); });
  el('filter-genre').addEventListener('change', e => { state.filters.genre = e.target.value; loadMovies(); });
  el('filter-rating').addEventListener('change', e => { state.filters.minRating = e.target.value; loadMovies(); });
  el('filter-sort').addEventListener('change', e => { state.filters.sort = e.target.value; loadMovies(); });

  // Remove movie
  el('movies-grid').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove');
    if (btn) removeMovie(btn.dataset.id);
  });

  // Add from suggestions
  el('suggestions-grid').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-add-suggestion');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Adding…';
    try {
      const movie = await api.addMovie({
        imdbId: btn.dataset.imdb || undefined,
        tmdbId: btn.dataset.tmdb || undefined,
        type: btn.dataset.type || 'movie'
      });
      state.movies.unshift(movie);
      btn.textContent = '✓ Added';
      btn.classList.add('added');
      updateFilterOptions();
      renderSidebar();
      showToast(`"${movie.title}" added!`, 'success');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '+ Watched';
      showToast(err.message, 'error');
    }
  });

  // Refresh suggestions
  el('btn-refresh').addEventListener('click', () => { state.suggestions = []; loadSuggestions(); });

  // Settings form
  el('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      state.settings = await api.saveSettings({ tmdb: el('setting-tmdb').value.trim() });
      renderSettings();
      state.suggestions = [];
      showToast('Settings saved!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Save Settings';
  });

  // Toggle API key visibility
  el('toggle-key').addEventListener('click', () => {
    const inp = el('setting-tmdb');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Clear key button
  el('btn-clear-key').addEventListener('click', async () => {
    if (!confirm('Remove the TMDB API key?')) return;
    try {
      state.settings = await api.saveSettings({ tmdb: '' });
      renderSettings();
      state.suggestions = [];
      showToast('API key removed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Initial data load
  Promise.all([loadMovies(), loadSettings()]);
}

init();
