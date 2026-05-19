"use strict";

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  section: "movies",
  movies: [],
  books: [],
  suggestions: [],
  bookSuggestions: [],
  trash: [],
  booksTrash: [],
  settings: {},
  filters: {
    type: "",
    year: "",
    genre: "",
    minRating: "",
    sort: "addedAt",
    order: "desc",
    q: "",
    minHearts: 0,
    rewatch: false,
  },
  bookFilters: {
    genre: "",
    minRating: "",
    sort: "addedAt",
    order: "desc",
    q: "",
    minHearts: 0,
    rewatch: false,
  },
  notesPopup: { open: false, id: null, type: null },
  suggFilters: { type: "", genre: "", minRating: "", platform: "" },
  bookSuggFilters: { genre: "" },
  wishlist: [],
  booksWishlist: [],
  wishlistFilters: {
    type: "",
    genre: "",
    minRating: "",
    platform: "",
    sort: "addedAt",
    order: "desc",
    q: "",
  },
  booksWishlistFilters: { genre: "", sort: "addedAt", q: "" },
  wishlistGroupByPlatform: false,
  calendarMonth: new Date(),
  calendarMode: "movies",
  tabsMode: "both",
  modalMode: "movie",
  suggMode: "movies",
  wishlistMode: "movies",
  modal: { open: false, results: [], selected: null },
  loading: {
    movies: false,
    suggestions: false,
    trash: false,
    books: false,
    bookSuggestions: false,
  },
};

// ── API client ────────────────────────────────────────────────────────────────

const api = {
  async req(method, url, body) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  },
  get: (url) => api.req("GET", url),
  post: (url, body) => api.req("POST", url, body),
  del: (url) => api.req("DELETE", url),
  patch: (url, body) => api.req("PATCH", url, body),
  setHearts: (id, hearts) =>
    api.patch(`/api/movies/${encodeURIComponent(id)}/hearts`, { hearts }),
  search: (q) => api.get(`/api/search?q=${encodeURIComponent(q)}`),
  movieDetails: (id, type) =>
    api.get(`/api/movie-details/${id}?type=${encodeURIComponent(type || "")}`),
  getMovies(filters = {}) {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v),
    );
    delete params.q;
    const qs = new URLSearchParams(params);
    return api.get(`/api/movies?${qs}`);
  },
  addMovie: (data) => api.post("/api/movies", data),
  removeMovie: (id) => api.del(`/api/movies/${id}`),
  getSuggestions: () => api.get("/api/suggestions"),
  getWishlist: () => api.get("/api/wishlist"),
  addToWishlist: (data) => api.post("/api/wishlist", data),
  removeFromWishlist: (id) =>
    api.del(`/api/wishlist/${encodeURIComponent(id)}`),
  setWishlistHearts: (id, hearts) =>
    api.patch(`/api/wishlist/${encodeURIComponent(id)}/hearts`, { hearts }),
  markWatched: (id) =>
    api.patch(`/api/wishlist/${encodeURIComponent(id)}/watched`, {}),
  refreshWishlistPlatforms: () =>
    api.post("/api/wishlist/refresh-platforms", {}),
  getSettings: () => api.get("/api/settings"),
  saveSettings: (data) => api.post("/api/settings", data),
  getTrash: () => api.get("/api/trash"),
  restoreMovie: (id) =>
    api.patch(`/api/movies/${encodeURIComponent(id)}/restore`, {}),
  deleteForever: (id) => api.del(`/api/trash/${encodeURIComponent(id)}`),
  emptyTrash: () => api.del("/api/trash"),
  // Books
  searchBooks: (q) => api.get(`/api/search-books?q=${encodeURIComponent(q)}`),
  bookDetails: (id, source) =>
    api.get(
      `/api/book-details/${encodeURIComponent(id)}?source=${encodeURIComponent(source || "")}`,
    ),
  getBooks: () => api.get("/api/books"),
  addBook: (data) => api.post("/api/books", data),
  removeBook: (id) => api.del(`/api/books/${encodeURIComponent(id)}`),
  setBookHearts: (id, hearts) =>
    api.patch(`/api/books/${encodeURIComponent(id)}/hearts`, { hearts }),
  setMovieNotes: (id, notes, suggestedBy) =>
    api.patch(`/api/movies/${encodeURIComponent(id)}/notes`, {
      notes,
      suggestedBy,
    }),
  setMovieRewatch: (id) =>
    api.patch(`/api/movies/${encodeURIComponent(id)}/rewatch`, {}),
  setBookNotes: (id, notes, suggestedBy) =>
    api.patch(`/api/books/${encodeURIComponent(id)}/notes`, {
      notes,
      suggestedBy,
    }),
  setBookReread: (id) =>
    api.patch(`/api/books/${encodeURIComponent(id)}/reread`, {}),
  getBooksTrash: () => api.get("/api/books-trash"),
  restoreBook: (id) =>
    api.patch(`/api/books/${encodeURIComponent(id)}/restore`, {}),
  deleteBookForever: (id) =>
    api.del(`/api/books-trash/${encodeURIComponent(id)}`),
  emptyBooksTrash: () => api.del("/api/books-trash"),
  getBookSuggestions: () => api.get("/api/book-suggestions"),
  getBookWishlist: () => api.get("/api/books-wishlist"),
  addBookToWishlist: (data) => api.post("/api/books-wishlist", data),
  removeFromBookWishlist: (id) =>
    api.del(`/api/books-wishlist/${encodeURIComponent(id)}`),
  setBookWishlistHearts: (id, hearts) =>
    api.patch(`/api/books-wishlist/${encodeURIComponent(id)}/hearts`, {
      hearts,
    }),
  markBookAsRead: (id) =>
    api.patch(`/api/books-wishlist/${encodeURIComponent(id)}/read`, {}),
};

// ── Utils ─────────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function el(id) {
  return document.getElementById(id);
}

function formatRuntime(secs) {
  if (!secs) return "";
  const h = Math.floor(secs / 3600),
    m = Math.floor((secs % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function typeLabel(type) {
  return (
    {
      movie: "Movie",
      tvSeries: "TV Series",
      tvMiniSeries: "Mini Series",
      tvMovie: "TV Movie",
      tvSpecial: "TV Special",
      short: "Short",
    }[type] ||
    type ||
    "Movie"
  );
}

function platformClass(name) {
  return name
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderSidebar() {
  const rows = [
    { count: state.movies.length, label: "Movies" },
    { count: state.books.length, label: "Books" },
  ].filter((r) => r.count > 0);
  el("sidebar-stats").innerHTML = rows.length
    ? `<div class="stats">${rows.map((r) => `<div class="stat-item"><span class="stat-num">${r.count}</span><span class="stat-label">${r.label}</span></div>`).join("")}</div>`
    : "";
}

function movieCard(m, mode) {
  // mode: 'watched' | 'suggestion' | 'wishlist' | 'trash'
  const isTrash = mode === "trash";
  const isSuggestion = mode === "suggestion";
  const isWishlist = mode === "wishlist";
  const movieId = esc(m.imdbId || m.tmdbId || "");
  const poster = m.poster
    ? `<img class="poster" src="${esc(m.poster)}" alt="${esc(m.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const noPostDisplay = m.poster ? "none" : "flex";
  const noPoster = `<div class="no-poster" style="display:${noPostDisplay}">🎬</div>`;
  const genreHtml = (m.genres || [])
    .slice(0, 3)
    .map((g) => `<span class="genre-tag">${esc(g)}</span>`)
    .join("");
  const platformsHtml =
    (isSuggestion || isWishlist) && (m.platforms || []).length
      ? `<div class="platforms-list">${(m.platforms || []).map((p) => `<span class="platform-tag platform-${platformClass(p)}">${esc(p)}</span>`).join("")}</div>`
      : "";

  const heartsHtml =
    !isSuggestion && !isTrash && !isWishlist
      ? `<div class="card-rating-row">
          <div class="card-hearts" data-id="${movieId}">
            ${[5, 4, 3, 2, 1].map((n) => `<span class="card-heart${(m.hearts || 0) >= n ? " filled" : ""}" data-val="${n}">♥</span>`).join("")}
          </div>
          <button class="btn-notes${m.notes || m.suggestedBy ? " has-notes" : ""}" data-id="${movieId}" title="Notes">💬</button>
        </div>`
      : "";

  const rewatchFlagHtml =
    !isSuggestion && !isTrash && !isWishlist
      ? `<button class="btn-rewatch-flag${m.rewatch ? " active" : ""}" data-id="${movieId}" title="${m.rewatch ? "Marked for rewatch — click to unmark" : "Mark for rewatch"}">🚩</button>`
      : "";

  const action = isSuggestion
    ? `<div class="card-footer"><div class="sugg-actions">
        <button class="btn-small btn-add-suggestion"
          data-imdb="${esc(m.imdbId || "")}"
          data-tmdb="${esc(m.tmdbId || "")}"
          data-type="${esc(m.type || "movie")}">+ Watched</button>
        <button class="btn-small btn-sugg-wishlist"
          data-imdb="${esc(m.imdbId || "")}"
          data-tmdb="${esc(m.tmdbId || "")}"
          data-type="${esc(m.type || "movie")}">☆ List</button>
      </div></div>`
    : isWishlist
      ? `<div class="card-footer"><button class="btn-small btn-mark-watched" data-id="${movieId}">✓ Mark as Watched</button></div>`
      : isTrash
        ? `<div class="trash-actions">
        <button class="btn-small btn-restore" data-id="${movieId}">↩ Restore</button>
        <button class="btn-small btn-delete-forever" data-id="${movieId}">✕ Permanently Delete</button>
      </div>`
        : "";

  return `
    <div class="movie-card" data-id="${movieId}" data-imdb="${esc(m.imdbId || "")}"${m.imdbId ? ' style="cursor:pointer"' : ""}>
      <div class="poster-wrap">
        ${poster}${noPoster}
        <div class="card-overlay">
          ${m.rating ? `<span class="rating-badge">★ ${Number(m.rating).toFixed(1)}</span>` : "<span></span>"}
          <span class="type-badge">${esc(typeLabel(m.type))}</span>
        </div>
        ${
          !isSuggestion && !isTrash
            ? `<button class="btn-remove-x" data-id="${movieId}" title="${isWishlist ? "Remove from Wish List" : "Move to Trash"}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`
            : ""
        }
        ${rewatchFlagHtml}
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(m.title)}</h3>
        <div class="card-meta">
          ${m.year ? `<span>${m.year}</span>` : ""}
          ${m.runtime ? `<span>${formatRuntime(m.runtime)}</span>` : ""}
        </div>
        <div class="genres-list">${genreHtml}</div>
        ${m.directors?.length ? `<div class="directors">Dir: ${esc(m.directors.map((d) => d.name).join(", "))}</div>` : ""}
        ${m.plot ? `<div class="plot">${esc(m.plot.slice(0, 110))}${m.plot.length > 110 ? "…" : ""}</div>` : ""}
        ${platformsHtml}
        ${heartsHtml}
        ${action}
      </div>
    </div>`;
}

function bookCard(b, mode) {
  const isTrash = mode === "trash";
  const isSuggestion = mode === "suggestion";
  const isWishlist = mode === "wishlist";
  const bookId = esc(b.googleBooksId || b.openLibraryId || b.isbn || "");
  const cover = b.cover
    ? `<img class="poster" src="${esc(b.cover)}" alt="${esc(b.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const noCoverDisplay = b.cover ? "none" : "flex";
  const noCover = `<div class="no-poster" style="display:${noCoverDisplay}">📚</div>`;
  const genreHtml = (b.genres || [])
    .slice(0, 3)
    .map((g) => `<span class="genre-tag">${esc(g)}</span>`)
    .join("");
  const showHearts = !isTrash && !isSuggestion && !isWishlist;
  const heartsHtml = showHearts
    ? `<div class="card-rating-row">
        <div class="card-hearts" data-id="${bookId}">
          ${[5, 4, 3, 2, 1].map((n) => `<span class="card-heart${(b.hearts || 0) >= n ? " filled" : ""}" data-val="${n}">♥</span>`).join("")}
        </div>
        <button class="btn-notes${b.notes || b.suggestedBy ? " has-notes" : ""}" data-id="${bookId}" title="Notes">💬</button>
      </div>`
    : "";
  const rewatchFlagHtml =
    !isTrash && !isSuggestion && !isWishlist
      ? `<button class="btn-rewatch-flag${b.rewatch ? " active" : ""}" data-id="${bookId}" title="${b.rewatch ? "Marked for reread — click to unmark" : "Mark for reread"}">🚩</button>`
      : "";
  let action = "";
  if (isTrash) {
    action = `<div class="trash-actions">
        <button class="btn-small btn-restore" data-id="${bookId}">↩ Restore</button>
        <button class="btn-small btn-delete-forever" data-id="${bookId}">✕ Delete Forever</button>
      </div>`;
  } else if (isSuggestion) {
    const isbn = esc(b.isbn || "");
    const gbId = esc(b.googleBooksId || "");
    const olId = esc(b.openLibraryId || "");
    action = `<div class="card-footer"><div class="sugg-actions">
        <button class="btn-small btn-add-book-suggestion" data-isbn="${isbn}" data-google-books-id="${gbId}" data-open-library-id="${olId}">+ Read</button>
        <button class="btn-small btn-sugg-book-wishlist" data-isbn="${isbn}" data-google-books-id="${gbId}" data-open-library-id="${olId}">☆ List</button>
      </div></div>`;
  } else if (isWishlist) {
    action = `<div class="card-actions">
        <button class="btn-small btn-mark-read" data-id="${bookId}">✓ Mark as Read</button>
      </div>`;
  }
  const removeBtn =
    !isTrash && !isSuggestion
      ? `<button class="btn-remove-x" data-id="${bookId}" title="Move to Trash">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`
      : "";
  const ratingHtml = b.rating
    ? `<span class="rating-badge">★ ${Number(b.rating).toFixed(1)}</span>`
    : "<span></span>";
  const googleUrl = b.googleBooksId
    ? `https://books.google.com/books?id=${b.googleBooksId}`
    : null;
  return `
    <div class="movie-card" data-id="${bookId}" data-item-type="book"${googleUrl ? ` style="cursor:pointer" data-google-url="${esc(googleUrl)}"` : ""}>
      <div class="poster-wrap">
        ${cover}${noCover}
        <div class="card-overlay">
          ${ratingHtml}
          <span class="type-badge book-badge">Book</span>
        </div>
        ${removeBtn}
        ${rewatchFlagHtml}
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(b.title)}</h3>
        <div class="card-meta">
          ${b.year ? `<span>${b.year}</span>` : ""}
          ${b.pageCount ? `<span>${b.pageCount} pp</span>` : ""}
        </div>
        <div class="genres-list">${genreHtml}</div>
        ${b.authors?.length ? `<div class="directors">By: ${esc(b.authors.slice(0, 2).join(", "))}</div>` : ""}
        ${b.description ? `<div class="plot">${esc(b.description.slice(0, 110))}${b.description.length > 110 ? "…" : ""}</div>` : ""}
        ${heartsHtml}
        ${action}
      </div>
    </div>`;
}

function renderBooks() {
  const grid = el("books-grid");
  if (state.loading.books) {
    grid.innerHTML =
      '<div class="loading"><div class="spinner"></div><span>Loading…</span></div>';
    return;
  }
  let list = state.books;
  const f = state.bookFilters;
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter(
      (b) =>
        b.title?.toLowerCase().includes(q) ||
        (b.authors || []).some((a) => a.toLowerCase().includes(q)),
    );
  }
  if (f.minHearts > 0)
    list = list.filter((b) => (b.hearts || 0) >= f.minHearts);
  if (f.rewatch) list = list.filter((b) => b.rewatch);
  if (!list.length) {
    grid.innerHTML = state.books.length
      ? '<div class="empty"><span>No books match your filters.</span></div>'
      : `<div class="empty">
           <span>No books yet.</span>
           <span>Click <strong>+ Add Book</strong> to get started.</span>
         </div>`;
    return;
  }
  grid.innerHTML = list.map((b) => bookCard(b, "watched")).join("");
}

function renderBookHeartFilter() {
  const n = state.bookFilters.minHearts;
  document.querySelectorAll("#book-heart-filter .hf-heart").forEach((h) => {
    h.classList.toggle("filled", parseInt(h.dataset.val) <= n);
  });
  el("book-heart-filter").classList.toggle("active", n > 0);
}

function updateBookFilterOptions() {
  const genres = [
    ...new Set(state.books.flatMap((b) => b.genres || [])),
  ].sort();
  const f = state.bookFilters;
  el("book-filter-genre").innerHTML =
    '<option value="">All Genres</option>' +
    genres
      .map(
        (g) =>
          `<option value="${g}" ${f.genre === g ? "selected" : ""}>${esc(g)}</option>`,
      )
      .join("");
}

async function loadBooks() {
  state.loading.books = true;
  renderBooks();
  try {
    state.books = await api.getBooks();
  } catch (err) {
    showToast(err.message, "error");
  }
  state.loading.books = false;
  renderBooks();
  updateBookFilterOptions();
  renderSidebar();
}

async function removeBook(id) {
  const book = state.books.find(
    (b) => b.googleBooksId === id || b.openLibraryId === id,
  );
  try {
    await api.removeBook(id);
    state.books = state.books.filter(
      (b) => b.googleBooksId !== id && b.openLibraryId !== id,
    );
    if (book) {
      book.deletedAt = new Date().toISOString();
      state.booksTrash.unshift(book);
    }
    renderBooks();
    updateBookFilterOptions();
    renderSidebar();
    updateTrashBadge();
    showToast("Moved to Trash", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderMovies() {
  const grid = el("movies-grid");
  if (state.loading.movies) {
    grid.innerHTML =
      '<div class="loading"><div class="spinner"></div><span>Loading…</span></div>';
    return;
  }
  let list = state.movies;
  if (state.filters.q) {
    const q = state.filters.q.toLowerCase();
    list = list.filter((m) => m.title?.toLowerCase().includes(q));
  }
  if (state.filters.minHearts > 0) {
    list = list.filter((m) => (m.hearts || 0) >= state.filters.minHearts);
  }
  if (state.filters.rewatch) {
    list = list.filter((m) => m.rewatch);
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
  grid.innerHTML = list.map((m) => movieCard(m, "watched")).join("");
}

function renderHeartFilter() {
  const n = state.filters.minHearts;
  document.querySelectorAll("#heart-filter .hf-heart").forEach((h) => {
    h.classList.toggle("filled", parseInt(h.dataset.val) <= n);
  });
  el("heart-filter").classList.toggle("active", n > 0);
}

function updateFilterOptions() {
  const years = [
    ...new Set(state.movies.map((m) => m.year).filter(Boolean)),
  ].sort((a, b) => b - a);
  const genres = [
    ...new Set(state.movies.flatMap((m) => m.genres || [])),
  ].sort();

  el("filter-year").innerHTML =
    '<option value="">All Years</option>' +
    years
      .map(
        (y) =>
          `<option value="${y}" ${state.filters.year == y ? "selected" : ""}>${y}</option>`,
      )
      .join("");

  el("filter-genre").innerHTML =
    '<option value="">All Genres</option>' +
    genres
      .map(
        (g) =>
          `<option value="${g}" ${state.filters.genre === g ? "selected" : ""}>${esc(g)}</option>`,
      )
      .join("");
}

function updateSuggestionFilterOptions() {
  const genres = [
    ...new Set(state.suggestions.flatMap((m) => m.genres || [])),
  ].sort();
  const f = state.suggFilters;
  el("sugg-filter-genre").innerHTML =
    '<option value="">All Genres</option>' +
    genres
      .map(
        (g) =>
          `<option value="${g}" ${f.genre === g ? "selected" : ""}>${esc(g)}</option>`,
      )
      .join("");
  const hasplatforms = state.suggestions.some(
    (m) => (m.platforms || []).length > 0,
  );
  el("sugg-filter-platform").style.display = hasplatforms ? "" : "none";
}

function applySuggMode(mode) {
  state.suggMode = mode;
  el("sugg-mode-label").textContent =
    mode === "books" ? "📚 Books" : "🎬 Movies";
  el("sugg-movies-panel").classList.toggle("hidden", mode === "books");
  el("sugg-books-panel").classList.toggle("hidden", mode === "movies");
  el("sugg-section-sub").textContent =
    mode === "books"
      ? "Based on your taste — genres & authors you love"
      : "Based on your taste — genres, directors & actors you love";
}

function renderSuggestions() {
  const grid = el("suggestions-grid");
  if (state.loading.suggestions) {
    grid.innerHTML =
      '<div class="loading"><div class="spinner"></div><span>Finding recommendations… this may take a moment</span></div>';
    return;
  }
  if (!state.movies.length) {
    grid.innerHTML =
      '<div class="empty"><span>Add some movies to your watched list first to get suggestions.</span></div>';
    return;
  }
  if (!state.suggestions.length) {
    grid.innerHTML =
      '<div class="empty"><span>No suggestions found. Try adding more movies to your list.</span></div>';
    return;
  }
  let list = state.suggestions;
  const f = state.suggFilters;
  if (f.type) list = list.filter((m) => m.type === f.type);
  if (f.genre) list = list.filter((m) => (m.genres || []).includes(f.genre));
  if (f.minRating)
    list = list.filter((m) => (m.rating || 0) >= parseFloat(f.minRating));
  if (f.platform)
    list = list.filter((m) => (m.platforms || []).includes(f.platform));
  if (!list.length) {
    grid.innerHTML =
      '<div class="empty"><span>No suggestions match your filters.</span></div>';
    return;
  }
  grid.innerHTML = list.map((m) => movieCard(m, "suggestion")).join("");
}

function renderBookSuggestions() {
  const grid = el("book-suggestions-grid");
  if (state.loading.bookSuggestions) {
    grid.innerHTML =
      '<div class="loading"><div class="spinner"></div><span>Finding book recommendations…</span></div>';
    return;
  }
  if (!state.books.length) {
    grid.innerHTML =
      '<div class="empty"><span>Add some books to your library first to get suggestions.</span></div>';
    return;
  }
  let list = state.bookSuggestions;
  const f = state.bookSuggFilters;
  if (f.genre) list = list.filter((b) => (b.genres || []).includes(f.genre));
  if (!list.length) {
    grid.innerHTML = state.bookSuggestions.length
      ? '<div class="empty"><span>No book suggestions match your filters.</span></div>'
      : '<div class="empty"><span>No book suggestions found. Try adding more books to your library.</span></div>';
    return;
  }
  grid.innerHTML = list.map((b) => bookCard(b, "suggestion")).join("");
}

async function loadBookSuggestions() {
  state.loading.bookSuggestions = true;
  renderBookSuggestions();
  try {
    const data = await api.getBookSuggestions();
    state.bookSuggestions = data.results || data;
    const allGenres = [
      ...new Set(state.bookSuggestions.flatMap((b) => b.genres || [])),
    ].sort();
    const genreSel = el("bsugg-filter-genre");
    genreSel.innerHTML =
      '<option value="">All Genres</option>' +
      allGenres
        .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
        .join("");
  } catch (err) {
    showToast(`Book suggestions failed: ${err.message}`, "error");
    state.bookSuggestions = [];
  }
  state.loading.bookSuggestions = false;
  renderBookSuggestions();
}

function renderSettings() {
  el("setting-tmdb").value = state.settings.tmdb || "";
  const hasKey = Boolean(state.settings.tmdb);
  el("data-source").textContent = hasKey
    ? "TMDB (rich metadata, active)"
    : "IMDb via imdbapi.dev (free)";
  el("source-dot").style.background = hasKey
    ? "var(--primary)"
    : "var(--success)";
  el("setting-nyt").value = state.settings.nyt || "";
  el("setting-country").value = state.settings.country || "US";
  renderTabsToggle();
}

function renderTabsToggle() {
  const mode = state.tabsMode || "both";
  document.querySelectorAll(".tabs-toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  const hints = {
    books: "Showing Books only",
    movies: "Showing Movies only",
    both: "Showing both Movies & Books",
  };
  el("tabs-toggle-hint").textContent = hints[mode] || hints.both;
}

function applyTabsMode(mode) {
  state.tabsMode = mode;
  const moviesBtn = document.querySelector('.nav-btn[data-section="movies"]');
  const booksBtn = document.querySelector('.nav-btn[data-section="books"]');
  if (mode === "movies") {
    moviesBtn.style.display = "";
    booksBtn.style.display = "none";
    if (state.section === "books") goToSection("movies");
  } else if (mode === "books") {
    moviesBtn.style.display = "none";
    booksBtn.style.display = "";
    if (state.section === "movies") goToSection("books");
  } else {
    moviesBtn.style.display = "";
    booksBtn.style.display = "";
  }
  renderTabsToggle();
}

function renderTrash() {
  const grid = el("trash-grid");
  if (state.loading.trash) {
    grid.innerHTML =
      '<div class="loading"><div class="spinner"></div><span>Loading…</span></div>';
    return;
  }
  const hasMovies = state.trash.length > 0;
  const hasBooks = state.booksTrash.length > 0;
  if (!hasMovies && !hasBooks) {
    grid.innerHTML = '<div class="empty"><span>Trash is empty.</span></div>';
    return;
  }
  let html = "";
  if (hasMovies) {
    html += `<div class="trash-section">
      <div class="trash-section-header">🎬 Movies</div>
      <div class="movie-grid inline-grid">${state.trash.map((m) => movieCard(m, "trash")).join("")}</div>
    </div>`;
  }
  if (hasBooks) {
    html += `<div class="trash-section">
      <div class="trash-section-header">📚 Books</div>
      <div class="movie-grid inline-grid">${state.booksTrash.map((b) => bookCard(b, "trash")).join("")}</div>
    </div>`;
  }
  grid.innerHTML = html;
}

function updateTrashBadge() {
  const badge = el("trash-count");
  const count = state.trash.length + state.booksTrash.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? "" : "none";
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(mode = "movie") {
  state.modalMode = mode;
  state.modal = { open: true, results: [], selected: null };
  el("modal-overlay").classList.remove("hidden");
  el("search-results").innerHTML = "";
  el("search-input").value = "";
  el("movie-preview").classList.add("hidden");
  el("modal-search-panel").style.display = "";
  el("modal-title").textContent = mode === "book" ? "Add Book" : "Add Movie";
  el("search-input").placeholder =
    mode === "book"
      ? "Search by title or author…"
      : "Search by title or paste IMDB ID (tt…)";
  setTimeout(() => el("search-input").focus(), 50);
}

function closeModal() {
  state.modal.open = false;
  el("modal-overlay").classList.add("hidden");
}

function showSearchResults(results) {
  state.modal.results = results;
  if (!results.length) {
    el("search-results").innerHTML =
      '<div class="no-results">No results found. Try a different title, or paste an IMDb ID (e.g. tt1375666).</div>';
    return;
  }
  el("search-results").innerHTML = results
    .map(
      (r) => `
    <div class="search-result" data-imdb="${esc(r.imdbId || "")}" data-tmdb="${esc(r.tmdbId || "")}" data-type="${esc(r.type || "movie")}">
      <div class="result-poster">
        ${
          r.poster
            ? `<img src="${esc(r.poster)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="no-poster-sm">🎬</div>`
        }
      </div>
      <div class="result-info">
        <div class="result-title">${esc(r.title)}</div>
        <div class="result-meta">
          ${r.year ? `<span>${r.year}</span>` : ""}
          <span class="type-badge-sm">${esc(typeLabel(r.type))}</span>
          ${r.cast ? `<span class="cast-hint">${esc(r.cast)}</span>` : ""}
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function showBookSearchResults(results) {
  state.modal.results = results;
  if (!results.length) {
    el("search-results").innerHTML =
      '<div class="no-results">No books found. Try a different title or author.</div>';
    return;
  }
  el("search-results").innerHTML = results
    .map(
      (r) => `
    <div class="search-result"
      data-google-books-id="${esc(r.googleBooksId || "")}"
      data-open-library-id="${esc(r.openLibraryId || "")}"
      data-source="${esc(r.source || "google-books")}">
      <div class="result-poster">
        ${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<div class="no-poster-sm">📚</div>`}
      </div>
      <div class="result-info">
        <div class="result-title">${esc(r.title)}</div>
        <div class="result-meta">
          ${r.year ? `<span>${r.year}</span>` : ""}
          ${r.authors?.length ? `<span class="cast-hint">${esc(r.authors.slice(0, 2).join(", "))}</span>` : ""}
        </div>
      </div>
    </div>`,
    )
    .join("");
}

async function showBookPreview(googleBooksId, openLibraryId, source) {
  el("modal-search-panel").style.display = "none";
  el("movie-preview").classList.remove("hidden");
  el("movie-preview").innerHTML =
    '<div class="loading"><div class="spinner"></div></div>';
  try {
    const id = googleBooksId || openLibraryId;
    const details = await api.bookDetails(id, source);
    state.modal.selected = details;
    el("movie-preview").innerHTML = `
      <button class="btn-link" id="back-btn">← Back to results</button>
      <div class="preview-content">
        <div class="preview-poster">
          ${details.cover ? `<img src="${esc(details.cover)}" alt="${esc(details.title)}">` : `<div class="no-poster-lg">📚</div>`}
        </div>
        <div class="preview-info">
          <h2>${esc(details.title)}</h2>
          <div class="preview-meta">
            ${details.year ? `<span>${details.year}</span>` : ""}
            ${details.pageCount ? `<span>${details.pageCount} pages</span>` : ""}
            ${details.rating ? `<span class="rating-badge">★ ${Number(details.rating).toFixed(1)}</span>` : ""}
          </div>
          <div class="genres-list" style="margin-bottom:4px">
            ${(details.genres || []).map((g) => `<span class="genre-tag">${esc(g)}</span>`).join("")}
          </div>
          ${details.authors?.length ? `<p><strong>Author:</strong> ${esc(details.authors.join(", "))}</p>` : ""}
          ${details.publisher ? `<p><strong>Publisher:</strong> ${esc(details.publisher)}</p>` : ""}
          ${details.description ? `<p class="preview-plot">${esc(details.description)}</p>` : ""}
          <div class="preview-actions">
            <button id="btn-confirm-add-book" class="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add to My Books
            </button>
            <button id="btn-confirm-add-book-wishlist" class="btn-secondary">☆ Add to Wish List</button>
          </div>
        </div>
      </div>`;
    el("back-btn").addEventListener("click", () => {
      el("movie-preview").classList.add("hidden");
      el("modal-search-panel").style.display = "";
    });
    el("btn-confirm-add-book").addEventListener("click", () =>
      confirmAddBook(details),
    );
    el("btn-confirm-add-book-wishlist").addEventListener("click", () =>
      confirmAddBookToWishlist(details),
    );
  } catch (err) {
    el("movie-preview").innerHTML = `
      <button class="btn-link" id="back-btn">← Back to results</button>
      <div class="error" style="margin-top:12px">Failed to load details: ${esc(err.message)}</div>`;
    el("back-btn").addEventListener("click", () => {
      el("movie-preview").classList.add("hidden");
      el("modal-search-panel").style.display = "";
    });
  }
}

async function confirmAddBook(details) {
  const btn = el("btn-confirm-add-book");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner-sm" style="display:inline-block"></div> Adding…`;
  try {
    const book = await api.addBook({
      googleBooksId: details.googleBooksId,
      openLibraryId: details.openLibraryId,
      source: details.source,
    });
    state.books.unshift(book);
    closeModal();
    goToSection("books");
    renderBooks();
    updateBookFilterOptions();
    renderSidebar();
    showToast(`"${details.title}" added to your books!`, "success");
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to My Books`;
    showToast(err.message, "error");
  }
}

async function confirmAddBookToWishlist(details) {
  const btn = el("btn-confirm-add-book-wishlist");
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const book = await api.addBookToWishlist({
      googleBooksId: details.googleBooksId,
      openLibraryId: details.openLibraryId,
      source: details.source,
    });
    state.booksWishlist.unshift(book);
    closeModal();
    goToSection("wishlist");
    state.wishlistMode = "books";
    applyWishlistMode("books");
    renderBooksWishlist();
    updateBooksWishlistFilterOptions();
    showToast(`"${details.title}" added to Book Wish List!`, "success");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "☆ Add to Book Wish List";
    showToast(err.message, "error");
  }
}

async function showMoviePreview(imdbId, tmdbId, type) {
  el("modal-search-panel").style.display = "none";
  el("movie-preview").classList.remove("hidden");
  el("movie-preview").innerHTML =
    '<div class="loading"><div class="spinner"></div></div>';

  try {
    const id = imdbId || tmdbId;
    const details = await api.movieDetails(id, type);
    state.modal.selected = details;

    el("movie-preview").innerHTML = `
      <button class="btn-link" id="back-btn">← Back to results</button>
      <div class="preview-content">
        <div class="preview-poster">
          ${
            details.poster
              ? `<img src="${esc(details.poster)}" alt="${esc(details.title)}">`
              : `<div class="no-poster-lg">🎬</div>`
          }
        </div>
        <div class="preview-info">
          <h2>${esc(details.title)}</h2>
          <div class="preview-meta">
            ${details.year ? `<span>${details.year}</span>` : ""}
            ${details.runtime ? `<span>${formatRuntime(details.runtime)}</span>` : ""}
            <span class="type-badge">${esc(typeLabel(details.type))}</span>
            ${details.rating ? `<span class="rating-badge">★ ${Number(details.rating).toFixed(1)}</span>` : ""}
          </div>
          <div class="genres-list" style="margin-bottom:4px">
            ${(details.genres || []).map((g) => `<span class="genre-tag">${esc(g)}</span>`).join("")}
          </div>
          ${
            details.directors?.length
              ? `<p><strong>Director:</strong> ${esc(details.directors.map((d) => d.name).join(", "))}</p>`
              : ""
          }
          ${
            details.stars?.length
              ? `<p><strong>Stars:</strong> ${esc(
                  details.stars
                    .slice(0, 3)
                    .map((s) => s.name)
                    .join(", "),
                )}</p>`
              : ""
          }
          ${details.plot ? `<p class="preview-plot">${esc(details.plot)}</p>` : ""}
          <div class="preview-actions">
            <button id="btn-confirm-add" class="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add to Watched
            </button>
            <button id="btn-confirm-wishlist" class="btn-secondary">☆ Add to Wish List</button>
          </div>
        </div>
      </div>`;

    el("back-btn").addEventListener("click", () => {
      el("movie-preview").classList.add("hidden");
      el("modal-search-panel").style.display = "";
    });

    el("btn-confirm-add").addEventListener("click", () => confirmAdd(details));
    el("btn-confirm-wishlist").addEventListener("click", () =>
      confirmAddToWishlist(details),
    );
  } catch (err) {
    el("movie-preview").innerHTML = `
      <button class="btn-link" id="back-btn">← Back to results</button>
      <div class="error" style="margin-top:12px">Failed to load details: ${esc(err.message)}</div>`;
    el("back-btn").addEventListener("click", () => {
      el("movie-preview").classList.add("hidden");
      el("modal-search-panel").style.display = "";
    });
  }
}

async function confirmAdd(details) {
  const btn = el("btn-confirm-add");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner-sm" style="display:inline-block"></div> Adding…`;
  try {
    const movie = await api.addMovie({
      imdbId: details.imdbId,
      tmdbId: details.tmdbId,
      type: details.type,
    });
    state.movies.unshift(movie);
    closeModal();
    goToSection("movies");
    renderMovies();
    updateFilterOptions();
    renderSidebar();
    showToast(`"${details.title}" added to your list!`, "success");
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to Watched`;
    showToast(err.message, "error");
  }
}

async function confirmAddToWishlist(details) {
  const btn = el("btn-confirm-wishlist");
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const movie = await api.addToWishlist({
      imdbId: details.imdbId,
      tmdbId: details.tmdbId,
      type: details.type,
    });
    state.wishlist.unshift(movie);
    closeModal();
    goToSection("wishlist");
    renderWishlist();
    updateWishlistFilterOptions();
    showToast(`"${details.title}" added to Wish List!`, "success");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "☆ Add to Wish List";
    showToast(err.message, "error");
  }
}

// ── Notes popup ───────────────────────────────────────────────────────────────

function getSuggestedByNames() {
  const names = new Set();
  for (const m of state.movies) if (m.suggestedBy) names.add(m.suggestedBy);
  for (const b of state.books) if (b.suggestedBy) names.add(b.suggestedBy);
  return [...names].sort((a, b) => a.localeCompare(b));
}

function openNotesPopup(id, type) {
  const item =
    type === "book"
      ? state.books.find((b) => (b.googleBooksId || b.openLibraryId) === id)
      : state.movies.find((m) => (m.imdbId || m.tmdbId?.toString()) === id);
  if (!item) return;
  state.notesPopup = { open: true, id, type };
  el("notes-suggested-by").value = item.suggestedBy || "";
  el("notes-text").value = item.notes || "";
  el("notes-popup-title").textContent = item.title;
  el("notes-suggested-suggestions").classList.add("hidden");
  el("notes-overlay").classList.remove("hidden");
  setTimeout(() => el("notes-suggested-by").focus(), 50);
}

function closeNotesPopup() {
  state.notesPopup.open = false;
  el("notes-suggested-suggestions").classList.add("hidden");
  el("notes-overlay").classList.add("hidden");
}

async function saveAndCloseNotes() {
  if (!state.notesPopup.open) return;
  const { id, type } = state.notesPopup;
  const suggestedBy = el("notes-suggested-by").value.trim();
  const notes = el("notes-text").value.trim();
  const hasContent = Boolean(notes || suggestedBy);
  closeNotesPopup();
  try {
    if (type === "book") {
      await api.setBookNotes(id, notes, suggestedBy);
      const book = state.books.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      if (book) {
        book.notes = notes;
        book.suggestedBy = suggestedBy;
      }
      const btn = document.querySelector(
        `#books-grid .btn-notes[data-id="${id}"]`,
      );
      if (btn) btn.classList.toggle("has-notes", hasContent);
    } else {
      await api.setMovieNotes(id, notes, suggestedBy);
      const movie = state.movies.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      if (movie) {
        movie.notes = notes;
        movie.suggestedBy = suggestedBy;
      }
      const btn = document.querySelector(
        `#movies-grid .btn-notes[data-id="${id}"]`,
      );
      if (btn) btn.classList.toggle("has-notes", hasContent);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  el("toast-container").appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add("show"));
  });
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── Wish List ─────────────────────────────────────────────────────────────────

function updateWishlistFilterOptions() {
  const genres = [
    ...new Set(state.wishlist.flatMap((m) => m.genres || [])),
  ].sort();
  const f = state.wishlistFilters;
  el("wl-filter-genre").innerHTML =
    '<option value="">All Genres</option>' +
    genres
      .map(
        (g) =>
          `<option value="${g}" ${f.genre === g ? "selected" : ""}>${esc(g)}</option>`,
      )
      .join("");
  el("wl-filter-platform").style.display = "";
}

function renderWishlist() {
  const grid = el("wishlist-grid");
  let list = state.wishlist;
  const f = state.wishlistFilters;
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((m) => m.title?.toLowerCase().includes(q));
  }
  if (f.type) list = list.filter((m) => m.type === f.type);
  if (f.genre) list = list.filter((m) => (m.genres || []).includes(f.genre));
  if (f.minRating)
    list = list.filter((m) => (m.rating || 0) >= parseFloat(f.minRating));
  if (f.platform)
    list = list.filter((m) => (m.platforms || []).includes(f.platform));
  list = [...list].sort((a, b) => {
    const av = a[f.sort] ?? "",
      bv = b[f.sort] ?? "";
    if (av < bv) return f.order === "desc" ? 1 : -1;
    if (av > bv) return f.order === "desc" ? -1 : 1;
    return 0;
  });
  if (!list.length) {
    grid.innerHTML = state.wishlist.length
      ? '<div class="empty"><span>No movies match your filters.</span></div>'
      : `<div class="empty"><span>Your wish list is empty.</span><span>Click <strong>+ Add Movie</strong> to add movies you want to watch.</span></div>`;
    return;
  }
  if (state.wishlistGroupByPlatform) {
    const PLATFORMS = ["Netflix", "Disney+", "Amazon", "Apple"];
    const groups = {};
    for (const p of PLATFORMS) groups[p] = [];
    groups["Other"] = [];
    for (const m of list) {
      const ps = (m.platforms || []).filter((p) => PLATFORMS.includes(p));
      if (ps.length) {
        ps.forEach((p) => groups[p].push(m));
      } else {
        groups["Other"].push(m);
      }
    }
    grid.innerHTML = [...PLATFORMS, "Other"]
      .filter((p) => groups[p].length)
      .map(
        (p) => `
        <div class="wl-group">
          <div class="wl-group-header">${p === "Other" ? "No Platform" : p}</div>
          <div class="movie-grid wl-group-grid">${groups[p].map((m) => movieCard(m, "wishlist")).join("")}</div>
        </div>`,
      )
      .join("");
  } else {
    grid.innerHTML = list.map((m) => movieCard(m, "wishlist")).join("");
  }
}

async function loadWishlist() {
  try {
    state.wishlist = await api.getWishlist();
    const hasEmpty = state.wishlist.some((m) => !(m.platforms || []).length);
    if (hasEmpty) {
      await api.refreshWishlistPlatforms();
      state.wishlist = await api.getWishlist();
    }
  } catch (err) {
    showToast(err.message, "error");
  }
  renderWishlist();
  updateWishlistFilterOptions();
}

function applyWishlistMode(mode) {
  state.wishlistMode = mode;
  el("wishlist-mode-label").textContent =
    mode === "books" ? "📚 Books" : "🎬 Movies";
  el("wishlist-section-sub").textContent =
    mode === "books" ? "Books you want to read" : "Movies you want to watch";
  el("wishlist-movies-panel").classList.toggle("hidden", mode === "books");
  el("wishlist-books-panel").classList.toggle("hidden", mode === "movies");
  el("wishlist-movies-actions").style.display =
    mode === "books" ? "none" : "flex";
  el("wishlist-books-actions").style.display =
    mode === "books" ? "flex" : "none";
}

function renderBooksWishlist() {
  const grid = el("books-wishlist-grid");
  let list = state.booksWishlist;
  const f = state.booksWishlistFilters;
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter(
      (b) =>
        b.title?.toLowerCase().includes(q) ||
        (b.authors || []).some((a) => a.toLowerCase().includes(q)),
    );
  }
  if (f.genre) list = list.filter((b) => (b.genres || []).includes(f.genre));
  list = [...list].sort((a, b) => {
    const key = f.sort;
    const av = key === "author" ? a.authors?.[0] || "" : (a[key] ?? "");
    const bv = key === "author" ? b.authors?.[0] || "" : (b[key] ?? "");
    return av < bv ? 1 : av > bv ? -1 : 0;
  });
  if (!list.length) {
    grid.innerHTML = state.booksWishlist.length
      ? '<div class="empty"><span>No books match your filters.</span></div>'
      : `<div class="empty"><span>Your book wish list is empty.</span><span>Click <strong>+ Add Book</strong> to add books you want to read.</span></div>`;
    return;
  }
  grid.innerHTML = list.map((b) => bookCard(b, "wishlist")).join("");
}

async function loadBooksWishlist() {
  try {
    state.booksWishlist = await api.getBookWishlist();
  } catch (err) {
    showToast(err.message, "error");
  }
  renderBooksWishlist();
  updateBooksWishlistFilterOptions();
}

function updateBooksWishlistFilterOptions() {
  const genres = [
    ...new Set(state.booksWishlist.flatMap((b) => b.genres || [])),
  ].sort();
  const sel = el("bwl-filter-genre");
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">All Genres</option>' +
    genres
      .map(
        (g) =>
          `<option value="${esc(g)}"${g === cur ? " selected" : ""}>${esc(g)}</option>`,
      )
      .join("");
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function renderCalendar() {
  const d = state.calendarMonth;
  const year = d.getFullYear(),
    month = d.getMonth();
  el("cal-month-label").textContent = `${MONTH_NAMES[month]} ${year}`;

  const isBooks = state.calendarMode === "books";
  const items = isBooks ? state.books : state.movies;
  const noItemEmoji = isBooks ? "📚" : "🎬";

  const byDay = {};
  for (const m of items) {
    if (!m.addedAt) continue;
    const md = new Date(m.addedAt);
    if (md.getFullYear() === year && md.getMonth() === month) {
      const day = md.getDate();
      (byDay[day] = byDay[day] || []).push(m);
    }
  }

  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isThisMonth =
    today.getFullYear() === year && today.getMonth() === month;

  let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((n) => `<div class="cal-header-cell">${n}</div>`)
    .join("");

  for (let i = 0; i < firstDayOfWeek; i++)
    cells += `<div class="cal-day empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayItems = byDay[day] || [];
    const isToday = isThisMonth && today.getDate() === day;
    const postersHtml = dayItems
      .slice(0, 5)
      .map((m) => {
        const id = esc(
          m.imdbId ||
            m.googleBooksId ||
            m.tmdbId?.toString() ||
            m.openLibraryId ||
            "",
        );
        const cover = m.poster || m.cover;
        return cover
          ? `<img class="cal-poster" src="${esc(cover)}" data-id="${id}" alt="${esc(m.title)}" loading="lazy">`
          : `<div class="cal-poster cal-no-poster" data-id="${id}" title="${esc(m.title)}">${noItemEmoji}</div>`;
      })
      .join("");
    cells += `<div class="cal-day${isToday ? " today" : ""}">
      <span class="cal-day-num${dayItems.length ? " has-movies" : ""}">${day}</span>
      <div class="cal-day-movies">${postersHtml}</div>
    </div>`;
  }

  const totalCells = firstDayOfWeek + daysInMonth;
  const tail = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < tail; i++) cells += `<div class="cal-day empty"></div>`;

  el("cal-grid").innerHTML = cells;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goToSection(name) {
  state.section = name;
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.add("hidden"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  el(`section-${name}`)?.classList.remove("hidden");
  document
    .querySelector(`.nav-btn[data-section="${name}"]`)
    ?.classList.add("active");
  if (name === "suggestions" && !state.suggestions.length) loadSuggestions();
  if (name === "trash") loadTrash();
  if (name === "calendar") renderCalendar();
  if (name === "books" && !state.books.length && !state.loading.books)
    loadBooks();
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadMovies() {
  state.loading.movies = true;
  renderMovies();
  try {
    state.movies = await api.getMovies(state.filters);
  } catch (err) {
    showToast(err.message, "error");
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
    showToast(`Suggestions failed: ${err.message}`, "error");
  }
  state.loading.suggestions = false;
  renderSuggestions();
  updateSuggestionFilterOptions();
}

async function loadSettings() {
  try {
    state.settings = await api.getSettings();
    if (state.settings.tabsMode) {
      state.tabsMode = state.settings.tabsMode;
      applyTabsMode(state.tabsMode);
    }
    renderSettings();
  } catch {
    /* ignore */
  }
}

async function loadTrash() {
  state.loading.trash = true;
  renderTrash();
  try {
    [state.trash, state.booksTrash] = await Promise.all([
      api.getTrash(),
      api.getBooksTrash(),
    ]);
  } catch (err) {
    showToast(err.message, "error");
  }
  state.loading.trash = false;
  renderTrash();
  updateTrashBadge();
}

// ── Remove movie ──────────────────────────────────────────────────────────────

async function removeMovie(id) {
  const movie = state.movies.find(
    (m) => m.imdbId === id || m.tmdbId?.toString() === id,
  );
  try {
    await api.removeMovie(id);
    state.movies = state.movies.filter(
      (m) => m.imdbId !== id && m.tmdbId?.toString() !== id,
    );
    if (movie) {
      movie.deletedAt = new Date().toISOString();
      state.trash.unshift(movie);
    }
    renderMovies();
    updateFilterOptions();
    renderSidebar();
    updateTrashBadge();
    showToast("Moved to Trash", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── Search (debounced) ────────────────────────────────────────────────────────

const doSearchBooks = debounce(async (query) => {
  if (!query.trim()) {
    el("search-results").innerHTML = "";
    return;
  }
  el("search-spinner").classList.remove("hidden");
  el("search-results").innerHTML = "";
  try {
    const results = await api.searchBooks(query);
    showBookSearchResults(results);
  } catch (err) {
    el("search-results").innerHTML =
      `<div class="no-results">Search error: ${esc(err.message)}</div>`;
  } finally {
    el("search-spinner").classList.add("hidden");
  }
}, 380);

const doSearch = debounce(async (query) => {
  if (!query.trim()) {
    el("search-results").innerHTML = "";
    return;
  }
  el("search-spinner").classList.remove("hidden");
  el("search-results").innerHTML = "";
  try {
    const results = await api.search(query);
    showSearchResults(results);
  } catch (err) {
    el("search-results").innerHTML =
      `<div class="no-results">Search error: ${esc(err.message)}</div>`;
  } finally {
    el("search-spinner").classList.add("hidden");
  }
}, 380);

// ── Event wiring ──────────────────────────────────────────────────────────────

function init() {
  // Navigation
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToSection(btn.dataset.section));
  });

  // Add movie button
  el("btn-add").addEventListener("click", () => openModal("movie"));

  // Modal close
  el("modal-overlay").addEventListener("click", (e) => {
    if (e.target === el("modal-overlay")) closeModal();
  });
  el("modal-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.modal.open) closeModal();
    if (e.key === "Escape" && state.notesPopup.open) saveAndCloseNotes();
  });

  // Notes popup: save on click outside
  el("notes-overlay").addEventListener("click", (e) => {
    if (e.target === el("notes-overlay")) saveAndCloseNotes();
  });

  // Notes popup: suggested-by autocomplete
  el("notes-suggested-by").addEventListener("input", (e) => {
    const val = e.target.value;
    const sugg = el("notes-suggested-suggestions");
    if (!val.trim()) {
      sugg.classList.add("hidden");
      return;
    }
    const lv = val.toLowerCase();
    const matches = getSuggestedByNames().filter(
      (n) => n.toLowerCase().startsWith(lv) && n.toLowerCase() !== lv,
    );
    if (!matches.length) {
      sugg.classList.add("hidden");
      return;
    }
    sugg.innerHTML = matches
      .slice(0, 5)
      .map((n) => `<div class="notes-autocomplete-item">${esc(n)}</div>`)
      .join("");
    sugg.classList.remove("hidden");
  });

  el("notes-suggested-suggestions").addEventListener("click", (e) => {
    const item = e.target.closest(".notes-autocomplete-item");
    if (!item) return;
    el("notes-suggested-by").value = item.textContent;
    el("notes-suggested-suggestions").classList.add("hidden");
    el("notes-text").focus();
  });

  // Search input
  el("search-input").addEventListener("input", (e) => {
    if (state.modalMode === "book") {
      doSearchBooks(e.target.value);
      return;
    }
    const q = e.target.value.trim();
    if (/^tt\d+$/.test(q)) {
      showMoviePreview(q, null, "movie");
    } else {
      doSearch(e.target.value);
    }
  });

  // Click on search result
  el("search-results").addEventListener("click", (e) => {
    const result = e.target.closest(".search-result");
    if (!result) return;
    if (state.modalMode === "book") {
      showBookPreview(
        result.dataset.googleBooksId || null,
        result.dataset.openLibraryId || null,
        result.dataset.source,
      );
    } else {
      showMoviePreview(
        result.dataset.imdb || null,
        result.dataset.tmdb || null,
        result.dataset.type,
      );
    }
  });

  // Filters
  el("search-movies").addEventListener(
    "input",
    debounce((e) => {
      state.filters.q = e.target.value;
      renderMovies();
    }, 250),
  );
  el("filter-type").addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    loadMovies();
  });
  el("filter-year").addEventListener("change", (e) => {
    state.filters.year = e.target.value;
    loadMovies();
  });
  el("filter-genre").addEventListener("change", (e) => {
    state.filters.genre = e.target.value;
    loadMovies();
  });
  el("filter-rating").addEventListener("change", (e) => {
    state.filters.minRating = e.target.value;
    loadMovies();
  });
  el("filter-sort").addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    loadMovies();
  });

  // Remove movie (X button on poster)
  el("movies-grid").addEventListener("click", async (e) => {
    const removeBtn = e.target.closest(".btn-remove-x");
    if (removeBtn) {
      removeMovie(removeBtn.dataset.id);
      return;
    }

    const rewatchBtn = e.target.closest(".btn-rewatch-flag");
    if (rewatchBtn) {
      const id = rewatchBtn.dataset.id;
      const movie = state.movies.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      if (!movie) return;
      try {
        const result = await api.setMovieRewatch(id);
        movie.rewatch = result.rewatch;
        rewatchBtn.classList.toggle("active", Boolean(movie.rewatch));
        rewatchBtn.title = movie.rewatch
          ? "Marked for rewatch — click to unmark"
          : "Mark for rewatch";
        if (state.filters.rewatch) renderMovies();
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }

    const notesBtn = e.target.closest(".btn-notes");
    if (notesBtn) {
      openNotesPopup(notesBtn.dataset.id, "movie");
      return;
    }

    if (!e.target.closest("button, .card-heart")) {
      const imdbId = e.target.closest(".movie-card")?.dataset.imdb;
      if (imdbId) {
        window.open(`https://www.imdb.com/title/${imdbId}/`, "_blank");
        return;
      }
    }

    // Heart rating on card
    const heart = e.target.closest(".card-heart");
    if (heart) {
      const heartsEl = heart.closest(".card-hearts");
      const id = heartsEl?.dataset.id;
      if (!id) return;
      const val = parseInt(heart.dataset.val);
      const movie = state.movies.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      if (!movie) return;
      const newVal = movie.hearts === val ? 0 : val;
      try {
        await api.setHearts(id, newVal);
        movie.hearts = newVal;
        // Re-render just the hearts row in-place for instant feedback
        heartsEl.querySelectorAll(".card-heart").forEach((h) => {
          h.classList.toggle("filled", parseInt(h.dataset.val) <= newVal);
        });
        if (state.filters.minHearts > 0) renderMovies(); // reapply filter
      } catch (err) {
        showToast(err.message, "error");
      }
    }
  });

  // Heart filter (in filter bar)
  el("heart-filter").addEventListener("click", (e) => {
    const h = e.target.closest(".hf-heart");
    if (!h) return;
    const val = parseInt(h.dataset.val);
    state.filters.minHearts = state.filters.minHearts === val ? 0 : val;
    renderHeartFilter();
    renderMovies();
  });

  // Flag filter (movies)
  el("flag-filter-movies").addEventListener("click", () => {
    state.filters.rewatch = !state.filters.rewatch;
    el("flag-filter-movies").classList.toggle("active", state.filters.rewatch);
    renderMovies();
  });

  // Add from suggestions
  el("suggestions-grid").addEventListener("click", async (e) => {
    if (!e.target.closest("button")) {
      const imdbId = e.target.closest(".movie-card")?.dataset.imdb;
      if (imdbId) {
        window.open(`https://www.imdb.com/title/${imdbId}/`, "_blank");
        return;
      }
    }
    const wlBtn = e.target.closest(".btn-sugg-wishlist");
    if (wlBtn) {
      wlBtn.disabled = true;
      wlBtn.textContent = "…";
      try {
        const movie = await api.addToWishlist({
          imdbId: wlBtn.dataset.imdb || undefined,
          tmdbId: wlBtn.dataset.tmdb || undefined,
          type: wlBtn.dataset.type || "movie",
        });
        state.wishlist.unshift(movie);
        wlBtn.textContent = "★ Listed";
        wlBtn.classList.add("added");
        updateWishlistFilterOptions();
        showToast(`"${movie.title}" added to Wish List!`, "success");
      } catch (err) {
        wlBtn.disabled = false;
        wlBtn.textContent = "☆ List";
        showToast(err.message, "error");
      }
      return;
    }
    const btn = e.target.closest(".btn-add-suggestion");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Adding…";
    try {
      const movie = await api.addMovie({
        imdbId: btn.dataset.imdb || undefined,
        tmdbId: btn.dataset.tmdb || undefined,
        type: btn.dataset.type || "movie",
      });
      state.movies.unshift(movie);
      btn.textContent = "✓ Added";
      btn.classList.add("added");
      updateFilterOptions();
      renderSidebar();
      showToast(`"${movie.title}" added!`, "success");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "+ Watched";
      showToast(err.message, "error");
    }
  });

  // Trash grid (restore / delete forever) — handles both movies and books
  el("trash-grid").addEventListener("click", async (e) => {
    if (!e.target.closest("button")) {
      const card = e.target.closest(".movie-card");
      if (card?.dataset.itemType !== "book") {
        const imdbId = card?.dataset.imdb;
        if (imdbId) {
          window.open(`https://www.imdb.com/title/${imdbId}/`, "_blank");
          return;
        }
      } else if (card?.dataset.googleUrl) {
        window.open(card.dataset.googleUrl, "_blank");
        return;
      }
    }

    const restoreBtn = e.target.closest(".btn-restore");
    if (restoreBtn) {
      const id = restoreBtn.dataset.id;
      const isBook =
        restoreBtn.closest(".movie-card")?.dataset.itemType === "book";
      if (isBook) {
        const book = state.booksTrash.find(
          (b) => (b.googleBooksId || b.openLibraryId) === id,
        );
        try {
          await api.restoreBook(id);
          state.booksTrash = state.booksTrash.filter(
            (b) => (b.googleBooksId || b.openLibraryId) !== id,
          );
          if (book) {
            delete book.deletedAt;
            state.books.unshift(book);
            updateBookFilterOptions();
            renderSidebar();
          }
          renderTrash();
          updateTrashBadge();
          showToast(`"${book?.title || "Book"}" restored!`, "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      } else {
        const movie = state.trash.find(
          (m) => (m.imdbId || m.tmdbId?.toString()) === id,
        );
        try {
          await api.restoreMovie(id);
          state.trash = state.trash.filter(
            (m) => (m.imdbId || m.tmdbId?.toString()) !== id,
          );
          if (movie) {
            delete movie.deletedAt;
            state.movies.unshift(movie);
            updateFilterOptions();
            renderSidebar();
          }
          renderTrash();
          updateTrashBadge();
          showToast(`"${movie?.title || "Movie"}" restored!`, "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      }
      return;
    }

    const deleteBtn = e.target.closest(".btn-delete-forever");
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const isBook =
        deleteBtn.closest(".movie-card")?.dataset.itemType === "book";
      if (isBook) {
        const book = state.booksTrash.find(
          (b) => (b.googleBooksId || b.openLibraryId) === id,
        );
        if (
          !confirm(
            `Permanently delete "${book?.title || "this book"}"? This cannot be undone.`,
          )
        )
          return;
        try {
          await api.deleteBookForever(id);
          state.booksTrash = state.booksTrash.filter(
            (b) => (b.googleBooksId || b.openLibraryId) !== id,
          );
          renderTrash();
          updateTrashBadge();
          showToast("Deleted permanently", "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      } else {
        const movie = state.trash.find(
          (m) => (m.imdbId || m.tmdbId?.toString()) === id,
        );
        if (
          !confirm(
            `Permanently delete "${movie?.title || "this movie"}"? This cannot be undone.`,
          )
        )
          return;
        try {
          await api.deleteForever(id);
          state.trash = state.trash.filter(
            (m) => (m.imdbId || m.tmdbId?.toString()) !== id,
          );
          renderTrash();
          updateTrashBadge();
          showToast("Deleted permanently", "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      }
    }
  });

  // Empty trash (movies + books)
  el("btn-empty-trash").addEventListener("click", async () => {
    const total = state.trash.length + state.booksTrash.length;
    if (!total) return;
    if (
      !confirm(
        `Permanently delete all ${total} item${total > 1 ? "s" : ""} in Trash? This cannot be undone.`,
      )
    )
      return;
    try {
      await Promise.all([
        state.trash.length ? api.emptyTrash() : Promise.resolve(),
        state.booksTrash.length ? api.emptyBooksTrash() : Promise.resolve(),
      ]);
      state.trash = [];
      state.booksTrash = [];
      renderTrash();
      updateTrashBadge();
      showToast("Trash emptied", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Suggestion filters
  el("sugg-filter-type").addEventListener("change", (e) => {
    state.suggFilters.type = e.target.value;
    renderSuggestions();
  });
  el("sugg-filter-genre").addEventListener("change", (e) => {
    state.suggFilters.genre = e.target.value;
    renderSuggestions();
  });
  el("sugg-filter-rating").addEventListener("change", (e) => {
    state.suggFilters.minRating = e.target.value;
    renderSuggestions();
  });
  el("sugg-filter-platform").addEventListener("change", (e) => {
    state.suggFilters.platform = e.target.value;
    renderSuggestions();
  });

  // Refresh suggestions
  el("btn-refresh").addEventListener("click", () => {
    if (state.suggMode === "books") {
      state.bookSuggestions = [];
      state.bookSuggFilters = { genre: "" };
      el("bsugg-filter-genre").value = "";
      loadBookSuggestions();
    } else {
      state.suggestions = [];
      state.suggFilters = { type: "", genre: "", minRating: "", platform: "" };
      el("sugg-filter-type").value = "";
      el("sugg-filter-genre").value = "";
      el("sugg-filter-rating").value = "";
      el("sugg-filter-platform").value = "";
      loadSuggestions();
    }
  });

  // Suggestions: mode toggle
  el("sugg-mode-toggle").addEventListener("click", () => {
    const next = state.suggMode === "movies" ? "books" : "movies";
    applySuggMode(next);
    if (
      next === "books" &&
      !state.bookSuggestions.length &&
      !state.loading.bookSuggestions
    ) {
      loadBookSuggestions();
    }
  });

  // Book suggestions: genre filter
  el("bsugg-filter-genre").addEventListener("change", (e) => {
    state.bookSuggFilters.genre = e.target.value;
    renderBookSuggestions();
  });

  // Book suggestions: grid interactions
  el("book-suggestions-grid").addEventListener("click", async (e) => {
    if (!e.target.closest("button")) {
      const card = e.target.closest(".movie-card");
      if (card?.dataset.googleUrl) {
        window.open(card.dataset.googleUrl, "_blank");
        return;
      }
    }
    const addBtn = e.target.closest(".btn-add-book-suggestion");
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Adding…";
      try {
        const book = await api.addBook({
          googleBooksId: addBtn.dataset.googleBooksId || undefined,
          openLibraryId: addBtn.dataset.openLibraryId || undefined,
          isbn: addBtn.dataset.isbn || undefined,
        });
        state.books.unshift(book);
        addBtn.textContent = "✓ Added";
        addBtn.classList.add("added");
        updateBookFilterOptions();
        renderSidebar();
        showToast(`"${book.title}" added to My Books!`, "success");
      } catch (err) {
        addBtn.disabled = false;
        addBtn.textContent = "+ Read";
        showToast(err.message, "error");
      }
      return;
    }
    const wlBtn = e.target.closest(".btn-sugg-book-wishlist");
    if (wlBtn) {
      wlBtn.disabled = true;
      wlBtn.textContent = "…";
      try {
        const book = await api.addBookToWishlist({
          googleBooksId: wlBtn.dataset.googleBooksId || undefined,
          openLibraryId: wlBtn.dataset.openLibraryId || undefined,
          isbn: wlBtn.dataset.isbn || undefined,
        });
        state.booksWishlist.unshift(book);
        wlBtn.textContent = "★ Listed";
        wlBtn.classList.add("added");
        updateBooksWishlistFilterOptions();
        showToast(`"${book.title}" added to Book Wish List!`, "success");
      } catch (err) {
        wlBtn.disabled = false;
        wlBtn.textContent = "☆ List";
        showToast(err.message, "error");
      }
    }
  });

  // Settings form
  el("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      state.settings = await api.saveSettings({
        tmdb: el("setting-tmdb").value.trim(),
      });
      renderSettings();
      state.suggestions = [];
      showToast("Settings saved!", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
    btn.disabled = false;
    btn.textContent = "Save Settings";
  });

  // Toggle API key visibility
  el("toggle-key").addEventListener("click", () => {
    const inp = el("setting-tmdb");
    inp.type = inp.type === "password" ? "text" : "password";
  });

  // Clear key button
  el("btn-clear-key").addEventListener("click", async () => {
    if (!confirm("Remove the TMDB API key?")) return;
    try {
      state.settings = await api.saveSettings({ tmdb: "" });
      renderSettings();
      state.suggestions = [];
      showToast("API key removed", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // NYT API key form
  el("settings-nyt-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      state.settings = await api.saveSettings({
        nyt: el("setting-nyt").value.trim(),
      });
      renderSettings();
      state.bookSuggestions = [];
      showToast("NYT key saved!", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
    btn.disabled = false;
    btn.textContent = "Save Key";
  });

  el("toggle-nyt-key").addEventListener("click", () => {
    const inp = el("setting-nyt");
    inp.type = inp.type === "password" ? "text" : "password";
  });

  el("btn-clear-nyt-key").addEventListener("click", async () => {
    if (!confirm("Remove the NYT Books API key?")) return;
    try {
      state.settings = await api.saveSettings({ nyt: "" });
      renderSettings();
      state.bookSuggestions = [];
      showToast("NYT key removed", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  el("btn-save-country").addEventListener("click", async () => {
    const country = el("setting-country").value;
    try {
      state.settings = await api.saveSettings({ country });
      showToast("Streaming region saved", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Wish List: group by platform toggle
  el("btn-group-platform").addEventListener("click", () => {
    state.wishlistGroupByPlatform = !state.wishlistGroupByPlatform;
    el("btn-group-platform").classList.toggle(
      "active",
      state.wishlistGroupByPlatform,
    );
    renderWishlist();
  });

  // Wish List: add button
  el("btn-add-wishlist").addEventListener("click", () => openModal("movie"));

  // Wish List: filters
  el("search-wishlist").addEventListener(
    "input",
    debounce((e) => {
      state.wishlistFilters.q = e.target.value;
      renderWishlist();
    }, 250),
  );
  el("wl-filter-type").addEventListener("change", (e) => {
    state.wishlistFilters.type = e.target.value;
    renderWishlist();
  });
  el("wl-filter-genre").addEventListener("change", (e) => {
    state.wishlistFilters.genre = e.target.value;
    renderWishlist();
  });
  el("wl-filter-rating").addEventListener("change", (e) => {
    state.wishlistFilters.minRating = e.target.value;
    renderWishlist();
  });
  el("wl-filter-platform").addEventListener("change", (e) => {
    state.wishlistFilters.platform = e.target.value;
    renderWishlist();
  });
  el("wl-filter-sort").addEventListener("change", (e) => {
    state.wishlistFilters.sort = e.target.value;
    renderWishlist();
  });

  // Wish List: grid interactions
  el("wishlist-grid").addEventListener("click", async (e) => {
    if (!e.target.closest("button, .card-heart")) {
      const imdbId = e.target.closest(".movie-card")?.dataset.imdb;
      if (imdbId) {
        window.open(`https://www.imdb.com/title/${imdbId}/`, "_blank");
        return;
      }
    }
    const removeBtn = e.target.closest(".btn-remove-x");
    if (removeBtn) {
      const id = removeBtn.dataset.id;
      const movie = state.wishlist.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      try {
        await api.removeFromWishlist(id);
        state.wishlist = state.wishlist.filter(
          (m) => (m.imdbId || m.tmdbId?.toString()) !== id,
        );
        renderWishlist();
        updateWishlistFilterOptions();
        showToast(
          `"${movie?.title || "Movie"}" removed from Wish List`,
          "success",
        );
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    const watchedBtn = e.target.closest(".btn-mark-watched");
    if (watchedBtn) {
      const id = watchedBtn.dataset.id;
      const movie = state.wishlist.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      watchedBtn.disabled = true;
      watchedBtn.textContent = "Moving…";
      try {
        const watched = await api.markWatched(id);
        state.wishlist = state.wishlist.filter(
          (m) => (m.imdbId || m.tmdbId?.toString()) !== id,
        );
        state.movies.unshift(watched);
        renderWishlist();
        updateWishlistFilterOptions();
        renderMovies();
        updateFilterOptions();
        renderSidebar();
        showToast(`"${movie?.title || "Movie"}" moved to watched!`, "success");
      } catch (err) {
        watchedBtn.disabled = false;
        watchedBtn.textContent = "✓ Mark as Watched";
        showToast(err.message, "error");
      }
      return;
    }
    const heart = e.target.closest(".card-heart");
    if (heart) {
      const heartsEl = heart.closest(".card-hearts");
      const id = heartsEl?.dataset.id;
      if (!id) return;
      const val = parseInt(heart.dataset.val);
      const movie = state.wishlist.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      if (!movie) return;
      const newVal = movie.hearts === val ? 0 : val;
      try {
        await api.setWishlistHearts(id, newVal);
        movie.hearts = newVal;
        heartsEl
          .querySelectorAll(".card-heart")
          .forEach((h) =>
            h.classList.toggle("filled", parseInt(h.dataset.val) <= newVal),
          );
      } catch (err) {
        showToast(err.message, "error");
      }
    }
  });

  // Wish List: mode toggle
  el("wishlist-mode-toggle").addEventListener("click", () => {
    const next = state.wishlistMode === "movies" ? "books" : "movies";
    applyWishlistMode(next);
  });

  // Books wishlist: add button
  el("btn-add-book-wishlist").addEventListener("click", () =>
    openModal("book"),
  );

  // Books wishlist: filters
  el("search-books-wishlist").addEventListener(
    "input",
    debounce((e) => {
      state.booksWishlistFilters.q = e.target.value;
      renderBooksWishlist();
    }, 250),
  );
  el("bwl-filter-genre").addEventListener("change", (e) => {
    state.booksWishlistFilters.genre = e.target.value;
    renderBooksWishlist();
  });
  el("bwl-filter-sort").addEventListener("change", (e) => {
    state.booksWishlistFilters.sort = e.target.value;
    renderBooksWishlist();
  });

  // Books wishlist: grid interactions
  el("books-wishlist-grid").addEventListener("click", async (e) => {
    if (!e.target.closest("button, .card-heart")) {
      const card = e.target.closest(".movie-card");
      if (card?.dataset.googleUrl) {
        window.open(card.dataset.googleUrl, "_blank");
        return;
      }
    }
    const removeBtn = e.target.closest(".btn-remove-x");
    if (removeBtn) {
      const id = removeBtn.dataset.id;
      const book = state.booksWishlist.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      try {
        await api.removeFromBookWishlist(id);
        state.booksWishlist = state.booksWishlist.filter(
          (b) => (b.googleBooksId || b.openLibraryId) !== id,
        );
        renderBooksWishlist();
        updateBooksWishlistFilterOptions();
        showToast(
          `"${book?.title || "Book"}" removed from wish list`,
          "success",
        );
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }
    const readBtn = e.target.closest(".btn-mark-read");
    if (readBtn) {
      const id = readBtn.dataset.id;
      const book = state.booksWishlist.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      readBtn.disabled = true;
      readBtn.textContent = "Moving…";
      try {
        const read = await api.markBookAsRead(id);
        state.booksWishlist = state.booksWishlist.filter(
          (b) => (b.googleBooksId || b.openLibraryId) !== id,
        );
        state.books.unshift(read);
        renderBooksWishlist();
        updateBooksWishlistFilterOptions();
        renderBooks();
        updateBookFilterOptions();
        renderSidebar();
        showToast(`"${book?.title || "Book"}" moved to My Books!`, "success");
      } catch (err) {
        readBtn.disabled = false;
        readBtn.textContent = "✓ Mark as Read";
        showToast(err.message, "error");
      }
      return;
    }
    const heart = e.target.closest(".card-heart");
    if (heart) {
      const heartsEl = heart.closest(".card-hearts");
      const id = heartsEl?.dataset.id;
      if (!id) return;
      const val = parseInt(heart.dataset.val);
      const book = state.booksWishlist.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      if (!book) return;
      const newVal = book.hearts === val ? 0 : val;
      try {
        await api.setBookWishlistHearts(id, newVal);
        book.hearts = newVal;
        heartsEl
          .querySelectorAll(".card-heart")
          .forEach((h) =>
            h.classList.toggle("filled", parseInt(h.dataset.val) <= newVal),
          );
      } catch (err) {
        showToast(err.message, "error");
      }
    }
  });

  // Calendar navigation
  el("cal-prev").addEventListener("click", () => {
    const d = state.calendarMonth;
    state.calendarMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    renderCalendar();
  });
  el("cal-next").addEventListener("click", () => {
    const d = state.calendarMonth;
    state.calendarMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    renderCalendar();
  });

  // Calendar tooltip
  let calHovered = null;
  document.addEventListener("mousemove", (e) => {
    const tooltip = el("cal-tooltip");
    if (!tooltip.classList.contains("visible")) return;
    tooltip.style.left =
      Math.min(e.clientX + 14, window.innerWidth - 230) + "px";
    tooltip.style.top = Math.max(e.clientY - 80, 10) + "px";
  });
  el("cal-grid").addEventListener("mouseover", (e) => {
    const target = e.target.closest(".cal-poster");
    if (target === calHovered) return;
    calHovered = target;
    const tooltip = el("cal-tooltip");
    if (!target) {
      tooltip.classList.remove("visible");
      return;
    }
    const id = target.dataset.id;
    const isBooks = state.calendarMode === "books";
    const item = isBooks
      ? state.books.find((b) => (b.googleBooksId || b.openLibraryId) === id)
      : state.movies.find((m) => (m.imdbId || m.tmdbId?.toString()) === id);
    if (!item) {
      tooltip.classList.remove("visible");
      return;
    }
    const cover = item.poster || item.cover;
    const metaParts = isBooks
      ? [
          item.year,
          item.authors?.length ? `By ${item.authors[0]}` : null,
          item.rating ? "★ " + Number(item.rating).toFixed(1) : null,
        ].filter(Boolean)
      : [
          item.year,
          typeLabel(item.type),
          item.rating ? "★ " + Number(item.rating).toFixed(1) : null,
        ].filter(Boolean);
    tooltip.innerHTML = `
      ${cover ? `<img class="cal-tt-poster" src="${esc(cover)}" alt="">` : ""}
      <div class="cal-tt-title">${esc(item.title)}</div>
      <div class="cal-tt-meta">${metaParts.join(" · ")}</div>
      <div class="cal-tt-genres">${(item.genres || [])
        .slice(0, 2)
        .map((g) => `<span class="genre-tag">${esc(g)}</span>`)
        .join("")}</div>
    `;
    tooltip.classList.add("visible");
  });
  el("cal-grid").addEventListener("mouseout", (e) => {
    if (!e.relatedTarget?.closest("#cal-grid")) {
      calHovered = null;
      el("cal-tooltip").classList.remove("visible");
    }
  });
  el("cal-grid").addEventListener("click", (e) => {
    const poster = e.target.closest(".cal-poster");
    if (!poster) return;
    const id = poster.dataset.id;
    if (state.calendarMode === "books") {
      const book = state.books.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      if (book?.googleBooksId)
        window.open(
          `https://books.google.com/books?id=${book.googleBooksId}`,
          "_blank",
        );
    } else {
      const movie = state.movies.find(
        (m) => (m.imdbId || m.tmdbId?.toString()) === id,
      );
      if (movie?.imdbId)
        window.open(`https://www.imdb.com/title/${movie.imdbId}/`, "_blank");
    }
  });

  // Add book button
  el("btn-add-book").addEventListener("click", () => openModal("book"));

  // Books: search filter
  el("search-books").addEventListener(
    "input",
    debounce((e) => {
      state.bookFilters.q = e.target.value;
      renderBooks();
    }, 250),
  );
  el("book-filter-genre").addEventListener("change", (e) => {
    state.bookFilters.genre = e.target.value;
    renderBooks();
  });
  el("book-filter-rating").addEventListener("change", (e) => {
    state.bookFilters.minRating = e.target.value;
    renderBooks();
  });
  el("book-filter-sort").addEventListener("change", (e) => {
    state.bookFilters.sort = e.target.value;
    renderBooks();
  });

  // Books: heart filter
  el("book-heart-filter").addEventListener("click", (e) => {
    const h = e.target.closest(".hf-heart");
    if (!h) return;
    const val = parseInt(h.dataset.val);
    state.bookFilters.minHearts = state.bookFilters.minHearts === val ? 0 : val;
    renderBookHeartFilter();
    renderBooks();
  });

  // Flag filter (books)
  el("flag-filter-books").addEventListener("click", () => {
    state.bookFilters.rewatch = !state.bookFilters.rewatch;
    el("flag-filter-books").classList.toggle(
      "active",
      state.bookFilters.rewatch,
    );
    renderBooks();
  });

  // Books: grid interactions
  el("books-grid").addEventListener("click", async (e) => {
    const removeBtn = e.target.closest(".btn-remove-x");
    if (removeBtn) {
      removeBook(removeBtn.dataset.id);
      return;
    }

    const rewatchBtn = e.target.closest(".btn-rewatch-flag");
    if (rewatchBtn) {
      const id = rewatchBtn.dataset.id;
      const book = state.books.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      if (!book) return;
      try {
        const result = await api.setBookReread(id);
        book.rewatch = result.rewatch;
        rewatchBtn.classList.toggle("active", Boolean(book.rewatch));
        rewatchBtn.title = book.rewatch
          ? "Marked for reread — click to unmark"
          : "Mark for reread";
        if (state.bookFilters.rewatch) renderBooks();
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }

    const notesBtn = e.target.closest(".btn-notes");
    if (notesBtn) {
      openNotesPopup(notesBtn.dataset.id, "book");
      return;
    }

    if (!e.target.closest("button, .card-heart")) {
      const card = e.target.closest(".movie-card");
      if (card?.dataset.googleUrl) {
        window.open(card.dataset.googleUrl, "_blank");
        return;
      }
    }
    const heart = e.target.closest(".card-heart");
    if (heart) {
      const heartsEl = heart.closest(".card-hearts");
      const id = heartsEl?.dataset.id;
      if (!id) return;
      const val = parseInt(heart.dataset.val);
      const book = state.books.find(
        (b) => (b.googleBooksId || b.openLibraryId) === id,
      );
      if (!book) return;
      const newVal = book.hearts === val ? 0 : val;
      try {
        await api.setBookHearts(id, newVal);
        book.hearts = newVal;
        heartsEl.querySelectorAll(".card-heart").forEach((h) => {
          h.classList.toggle("filled", parseInt(h.dataset.val) <= newVal);
        });
        if (state.bookFilters.minHearts > 0) renderBooks();
      } catch (err) {
        showToast(err.message, "error");
      }
    }
  });

  // Calendar: mode toggle
  el("cal-mode-toggle").addEventListener("click", () => {
    state.calendarMode = state.calendarMode === "movies" ? "books" : "movies";
    el("cal-mode-label").textContent =
      state.calendarMode === "books" ? "📚 Books" : "🎬 Movies";
    renderCalendar();
  });

  // Settings: triple tabs toggle
  document.querySelectorAll(".tabs-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.mode;
      applyTabsMode(mode);
      try {
        state.settings = await api.saveSettings({ tabsMode: mode });
      } catch (err) {
        showToast("Could not save tab preference", "error");
      }
    });
  });

  // Trash: book restore / delete forever (piggybacking on existing trash-grid handler)
  // handled inside the existing trash-grid click handler below (via data-item-type)

  // Initial data load
  Promise.all([
    loadMovies(),
    loadBooks(),
    loadSettings(),
    loadTrash(),
    loadWishlist(),
    loadBooksWishlist(),
  ]);
}

init();
