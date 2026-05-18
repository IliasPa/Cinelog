'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  section: 'movies',
  movies: [],
  suggestions: [],
  trash: [],
  settings: {},
  filters: { type: '', year: '', genre: '', minRating: '', sort: 'addedAt', order: 'desc', q: '', minHearts: 0 },
  modal: { open: false, results: [], selected: null },
  loading: { movies: false, suggestions: false, trash: false }
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
  patch: (url, body) => api.req('PATCH', url, body),
  setHearts: (id, hearts) => api.patch(`/api/movies/${encodeURIComponent(id)}/hearts`, { hearts }),
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
  saveSettings: (data) => api.post('/api/settings', data),
  getTrash: () => api.get('/api/trash'),
  restoreMovie: (id) => api.patch(`/api/movies/${encodeURIComponent(id)}/restore`, {}),
  deleteForever: (id) => api.del(`/api/trash/${encodeURIComponent(id)}`),
  emptyTrash: () => api.del('/api/trash')
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

function movieCard(m, mode) {
  // mode: 'watched' | 'suggestion' | 'trash'
  const isTrash = mode === 'trash';
  const isSuggestion = mode === 'suggestion';
  const movieId = esc(m.imdbId || m.tmdbId || '');
  const poster = m.poster
    ? `<img class="poster" src="${esc(m.poster)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const noPostDisplay = m.poster ? 'none' : 'flex';
  const noPoster = `<div class="no-poster" style="display:${noPostDisplay}">🎬</div>`;
  const genreHtml = (m.genres || []).slice(0, 3).map(g => `<span class="genre-tag">${esc(g)}</span>`).join('');
  const reasonsHtml = (m.reasons || []).length
    ? `<div class="reasons">${m.reasons.map(r => `<span class="reason-pill">${esc(r)}</span>`).join('')}</div>`
    : '';

  const heartsHtml = (!isSuggestion && !isTrash) ? `
    <div class="card-hearts" data-id="${movieId}">
      ${[5,4,3,2,1].map(n => `<span class="card-heart${(m.hearts||0)>=n?' filled':''}" data-val="${n}">♥</span>`).join('')}
    </div>` : '';

  const action = isSuggestion
    ? `<div class="card-footer"><button class="btn-small btn-add-suggestion"
         data-imdb="${esc(m.imdbId || '')}"
         data-tmdb="${esc(m.tmdbId || '')}"
         data-type="${esc(m.type || 'movie')}">+ Watched</button></div>`
    : isTrash
    ? `<div class="trash-actions">
        <button class="btn-small btn-restore" data-id="${movieId}">↩ Restore</button>
        <button class="btn-small btn-delete-forever" data-id="${movieId}">✕ Delete Forever</button>
      </div>`
    : '';

  return `
    <div class="movie-card" data-id="${movieId}" data-imdb="${esc(m.imdbId || '')}"${m.imdbId ? ' style="cursor:pointer"' : ''}>
      <div class="poster-wrap">
        ${poster}${noPoster}
        <div class="card-overlay">
          ${m.rating ? `<span class="rating-badge">★ ${Number(m.rating).toFixed(1)}</span>` : '<span></span>'}
          <span class="type-badge">${esc(typeLabel(m.type))}</span>
        </div>
        ${(!isSuggestion && !isTrash) ? `<button class="btn-remove-x" data-id="${movieId}" title="Move to Trash">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>` : ''}
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
        ${heartsHtml}
        ${action}
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
  if (state.filters.minHearts > 0) {
    list = list.filter(m => (m.hearts || 0) >= state.filters.minHearts);
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
  grid.innerHTML = list.map(m => movieCard(m, 'watched')).join('');
}

function renderHeartFilter() {
  const n = state.filters.minHearts;
  document.querySelectorAll('#heart-filter .hf-heart').forEach(h => {
    h.classList.toggle('filled', parseInt(h.dataset.val) <= n);
  });
  el('heart-filter').classList.toggle('active', n > 0);
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
  grid.innerHTML = state.suggestions.map(m => movieCard(m, 'suggestion')).join('');
}

function renderSettings() {
  el('setting-tmdb').value = state.settings.tmdb || '';
  const hasKey = Boolean(state.settings.tmdb);
  el('data-source').textContent = hasKey ? 'TMDB (rich metadata, active)' : 'IMDb via imdbapi.dev (free)';
  el('source-dot').style.background = hasKey ? 'var(--primary)' : 'var(--success)';
}

function renderTrash() {
  const grid = el('trash-grid');
  if (state.loading.trash) {
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading…</span></div>';
    return;
  }
  if (!state.trash.length) {
    grid.innerHTML = '<div class="empty"><span>Trash is empty.</span></div>';
    return;
  }
  grid.innerHTML = state.trash.map(m => movieCard(m, 'trash')).join('');
}

function updateTrashBadge() {
  const badge = el('trash-count');
  const count = state.trash.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? '' : 'none';
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
  if (name === 'trash') loadTrash();
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

async function loadTrash() {
  state.loading.trash = true;
  renderTrash();
  try {
    state.trash = await api.getTrash();
  } catch (err) {
    showToast(err.message, 'error');
  }
  state.loading.trash = false;
  renderTrash();
  updateTrashBadge();
}

// ── Remove movie ──────────────────────────────────────────────────────────────

async function removeMovie(id) {
  const movie = state.movies.find(m => m.imdbId === id || m.tmdbId?.toString() === id);
  try {
    await api.removeMovie(id);
    state.movies = state.movies.filter(m => m.imdbId !== id && m.tmdbId?.toString() !== id);
    if (movie) {
      movie.deletedAt = new Date().toISOString();
      state.trash.unshift(movie);
    }
    renderMovies();
    updateFilterOptions();
    renderSidebar();
    updateTrashBadge();
    showToast('Moved to Trash', 'success');
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

  // Remove movie (X button on poster)
  el('movies-grid').addEventListener('click', async e => {
    const removeBtn = e.target.closest('.btn-remove-x');
    if (removeBtn) { removeMovie(removeBtn.dataset.id); return; }
    if (!e.target.closest('button, .card-heart')) {
      const imdbId = e.target.closest('.movie-card')?.dataset.imdb;
      if (imdbId) { window.open(`https://www.imdb.com/title/${imdbId}/`, '_blank'); return; }
    }

    // Heart rating on card
    const heart = e.target.closest('.card-heart');
    if (heart) {
      const heartsEl = heart.closest('.card-hearts');
      const id = heartsEl?.dataset.id;
      if (!id) return;
      const val = parseInt(heart.dataset.val);
      const movie = state.movies.find(m => (m.imdbId || m.tmdbId?.toString()) === id);
      if (!movie) return;
      const newVal = movie.hearts === val ? 0 : val;
      try {
        await api.setHearts(id, newVal);
        movie.hearts = newVal;
        // Re-render just the hearts row in-place for instant feedback
        heartsEl.querySelectorAll('.card-heart').forEach(h => {
          h.classList.toggle('filled', parseInt(h.dataset.val) <= newVal);
        });
        if (state.filters.minHearts > 0) renderMovies(); // reapply filter
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Heart filter (in filter bar)
  el('heart-filter').addEventListener('click', e => {
    const h = e.target.closest('.hf-heart');
    if (!h) return;
    const val = parseInt(h.dataset.val);
    state.filters.minHearts = state.filters.minHearts === val ? 0 : val;
    renderHeartFilter();
    renderMovies();
  });

  // Add from suggestions
  el('suggestions-grid').addEventListener('click', async e => {
    if (!e.target.closest('button')) {
      const imdbId = e.target.closest('.movie-card')?.dataset.imdb;
      if (imdbId) { window.open(`https://www.imdb.com/title/${imdbId}/`, '_blank'); return; }
    }
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

  // Trash grid (restore / delete forever)
  el('trash-grid').addEventListener('click', async e => {
    if (!e.target.closest('button')) {
      const imdbId = e.target.closest('.movie-card')?.dataset.imdb;
      if (imdbId) { window.open(`https://www.imdb.com/title/${imdbId}/`, '_blank'); return; }
    }
    const restoreBtn = e.target.closest('.btn-restore');
    if (restoreBtn) {
      const id = restoreBtn.dataset.id;
      const movie = state.trash.find(m => (m.imdbId || m.tmdbId?.toString()) === id);
      try {
        await api.restoreMovie(id);
        state.trash = state.trash.filter(m => (m.imdbId || m.tmdbId?.toString()) !== id);
        if (movie) {
          delete movie.deletedAt;
          state.movies.unshift(movie);
          updateFilterOptions();
          renderSidebar();
        }
        renderTrash();
        updateTrashBadge();
        showToast(`"${movie?.title || 'Movie'}" restored!`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-forever');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const movie = state.trash.find(m => (m.imdbId || m.tmdbId?.toString()) === id);
      if (!confirm(`Permanently delete "${movie?.title || 'this movie'}"? This cannot be undone.`)) return;
      try {
        await api.deleteForever(id);
        state.trash = state.trash.filter(m => (m.imdbId || m.tmdbId?.toString()) !== id);
        renderTrash();
        updateTrashBadge();
        showToast('Deleted permanently', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Empty trash
  el('btn-empty-trash').addEventListener('click', async () => {
    if (!state.trash.length) return;
    if (!confirm(`Permanently delete all ${state.trash.length} movie${state.trash.length > 1 ? 's' : ''} in Trash? This cannot be undone.`)) return;
    try {
      await api.emptyTrash();
      state.trash = [];
      renderTrash();
      updateTrashBadge();
      showToast('Trash emptied', 'success');
    } catch (err) {
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
  Promise.all([loadMovies(), loadSettings(), loadTrash()]);
}

init();
