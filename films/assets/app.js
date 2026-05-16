const ADMIN_ENABLED = document.body.dataset.admin === "true";

const STORAGE = {
  films: "filmSentenceData",
  pairings: "filmSentencePairings",
  votes: "filmSentenceVotes",
  submissions: "filmSentenceSubmissions"
};

const URLS = {
  films: "/films/data/films.json",
  pairings: "/films/data/pairings.json",
  votes: "/films/data/votes.json",
  submissions: "/films/data/submissions.json",
  apiHealth: "/films/api/health.py",
  apiVote: "/films/api/vote.py",
  apiSubmit: "/films/api/submit-line.py"
};

let films = [];
let pairings = [];
let votes = {};
let submissions = {};
let apiAvailable = false;
let dataSource = "server JSON";
let currentChallengeSlug = "";
let challengeLimit = ADMIN_ENABLED ? 99999 : 12;

const state = {
  query: "",
  tag: "all",
  status: "all",
  minScore: 0,
  sort: "score-desc",
  mode: "beatAiMode"
};

const $ = (id) => document.getElementById(id);

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function getStored(key, fallback) {
  return safeJsonParse(localStorage.getItem(key), fallback);
}

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value, null, 2));
}

async function getJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    dataSource = "local/browser fallback";
    return fallback;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function loadData() {
  const savedFilms = localStorage.getItem(STORAGE.films);
  const savedPairings = localStorage.getItem(STORAGE.pairings);

  films = savedFilms ? safeJsonParse(savedFilms, []) : await getJson(URLS.films, []);
  pairings = savedPairings ? safeJsonParse(savedPairings, []) : await getJson(URLS.pairings, []);
  votes = await getJson(URLS.votes, {});
  submissions = await getJson(URLS.submissions, {});

  votes = { ...votes, ...getStored(STORAGE.votes, {}) };
  submissions = { ...submissions, ...getStored(STORAGE.submissions, {}) };

  if (savedFilms || savedPairings) dataSource = "browser localStorage";

  try {
    const health = await postJson(URLS.apiHealth, {});
    apiAvailable = health.ok === true;
  } catch {
    apiAvailable = false;
  }
}

function saveLocalData() {
  setStored(STORAGE.films, films);
  setStored(STORAGE.pairings, pairings);
  setStored(STORAGE.votes, votes);
  setStored(STORAGE.submissions, submissions);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function filmSlug(film) {
  return film.slug || slugify(`${film.title}-${film.year}`);
}

function getFilm(slug) {
  return films.find(film => filmSlug(film) === slug);
}

function scoreText(rating) {
  const score = Number(rating || 0);
  return score > 0 ? `${score}/10` : "Unscored";
}

function stars(rating) {
  const score = Number(rating || 0);
  const count = Math.round(score / 2);
  return "★".repeat(count) + "☆".repeat(Math.max(0, 5 - count));
}

function isReviewed(film) {
  return film.status === "reviewed" || Boolean(film.review && film.review !== "Human champion pending.");
}

function runtimeText(film) {
  return film.runtime_minutes ? `${film.runtime_minutes} min` : "Unknown";
}

function rankText(film) {
  return film.rank ? `#${film.rank}` : "Unranked";
}

function filmGenres(film, limit = 4) {
  const decade = `${Math.floor(Number(film.year || 0) / 10) * 10}s`;
  const hidden = new Set(["canon", decade]);
  return (film.tags || []).filter(tag => !hidden.has(tag)).slice(0, limit);
}

function metadataGrid(film) {
  return `
    <div class="meta-grid">
      <div class="meta-chip rank-chip"><strong>Rank</strong>${rankText(film)}</div>
      <div class="meta-chip"><strong>Runtime</strong>${runtimeText(film)}</div>
      <div class="meta-chip"><strong>Director</strong>${film.director || "Unknown"}</div>
      <div class="meta-chip"><strong>Country</strong>${film.country || "Unknown"}</div>
    </div>
  `;
}

function genreLine(film) {
  const tags = filmGenres(film);
  return tags.length ? `<div class="genre-line">${tags.map(tag => `<span>${tag}</span>`).join("")}</div>` : "";
}

function allTags() {
  return [...new Set(films.flatMap(film => film.tags || []))].sort();
}

function topTags(limit = 12) {
  const counts = new Map();
  for (const film of films) {
    for (const tag of film.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function allDecades() {
  return [...new Set(films.map(film => `${Math.floor(Number(film.year || 0) / 10) * 10}s`))].sort();
}

function averageScore() {
  const scored = films.map(film => Number(film.rating || 0)).filter(score => score > 0);
  if (!scored.length) return "0";
  return (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1);
}

function pendingSubmissionCount() {
  return Object.values(submissions).reduce((total, group) => total + (Array.isArray(group) ? group.length : 0), 0);
}

function syncStateFromControls() {
  if ($("searchInput")) state.query = $("searchInput").value.trim().toLowerCase();
  if ($("statusFilter")) state.status = $("statusFilter").value;
  if ($("scoreFilter")) state.minScore = Number($("scoreFilter").value || 0);
  if ($("sortSelect")) state.sort = $("sortSelect").value;
}

function syncControlsFromState() {
  if ($("searchInput")) $("searchInput").value = state.query;
  if ($("statusFilter")) $("statusFilter").value = state.status;
  if ($("scoreFilter")) $("scoreFilter").value = String(state.minScore);
  if ($("sortSelect")) $("sortSelect").value = state.sort;
}

function filmMatches(film) {
  const haystack = [
    film.title,
    film.year,
    film.director,
    film.country,
    film.review,
    film.ai_review,
    film.ai_rematch,
    film.source,
    film.status,
    ...(film.tags || [])
  ].join(" ").toLowerCase();

  if (state.query && !haystack.includes(state.query)) return false;
  if (state.tag !== "all" && !(film.tags || []).includes(state.tag)) return false;
  if (Number(film.rating || 0) < state.minScore) return false;
  if (state.status === "reviewed" && !isReviewed(film)) return false;
  if (state.status === "pending" && isReviewed(film)) return false;
  return true;
}

function sortFilms(items) {
  return [...items].sort((a, b) => {
    if (state.sort === "score-desc") return (Number(b.rating || 0) - Number(a.rating || 0)) || a.title.localeCompare(b.title);
    if (state.sort === "year-desc") return Number(b.year || 0) - Number(a.year || 0) || a.title.localeCompare(b.title);
    if (state.sort === "year-asc") return Number(a.year || 0) - Number(b.year || 0) || a.title.localeCompare(b.title);
    if (state.sort === "title-asc") return a.title.localeCompare(b.title);
    if (state.sort === "recent-update") return String(b.updated_at || "").localeCompare(String(a.updated_at || "")) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
}

function filteredFilms() {
  return sortFilms(films.filter(filmMatches));
}

function filteredChallengeFilms() {
  return sortFilms(films.filter(film => film.ai_review && film.review && filmMatches(film)));
}

function filmVotes(slug) {
  const v = votes[slug] || {};
  return {
    ai: Number(v.ai || 0),
    human: Number(v.human || 0),
    rematch: Number(v.rematch || 0)
  };
}

function leaderFor(film, slug) {
  const v = filmVotes(slug);
  const entries = [
    ["ai", v.ai],
    ["human", v.human]
  ];
  if (film.ai_rematch) entries.push(["rematch", v.rematch]);
  entries.sort((a, b) => b[1] - a[1]);
  if (!entries[0] || entries[0][1] === 0) return "new";
  if (entries[1] && entries[0][1] === entries[1][1]) return "tied";
  return entries[0][0];
}

function statusBadges(film, slug) {
  const v = filmVotes(slug);
  const leader = leaderFor(film, slug);
  const label = {
    ai: "AI currently winning",
    human: "Human currently winning",
    rematch: "AI rematch currently winning",
    tied: "Currently tied",
    new: "Awaiting votes"
  }[leader];

  const klass = leader === "human" ? "winner-human" : leader === "ai" ? "winner-ai" : leader === "rematch" ? "winner-rematch" : "";

  return `
    <div class="challenge-status">
      <span class="${klass}">${label}</span>
      <span>Original AI: ${v.ai}</span>
      <span>Human: ${v.human}</span>
      ${film.ai_rematch ? `<span>Rematch: ${v.rematch}</span>` : ""}
      <span>${film.ai_rematch ? "AI rematch active" : "No AI rematch yet"}</span>
    </div>
  `;
}

function rematchDraftFor(film) {
  const templates = [
    `${film.title} returns for a rematch: less summary, more pressure and one eye on why the human line worked.`,
    `The AI tries again: ${film.title} is not only important, it is difficult to escape cleanly.`,
    `Second attempt: ${film.title} turns reputation into something the viewer has to feel, not just admire.`,
    `AI rematch draft: the human line saw the wound; this version tries to see the scar.`,
    `The machine comes back with more atmosphere and fewer excuses.`
  ];
  return templates[(film.title.length + Number(film.year || 0)) % templates.length];
}

function renderTags() {
  const row = $("tagRow");
  if (!row) return;
  const tags = ["all", ...topTags(12)];
  row.innerHTML = tags.map(tag => `<button type="button" class="tag ${tag === state.tag ? "active" : ""}" data-tag="${tag}">${tag === "all" ? "All" : tag}</button>`).join("");
}

function renderCollections() {
  const row = $("collectionRow");
  if (!row) return;
  const items = [...topTags(10), ...allDecades()];
  row.innerHTML = items.map(item => `<span class="tag">${item}</span>`).join("");
}

function renderStats() {
  if ($("statFilms")) $("statFilms").textContent = films.length;
  if ($("statTags")) $("statTags").textContent = allTags().length;
  if ($("statAverageScore")) $("statAverageScore").textContent = averageScore();
  if ($("adminPendingCount")) $("adminPendingCount").textContent = pendingSubmissionCount();
  if ($("adminFilmCount")) $("adminFilmCount").textContent = films.length;
  if ($("adminPairingCount")) $("adminPairingCount").textContent = pairings.length;
}

function renderSystemStatus() {
  const target = $("systemStatus");
  if (!target) return;
  target.innerHTML = `
    <div class="system-card ${apiAvailable ? "good" : "warn"}"><strong>API</strong>${apiAvailable ? "available" : "fallback/local only"}</div>
    <div class="system-card"><strong>Data source</strong>${dataSource}</div>
    <div class="system-card"><strong>Pending submissions</strong>${pendingSubmissionCount()}</div>
    <div class="system-card"><strong>Challenge view</strong>${ADMIN_ENABLED ? "all challenges" : `${Math.min(challengeLimit, filteredChallengeFilms().length)} shown`}</div>
  `;
}

function renderReviews() {
  const grid = $("reviewGrid");
  if (!grid) return;
  const visible = filteredFilms();

  grid.innerHTML = visible.map(film => {
    const slug = filmSlug(film);
    const reviewed = isReviewed(film);
    return `
      <article class="review-card" id="${slug}">
        <div>
          <h3 class="film-title">${film.title}</h3>
          <p class="film-meta">${film.year} · ${film.country || "Unknown country"} · ${film.director || "Unknown director"}</p>
          ${metadataGrid(film)}
          ${genreLine(film)}
          <div class="score-line">
            <span class="score-badge">Martin: ${scoreText(film.rating)}</span>
            <span class="stars" aria-label="${scoreText(film.rating)}">${stars(film.rating)}</span>
          </div>
          <p class="film-review">${film.review || "Review pending."}</p>
        </div>
        <div class="card-footer">
          <div class="mini-tags">
            <span class="status-pill ${reviewed ? "reviewed" : ""}">${reviewed ? "reviewed" : "pending"}</span>
            ${(film.tags || []).slice(0, 2).map(tag => `<span>${tag}</span>`).join("")}
          </div>
          ${ADMIN_ENABLED ? `<button type="button" class="secondary small-button edit-review-button" data-slug="${slug}">Edit review</button>` : ""}
        </div>
      </article>
    `;
  }).join("");

  if ($("emptyState")) $("emptyState").style.display = visible.length ? "none" : "block";
  if ($("resultCount")) $("resultCount").textContent = visible.length === films.length ? `Showing all ${films.length} films` : `Showing ${visible.length} of ${films.length} films`;
}

function renderChallenges() {
  const grid = $("challengeGrid");
  if (!grid) return;

  const all = filteredChallengeFilms();
  const visible = ADMIN_ENABLED ? all : all.slice(0, challengeLimit);

  grid.innerHTML = visible.map(film => {
    const slug = filmSlug(film);
    const v = filmVotes(slug);
    return `
      <article class="line-card ${slug === currentChallengeSlug ? "today-focus" : ""}" id="challenge-${slug}" data-challenge-slug="${slug}">
        <div>
          <h3>${film.title} (${film.year})</h3>
          ${statusBadges(film, slug)}
          ${metadataGrid(film)}
          ${genreLine(film)}
          <div class="score-line">
            <span class="score-badge secondary-score">Martin: ${scoreText(film.rating)}</span>
            <span class="stars" aria-label="${scoreText(film.rating)}">${stars(film.rating)}</span>
          </div>
          <div class="line-meta">Original AI first draft</div>
          <blockquote>${film.ai_review}</blockquote>
        </div>
        <div>
          <div class="line-meta">Current human champion</div>
          <blockquote>${film.review}</blockquote>
        </div>
        ${film.ai_rematch ? `
          <div class="rematch-block">
            <div class="line-meta">AI rematch</div>
            <blockquote>${film.ai_rematch}</blockquote>
          </div>
        ` : ""}
        <div class="vote-row">
          <button type="button" class="secondary vote-button" data-slug="${slug}" data-target="ai">Vote original AI</button>
          <button type="button" class="vote-button" data-slug="${slug}" data-target="human">Vote human</button>
          ${film.ai_rematch ? `<button type="button" class="secondary vote-button" data-slug="${slug}" data-target="rematch">Vote AI rematch</button>` : ""}
          <span class="vote-count">AI ${v.ai} · Human ${v.human}${film.ai_rematch ? ` · Rematch ${v.rematch}` : ""}</span>
        </div>
        <form class="submission-form" data-slug="${slug}">
          <input class="submission-input" maxlength="220" placeholder="Write a better one-line review..." />
          <div class="vote-row">
            <button type="submit" class="secondary">Submit line</button>
            <span class="vote-count">${apiAvailable ? "Sent to moderation queue" : "Saved locally until API is available"}</span>
          </div>
        </form>
        <div class="submission-list">
          ${(submissions[slug] || []).map((submission, index) => `
            <div class="submission-item">
              <p>${submission.text}</p>
              <div class="vote-row">
                ${ADMIN_ENABLED ? `<button type="button" class="small-button promote-submission" data-slug="${slug}" data-index="${index}">Make champion</button>` : ""}
                <span class="vote-count">${submission.created_at || "draft"}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");

  const wrap = $("loadMoreChallenges");
  const button = $("loadMoreChallengesButton");
  if (wrap && button) {
    const remaining = all.length - challengeLimit;
    wrap.style.display = (!ADMIN_ENABLED && remaining > 0) ? "flex" : "none";
    button.textContent = `Load more challenges (${remaining} remaining)`;
  }
}

function renderModeration() {
  if (!ADMIN_ENABLED || !$("moderationGrid")) return;
  const rows = Object.entries(submissions).flatMap(([slug, items]) => {
    const film = getFilm(slug);
    return (items || []).map((submission, index) => ({ slug, film, submission, index }));
  });

  if (!rows.length) {
    $("moderationGrid").innerHTML = `<div class="public-note">No submitted lines are waiting for moderation.</div>`;
    return;
  }

  $("moderationGrid").innerHTML = rows.map(row => `
    <article class="moderation-item">
      <strong>${row.film?.title || row.slug}</strong>
      <p>${row.submission.text}</p>
      <div class="vote-row">
        <button type="button" class="small-button promote-submission" data-slug="${row.slug}" data-index="${row.index}">Make champion</button>
        <button type="button" class="small-button danger-button reject-submission" data-slug="${row.slug}" data-index="${row.index}">Reject</button>
        <span class="vote-count">${row.submission.created_at || "draft"}</span>
      </div>
    </article>
  `).join("");
}

function renderPairings() {
  const grid = $("pairingGrid");
  if (!grid) return;
  grid.innerHTML = pairings.map(pairing => {
    const film = getFilm(pairing.film_id);
    const comparison = getFilm(pairing.comparison_film_id);
    if (!film || !comparison) return "";
    return `
      <article class="line-card">
        <div>
          <h3>${film.title} <span style="color:var(--muted);">through</span> ${comparison.title}</h3>
          <div class="line-meta">${pairing.angle}</div>
          <div class="meta-grid">
            <div class="meta-chip"><strong>Reviewed film</strong>${film.director || "Unknown"} · ${film.country || "Unknown"} · ${film.year}</div>
            <div class="meta-chip"><strong>Comparison</strong>${comparison.director || "Unknown"} · ${comparison.country || "Unknown"} · ${comparison.year}</div>
          </div>
          <blockquote>${pairing.text}</blockquote>
        </div>
        <div class="vote-row">
          <button type="button" class="pairing-vote-button" data-pairing-id="${pairing.id}">Vote for this line</button>
          <span class="vote-count">${pairing.votes || 0} votes</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderFilmSelects() {
  if (!ADMIN_ENABLED || !$("pairingFilmSelect") || !$("comparisonFilmSelect")) return;
  const options = sortFilms(films).map(film => `<option value="${filmSlug(film)}">${film.title} (${film.year})</option>`).join("");
  $("pairingFilmSelect").innerHTML = options;
  $("comparisonFilmSelect").innerHTML = options;
  ensureDifferentPairingSelection();
}

function renderModeNotice() {
  if (!$("modeNotice")) return;
  $("modeNotice").textContent = ADMIN_ENABLED
    ? "Admin mode. Review moderation first, then export JSON after editorial changes."
    : "Public view. Submissions and votes are sent to the server if the API is available, otherwise stored locally.";
}

function render() {
  syncControlsFromState();
  renderTags();
  renderCollections();
  renderStats();
  renderSystemStatus();
  renderReviews();
  renderChallenges();
  renderModeration();
  renderPairings();
  renderFilmSelects();
  renderModeNotice();
}

function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  document.querySelectorAll(".mode-section").forEach(section => section.classList.toggle("active", section.dataset.section === mode));
}

function modeForHash(hash) {
  const clean = String(hash || "").replace("#", "").toLowerCase();
  if (clean === "reviews") return "reviewsMode";
  if (clean === "pairings") return "pairingsMode";
  if (clean === "beat-ai" || clean === "challenges" || clean === "") return "beatAiMode";
  return null;
}

function applyHashMode() {
  const mode = modeForHash(window.location.hash);
  if (mode) switchMode(mode);
}

function randomChallengeFilm() {
  const candidates = films.filter(film => film.ai_review && film.review);
  if (!candidates.length) return null;
  const film = candidates[Math.floor(Math.random() * candidates.length)];
  currentChallengeSlug = filmSlug(film);
  if ($("randomReview")) $("randomReview").textContent = film.ai_review;
  if ($("randomMeta")) $("randomMeta").textContent = `${film.title}, ${film.director || "Unknown director"}, ${film.year} · Martin: ${scoreText(film.rating)} · Open this challenge to vote or write a better line.`;
  return film;
}

function resetFiltersForToday() {
  state.query = "";
  state.tag = "all";
  state.status = "all";
  state.minScore = 0;
}

function openTodayChallenge() {
  let film = currentChallengeSlug ? getFilm(currentChallengeSlug) : null;
  if (!film) film = randomChallengeFilm();
  if (!film) return;

  currentChallengeSlug = filmSlug(film);
  resetFiltersForToday();

  const all = sortFilms(films.filter(item => item.ai_review && item.review));
  const index = all.findIndex(item => filmSlug(item) === currentChallengeSlug);
  if (!ADMIN_ENABLED && index >= challengeLimit) {
    challengeLimit = Math.ceil((index + 1) / 12) * 12;
  }

  switchMode("beatAiMode");
  render();

  window.setTimeout(() => {
    const card = document.getElementById(`challenge-${currentChallengeSlug}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("today-focus-pulse");
      window.setTimeout(() => card.classList.remove("today-focus-pulse"), 1600);
    }
  }, 80);
}

function ensureDifferentPairingSelection() {
  if (!$("pairingFilmSelect") || !$("comparisonFilmSelect")) return;
  if ($("pairingFilmSelect").value === $("comparisonFilmSelect").value) {
    const alternative = [...$("comparisonFilmSelect").options].find(option => option.value !== $("pairingFilmSelect").value);
    if (alternative) $("comparisonFilmSelect").value = alternative.value;
  }
}

async function voteForLine(slug, target) {
  votes[slug] = votes[slug] || { ai: 0, human: 0, rematch: 0 };
  votes[slug][target] = Number(votes[slug][target] || 0) + 1;
  setStored(STORAGE.votes, votes);
  render();

  try {
    const server = await postJson(URLS.apiVote, { kind: "challenge", slug, target });
    if (server.votes) {
      votes = server.votes;
      setStored(STORAGE.votes, votes);
      render();
    }
  } catch (error) {
    console.warn(error);
    apiAvailable = false;
    renderSystemStatus();
  }
}

async function voteForPairing(pairingId) {
  pairings = pairings.map(pairing => pairing.id === pairingId ? { ...pairing, votes: Number(pairing.votes || 0) + 1 } : pairing);
  setStored(STORAGE.pairings, pairings);
  renderPairings();

  try {
    const server = await postJson(URLS.apiVote, { kind: "pairing", pairing_id: pairingId });
    if (server.pairings) {
      pairings = server.pairings;
      setStored(STORAGE.pairings, pairings);
      renderPairings();
    }
  } catch (error) {
    console.warn(error);
    apiAvailable = false;
    renderSystemStatus();
  }
}

async function submitLine(slug, text) {
  if (!text) return;
  submissions[slug] = submissions[slug] || [];
  submissions[slug].unshift({ text, status: "submitted", created_at: new Date().toISOString().slice(0, 10) });
  setStored(STORAGE.submissions, submissions);
  render();

  try {
    const server = await postJson(URLS.apiSubmit, { slug, text });
    if (server.submissions) {
      submissions = server.submissions;
      setStored(STORAGE.submissions, submissions);
      render();
    }
  } catch (error) {
    console.warn(error);
    apiAvailable = false;
    renderSystemStatus();
  }
}

function promoteSubmission(slug, index) {
  const film = getFilm(slug);
  const submission = submissions[slug]?.[index];
  if (!film || !submission) return;

  film.review = submission.text;
  film.status = "reviewed";
  film.winner = "human";
  film.updated_at = new Date().toISOString().slice(0, 10);
  submissions[slug].splice(index, 1);
  if (!submissions[slug].length) delete submissions[slug];

  saveLocalData();
  render();
}

function rejectSubmission(slug, index) {
  if (!submissions[slug]) return;
  submissions[slug].splice(index, 1);
  if (!submissions[slug].length) delete submissions[slug];
  saveLocalData();
  render();
}

function editFilm(slug) {
  const film = getFilm(slug);
  if (!film) return;
  if ($("editingSlug")) $("editingSlug").value = slug;
  if ($("titleInput")) $("titleInput").value = film.title || "";
  if ($("yearInput")) $("yearInput").value = film.year || "";
  if ($("directorInput")) $("directorInput").value = film.director || "";
  if ($("countryInput")) $("countryInput").value = film.country || "";
  if ($("ratingInput")) $("ratingInput").value = film.rating || 5;
  if ($("tagsInput")) $("tagsInput").value = (film.tags || []).join("; ");
  if ($("aiReviewInput")) $("aiReviewInput").value = film.ai_review || "";
  if ($("aiRematchInput")) $("aiRematchInput").value = film.ai_rematch || "";
  if ($("reviewInput")) $("reviewInput").value = film.review || "";
  if ($("saveFilmButton")) $("saveFilmButton").textContent = "Save review";
  if ($("filmEditor")) $("filmEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearEditor() {
  if ($("addFilmForm")) $("addFilmForm").reset();
  if ($("editingSlug")) $("editingSlug").value = "";
  if ($("saveFilmButton")) $("saveFilmButton").textContent = "Add to page";
}

function formTags() {
  return ($("tagsInput")?.value || "").split(";").map(tag => tag.trim().toLowerCase()).filter(Boolean);
}

function saveFilmFromEditor() {
  const existing = $("editingSlug")?.value || "";
  const previous = existing ? getFilm(existing) : null;
  const film = {
    ...(previous || {}),
    slug: existing || slugify(`${$("titleInput").value.trim()}-${$("yearInput").value}`),
    title: $("titleInput").value.trim(),
    year: Number($("yearInput").value),
    director: $("directorInput").value.trim(),
    country: $("countryInput").value.trim(),
    rating: Number($("ratingInput").value),
    tags: formTags(),
    review: $("reviewInput").value.trim(),
    ai_review: $("aiReviewInput").value.trim() || previous?.ai_review || "AI draft pending.",
    ai_rematch: $("aiRematchInput") ? $("aiRematchInput").value.trim() : previous?.ai_rematch || "",
    winner: previous?.winner || "",
    challenge_round: previous?.challenge_round || 1,
    status: $("reviewInput").value.trim() ? "reviewed" : "pending",
    updated_at: new Date().toISOString().slice(0, 10)
  };

  films = existing ? films.map(item => filmSlug(item) === existing ? film : item) : [film, ...films];
  saveLocalData();
  clearEditor();
  render();
}

function buildReviews() {
  return films.map(film => ({
    film_id: filmSlug(film),
    text: film.review || "Review pending.",
    author: "Martin Fry",
    status: film.status || "pending",
    rating: Number(film.rating || 0),
    updated_at: film.updated_at || null
  }));
}

function buildChallenges() {
  return films.map(film => ({
    film_id: filmSlug(film),
    text: film.ai_review || "AI draft pending.",
    ai_rematch: film.ai_rematch || "",
    status: film.ai_review ? "active" : "pending"
  }));
}

function buildBundle() {
  return {
    films,
    reviews: buildReviews(),
    ai_challenges: buildChallenges(),
    pairings,
    votes,
    submissions,
    exported_at: new Date().toISOString()
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.addEventListener("input", event => {
    if (event.target.id === "searchInput") {
      syncStateFromControls();
      render();
    }
  });

  document.addEventListener("change", event => {
    if (["statusFilter", "scoreFilter", "sortSelect"].includes(event.target.id)) {
      syncStateFromControls();
      render();
    }
    if (["pairingFilmSelect", "comparisonFilmSelect"].includes(event.target.id)) {
      ensureDifferentPairingSelection();
    }
  });

  document.addEventListener("submit", event => {
    const form = event.target;
    if (form.classList.contains("submission-form")) {
      event.preventDefault();
      const input = form.querySelector(".submission-input");
      const text = input ? input.value.trim() : "";
      submitLine(form.dataset.slug, text);
      if (input) input.value = "";
    }
    if (form.id === "addFilmForm") {
      event.preventDefault();
      saveFilmFromEditor();
    }
    if (form.id === "pairingForm") {
      event.preventDefault();
      const filmId = $("pairingFilmSelect").value;
      const comparisonId = $("comparisonFilmSelect").value;
      const text = $("pairingTextInput").value.trim();
      if (!filmId || !comparisonId || filmId === comparisonId || !text) return;
      pairings.unshift({
        id: slugify(`${filmId}-through-${comparisonId}-${Date.now()}`),
        film_id: filmId,
        comparison_film_id: comparisonId,
        angle: $("pairingAngleInput").value.trim() || "comparison",
        text,
        votes: 0,
        created_at: new Date().toISOString().slice(0, 10)
      });
      saveLocalData();
      form.reset();
      render();
      switchMode("pairingsMode");
    }
  });

  document.addEventListener("click", event => {
    const tagButton = event.target.closest("#tagRow [data-tag]");
    if (tagButton) {
      state.tag = tagButton.dataset.tag || "all";
      render();
      return;
    }

    const modeTab = event.target.closest(".mode-tab[data-mode]");
    if (modeTab) {
      switchMode(modeTab.dataset.mode);
      return;
    }

    if (event.target.closest("#todayChallengeButton, #randomReview, #randomMeta")) {
      openTodayChallenge();
      return;
    }

    if (event.target.closest("#randomButton")) {
      randomChallengeFilm();
      render();
      return;
    }

    if (event.target.closest("#loadMoreChallengesButton")) {
      challengeLimit += 12;
      render();
      return;
    }

    const voteButton = event.target.closest(".vote-button[data-slug][data-target]");
    if (voteButton) {
      voteForLine(voteButton.dataset.slug, voteButton.dataset.target);
      return;
    }

    const pairingVote = event.target.closest(".pairing-vote-button[data-pairing-id]");
    if (pairingVote) {
      voteForPairing(pairingVote.dataset.pairingId);
      return;
    }

    const promote = event.target.closest(".promote-submission[data-slug][data-index]");
    if (promote) {
      promoteSubmission(promote.dataset.slug, Number(promote.dataset.index));
      return;
    }

    const reject = event.target.closest(".reject-submission[data-slug][data-index]");
    if (reject) {
      rejectSubmission(reject.dataset.slug, Number(reject.dataset.index));
      return;
    }

    const edit = event.target.closest(".edit-review-button[data-slug]");
    if (edit) {
      editFilm(edit.dataset.slug);
      return;
    }

    if (event.target.closest("#generateRematchButton")) {
      const film = getFilm($("editingSlug")?.value || "");
      if (film && $("aiRematchInput")) $("aiRematchInput").value = rematchDraftFor(film);
      return;
    }

    if (event.target.closest("#cancelEditButton")) {
      clearEditor();
      return;
    }

    if (event.target.closest("#clearLocalButton")) {
      localStorage.removeItem(STORAGE.films);
      localStorage.removeItem(STORAGE.pairings);
      localStorage.removeItem(STORAGE.votes);
      localStorage.removeItem(STORAGE.submissions);
      window.location.reload();
      return;
    }

    if (event.target.closest("#downloadJsonButton")) downloadJson("films.json", films);
    if (event.target.closest("#downloadReviewsButton")) downloadJson("reviews.json", buildReviews());
    if (event.target.closest("#downloadChallengesButton")) downloadJson("ai-challenges.json", buildChallenges());
    if (event.target.closest("#downloadPairingsButton")) downloadJson("pairings.json", pairings);
    if (event.target.closest("#downloadBundleButton")) downloadJson("film-review-data-bundle.json", buildBundle());

    if (event.target.closest("#importBundleButton")) {
      try {
        const bundle = JSON.parse($("importBundleInput").value);
        if (!Array.isArray(bundle.films)) throw new Error("The bundle must include a films array.");
        films = bundle.films;
        pairings = Array.isArray(bundle.pairings) ? bundle.pairings : [];
        votes = bundle.votes || {};
        submissions = bundle.submissions || {};
        saveLocalData();
        if ($("importStatus")) $("importStatus").textContent = `Imported ${films.length} films, ${pairings.length} pairings and ${Object.keys(submissions).length} submission groups.`;
        render();
      } catch (error) {
        if ($("importStatus")) $("importStatus").textContent = `Import failed: ${error.message}`;
      }
    }
  });

  window.addEventListener("hashchange", applyHashMode);
}

loadData().then(() => {
  bindEvents();
  syncStateFromControls();
  randomChallengeFilm();
  render();
  applyHashMode();
});