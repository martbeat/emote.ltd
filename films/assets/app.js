const ADMIN_ENABLED = document.body.dataset.admin === "true";

const storageKey = "filmSentenceData";
const pairingsStorageKey = "filmSentencePairings";
const votesStorageKey = "filmSentenceVotes";
const submissionsStorageKey = "filmSentenceSubmissions";

const dataUrls = {
  films: "/films/data/films.json",
  pairings: "/films/data/pairings.json",
  votes: "/films/data/votes.json",
  submissions: "/films/data/submissions.json"
};

const apiUrls = {
  submit: "/films/api/submit-line.py",
  vote: "/films/api/vote.py"
};

let films = [];
let pairings = [];
let votes = {};
let submissions = {};
let activeTag = "all";
let challengeLimit = ADMIN_ENABLED ? 9999 : 12;
let apiAvailable = null;
let dataSource = "server JSON";

const $ = (id) => document.getElementById(id);

function on(id, eventName, handler) {
  const el = $(id);
  if (el) el.addEventListener(eventName, handler);
}

function loadStoredObject(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(url);
    return await response.json();
  } catch (error) {
    console.warn(`Could not load ${url}`, error);
    dataSource = "local/browser fallback";
    return fallback;
  }
}

async function loadData() {
  const savedFilms = localStorage.getItem(storageKey);
  const savedPairings = localStorage.getItem(pairingsStorageKey);

  films = savedFilms ? JSON.parse(savedFilms) : await fetchJson(dataUrls.films, []);
  pairings = savedPairings ? JSON.parse(savedPairings) : await fetchJson(dataUrls.pairings, []);
  votes = await fetchJson(dataUrls.votes, {});
  submissions = await fetchJson(dataUrls.submissions, {});

  votes = { ...votes, ...loadStoredObject(votesStorageKey, {}) };
  submissions = { ...submissions, ...loadStoredObject(submissionsStorageKey, {}) };

  if (savedFilms || savedPairings) dataSource = "browser localStorage";
  await checkApiAvailability();
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(films, null, 2));
  localStorage.setItem(pairingsStorageKey, JSON.stringify(pairings, null, 2));
  localStorage.setItem(votesStorageKey, JSON.stringify(votes, null, 2));
  localStorage.setItem(submissionsStorageKey, JSON.stringify(submissions, null, 2));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function checkApiAvailability() {
  try {
    const result = await postJson(apiUrls.vote, {
      kind: "challenge",
      slug: "blade-runner-1982",
      target: "human",
      dry_run: true
    });
    apiAvailable = result.ok === true;
  } catch {
    apiAvailable = false;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getFilm(slug) {
  return films.find(film => (film.slug || slugify(`${film.title}-${film.year}`)) === slug);
}

function scoreText(rating) {
  const score = Number(rating);
  return score > 0 ? `${score}/10` : "Unscored";
}

function stars(rating) {
  const score = Number(rating) || 0;
  const count = Math.round(score / 2);
  return "★".repeat(count) + "☆".repeat(Math.max(0, 5 - count));
}

function formatRuntime(film) {
  return film.runtime_minutes ? `${film.runtime_minutes} min` : "Unknown";
}

function formatRank(film) {
  return film.rank ? `#${film.rank}` : "Unranked";
}

function filmGenres(film, limit = 4) {
  const hidden = new Set(["canon", String(film.year // 10 * 10) + "s"]);
  return (film.tags || []).filter(tag => !hidden.has(tag)).slice(0, limit);
}

function metadataGrid(film) {
  return `
    <div class="meta-grid">
      <div class="meta-chip rank-chip"><strong>Rank</strong>${formatRank(film)}</div>
      <div class="meta-chip"><strong>Runtime</strong>${formatRuntime(film)}</div>
      <div class="meta-chip"><strong>Director</strong>${film.director || "Unknown"}</div>
      <div class="meta-chip"><strong>Country</strong>${film.country || "Unknown"}</div>
    </div>
  `;
}

function genreLine(film) {
  const genres = filmGenres(film);
  if (!genres.length) return "";
  return `<div class="genre-line">${genres.map(tag => `<span>${tag}</span>`).join("")}</div>`;
}

function isReviewed(film) {
  return film.status === "reviewed" || (film.review && !film.review.toLowerCase().includes("review pending"));
}

function averageScore() {
  const scored = films.map(film => Number(film.rating)).filter(score => score > 0);
  if (!scored.length) return "0";
  return (scored.reduce((total, score) => total + score, 0) / scored.length).toFixed(1);
}

function pendingSubmissionCount() {
  return Object.values(submissions).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
}

function allTags() {
  return [...new Set(films.flatMap(film => film.tags || []))].sort();
}

function allDecades() {
  return [...new Set(films.map(film => Math.floor(film.year / 10) * 10))].sort();
}

function topTags(limit = 12) {
  const counts = new Map();
  films.forEach(film => (film.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function matchesFilm(film, query) {
  const statusValue = $("statusFilter") ? $("statusFilter").value : "all";
  const scoreValue = $("scoreFilter") ? Number($("scoreFilter").value) : 0;

  const haystack = [
    film.title,
    film.year,
    film.director,
    film.country,
    film.review,
    film.ai_review,
    film.source,
    film.status,
    ...(film.tags || [])
  ].join(" ").toLowerCase();

  const searchMatch = haystack.includes(query.toLowerCase());
  const tagMatch = activeTag === "all" || (film.tags || []).includes(activeTag);
  const statusMatch = statusValue === "all"
    || (statusValue === "reviewed" && isReviewed(film))
    || (statusValue === "pending" && !isReviewed(film));
  const scoreMatch = Number(film.rating) >= scoreValue;
  return searchMatch && tagMatch && statusMatch && scoreMatch;
}

function sortFilms(items) {
  const mode = $("sortSelect") ? $("sortSelect").value : "score-desc";
  return [...items].sort((a, b) => {
    if (mode === "score-desc") return (Number(b.rating) || 0) - (Number(a.rating) || 0) || a.title.localeCompare(b.title);
    if (mode === "year-desc") return Number(b.year) - Number(a.year) || a.title.localeCompare(b.title);
    if (mode === "year-asc") return Number(a.year) - Number(b.year) || a.title.localeCompare(b.title);
    if (mode === "title-asc") return a.title.localeCompare(b.title);
    if (mode === "recent-update") return String(b.updated_at || "").localeCompare(String(a.updated_at || "")) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
}

function renderTags() {
  const tagRow = $("tagRow");
  if (!tagRow) return;

  const tags = ["all", ...topTags(12)];
  tagRow.innerHTML = tags.map(tag => `
    <button class="tag ${tag === activeTag ? "active" : ""}" type="button" data-tag="${tag}">
      ${tag === "all" ? "All" : tag}
    </button>
  `).join("");

  tagRow.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      activeTag = button.dataset.tag;
      render();
    });
  });
}

function renderCollections() {
  const collectionRow = $("collectionRow");
  if (!collectionRow) return;

  const collections = [...topTags(10), ...allDecades().map(decade => `${decade}s`)];
  collectionRow.innerHTML = collections.map(item => `<span class="tag">${item}</span>`).join("");
}

function renderStats() {
  if ($("statFilms")) $("statFilms").textContent = films.length;
  if ($("statTags")) $("statTags").textContent = allTags().length;
  if ($("statAverageScore")) $("statAverageScore").textContent = averageScore();
}

function renderSystemStatus() {
  const target = $("systemStatus");
  if (!target) return;

  target.innerHTML = `
    <div class="system-card ${apiAvailable ? "good" : "warn"}">
      <strong>API</strong>${apiAvailable ? "available" : "fallback/local only"}
    </div>
    <div class="system-card">
      <strong>Data source</strong>${dataSource}
    </div>
    <div class="system-card">
      <strong>Pending submissions</strong>${pendingSubmissionCount()}
    </div>
    <div class="system-card">
      <strong>Challenge view</strong>${ADMIN_ENABLED ? "all challenges" : `${Math.min(challengeLimit, films.length)} shown`}
    </div>
  `;
}

function renderAdminDashboard() {
  if (!ADMIN_ENABLED) return;
  if ($("adminPendingCount")) $("adminPendingCount").textContent = pendingSubmissionCount();
  if ($("adminFilmCount")) $("adminFilmCount").textContent = films.length;
  if ($("adminPairingCount")) $("adminPairingCount").textContent = pairings.length;
  if ($("adminApiState")) $("adminApiState").textContent = apiAvailable ? "available" : "fallback";
}

function renderFilmSelects() {
  if (!ADMIN_ENABLED) return;

  const pairingFilmSelect = $("pairingFilmSelect");
  const comparisonFilmSelect = $("comparisonFilmSelect");
  if (!pairingFilmSelect || !comparisonFilmSelect) return;

  const options = sortFilms(films).map(film => {
    const slug = film.slug || slugify(`${film.title}-${film.year}`);
    return `<option value="${slug}">${film.title} (${film.year})</option>`;
  }).join("");

  pairingFilmSelect.innerHTML = options;
  comparisonFilmSelect.innerHTML = options;
  ensureDifferentPairingSelection();
}

function ensureDifferentPairingSelection() {
  if (!ADMIN_ENABLED) return;

  const pairingFilmSelect = $("pairingFilmSelect");
  const comparisonFilmSelect = $("comparisonFilmSelect");
  if (!pairingFilmSelect || !comparisonFilmSelect || comparisonFilmSelect.options.length < 2) return;

  if (pairingFilmSelect.value === comparisonFilmSelect.value) {
    const alternative = [...comparisonFilmSelect.options].find(option => option.value !== pairingFilmSelect.value);
    if (alternative) comparisonFilmSelect.value = alternative.value;
  }
}

function renderReviews() {
  const grid = $("reviewGrid");
  if (!grid) return;

  const query = $("searchInput") ? $("searchInput").value.trim() : "";
  const visible = sortFilms(films.filter(film => matchesFilm(film, query)));

  grid.innerHTML = visible.map(film => {
    const slug = film.slug || slugify(`${film.title}-${film.year}`);
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

  if (ADMIN_ENABLED) {
    grid.querySelectorAll(".edit-review-button").forEach(button => {
      button.addEventListener("click", () => editFilm(button.dataset.slug));
    });
  }

  if ($("emptyState")) $("emptyState").style.display = visible.length ? "none" : "block";
  if ($("resultCount")) {
    $("resultCount").textContent = visible.length === films.length
      ? `Showing all ${films.length} films`
      : `Showing ${visible.length} of ${films.length} films`;
  }
}

function renderChallenges() {
  const challengeGrid = $("challengeGrid");
  if (!challengeGrid) return;

  const allChallengeFilms = sortFilms(films.filter(film => film.ai_review && film.review));
  const visibleChallengeFilms = ADMIN_ENABLED ? allChallengeFilms : allChallengeFilms.slice(0, challengeLimit);

  challengeGrid.innerHTML = visibleChallengeFilms.map(film => {
    const slug = film.slug || slugify(`${film.title}-${film.year}`);
    const filmVotes = votes[slug] || { ai: 0, human: 0 };
    const filmSubmissions = submissions[slug] || [];
    return `
      <article class="line-card" data-challenge-slug="${slug}">
        <div>
          <h3>${film.title} (${film.year})</h3>
          ${metadataGrid(film)}
          ${genreLine(film)}
          <div class="score-line">
            <span class="score-badge secondary-score">Martin: ${scoreText(film.rating)}</span>
            <span class="stars" aria-label="${scoreText(film.rating)}">${stars(film.rating)}</span>
          </div>
          <div class="line-meta">AI first draft</div>
          <blockquote>${film.ai_review}</blockquote>
        </div>
        <div>
          <div class="line-meta">Current human champion</div>
          <blockquote>${film.review}</blockquote>
        </div>
        <div class="vote-row">
          <button type="button" class="secondary vote-button" data-slug="${slug}" data-target="ai">Vote AI</button>
          <button type="button" class="vote-button" data-slug="${slug}" data-target="human">Vote human</button>
          <span class="vote-count">AI ${filmVotes.ai || 0} · Human ${filmVotes.human || 0}</span>
        </div>
        <form class="submission-form" data-slug="${slug}">
          <input class="submission-input" maxlength="220" placeholder="Write a better one-line review..." />
          <div class="vote-row">
            <button type="submit" class="secondary">Submit line</button>
            <span class="vote-count">${apiAvailable ? "Sent to moderation queue" : "Saved locally until API is available"}</span>
          </div>
        </form>
        <div class="submission-list">
          ${filmSubmissions.map((submission, index) => `
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

  const loadMoreTarget = $("loadMoreChallenges");
  const loadMoreButton = $("loadMoreChallengesButton");
  if (loadMoreTarget && loadMoreButton) {
    const remaining = allChallengeFilms.length - challengeLimit;
    loadMoreTarget.style.display = (!ADMIN_ENABLED && remaining > 0) ? "flex" : "none";
    loadMoreButton.textContent = `Load more challenges (${remaining} remaining)`;
  }

  challengeGrid.querySelectorAll(".vote-button").forEach(button => {
    button.addEventListener("click", () => voteForLine(button.dataset.slug, button.dataset.target));
  });

  challengeGrid.querySelectorAll(".submission-form").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const input = form.querySelector(".submission-input");
      submitChallengeLine(form.dataset.slug, input.value.trim());
      input.value = "";
    });
  });

  if (ADMIN_ENABLED) {
    challengeGrid.querySelectorAll(".promote-submission").forEach(button => {
      button.addEventListener("click", () => promoteSubmission(button.dataset.slug, Number(button.dataset.index)));
    });
  }
}

function renderModeration() {
  if (!ADMIN_ENABLED) return;

  const moderationGrid = $("moderationGrid");
  if (!moderationGrid) return;

  const rows = Object.entries(submissions).flatMap(([slug, items]) => {
    const film = getFilm(slug);
    return (items || []).map((submission, index) => ({ slug, film, submission, index }));
  });

  if (!rows.length) {
    moderationGrid.innerHTML = `<div class="public-note">No submitted lines are waiting for moderation.</div>`;
    return;
  }

  moderationGrid.innerHTML = rows.map(row => `
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

  moderationGrid.querySelectorAll(".promote-submission").forEach(button => {
    button.addEventListener("click", () => promoteSubmission(button.dataset.slug, Number(button.dataset.index)));
  });

  moderationGrid.querySelectorAll(".reject-submission").forEach(button => {
    button.addEventListener("click", () => rejectSubmission(button.dataset.slug, Number(button.dataset.index)));
  });
}

function renderPairings() {
  const pairingGrid = $("pairingGrid");
  if (!pairingGrid) return;

  pairingGrid.innerHTML = pairings.map(pairing => {
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

  pairingGrid.querySelectorAll(".pairing-vote-button").forEach(button => {
    button.addEventListener("click", () => voteForPairing(button.dataset.pairingId));
  });
}

function renderModeNotice() {
  const modeNotice = $("modeNotice");
  if (!modeNotice) return;

  modeNotice.innerHTML = ADMIN_ENABLED
    ? `Admin mode. Review moderation first, then export JSON after editorial changes.`
    : `Public view. Submissions and votes are sent to the server if the API is available, otherwise stored locally.`;
}

function render() {
  renderTags();
  renderCollections();
  renderStats();
  renderSystemStatus();
  renderAdminDashboard();
  renderFilmSelects();
  renderReviews();
  renderChallenges();
  renderModeration();
  renderPairings();
  renderModeNotice();
}

async function voteForLine(slug, target) {
  votes[slug] = votes[slug] || { ai: 0, human: 0 };
  votes[slug][target] = (votes[slug][target] || 0) + 1;
  saveData();
  renderChallenges();
  renderSystemStatus();

  try {
    const serverData = await postJson(apiUrls.vote, { kind: "challenge", slug, target });
    apiAvailable = true;
    if (serverData.votes) {
      votes = serverData.votes;
      localStorage.setItem(votesStorageKey, JSON.stringify(votes, null, 2));
      renderChallenges();
      renderSystemStatus();
    }
  } catch (error) {
    apiAvailable = false;
    console.warn("Vote API unavailable, using local vote only.", error);
    renderSystemStatus();
  }
}

async function submitChallengeLine(slug, text) {
  if (!text) return;

  submissions[slug] = submissions[slug] || [];
  submissions[slug].unshift({
    text,
    status: "submitted",
    created_at: new Date().toISOString().slice(0, 10)
  });
  saveData();
  renderChallenges();
  renderModeration();
  renderSystemStatus();
  renderAdminDashboard();

  try {
    const serverData = await postJson(apiUrls.submit, { slug, text });
    apiAvailable = true;
    if (serverData.submissions) {
      submissions = serverData.submissions;
      localStorage.setItem(submissionsStorageKey, JSON.stringify(submissions, null, 2));
      renderChallenges();
      renderModeration();
      renderSystemStatus();
      renderAdminDashboard();
    }
  } catch (error) {
    apiAvailable = false;
    console.warn("Submission API unavailable, using local submission only.", error);
    renderSystemStatus();
  }
}

function promoteSubmission(slug, index) {
  if (!ADMIN_ENABLED) return;

  const film = getFilm(slug);
  const submission = submissions[slug]?.[index];
  if (!film || !submission) return;

  film.review = submission.text;
  film.status = "reviewed";
  film.updated_at = new Date().toISOString().slice(0, 10);
  submissions[slug].splice(index, 1);
  if (!submissions[slug].length) delete submissions[slug];

  saveData();
  render();
  randomFilm();
}

function rejectSubmission(slug, index) {
  if (!ADMIN_ENABLED || !submissions[slug]) return;

  submissions[slug].splice(index, 1);
  if (!submissions[slug].length) delete submissions[slug];

  saveData();
  render();
}

async function voteForPairing(pairingId) {
  pairings = pairings.map(pairing => pairing.id === pairingId
    ? { ...pairing, votes: (pairing.votes || 0) + 1 }
    : pairing
  );
  saveData();
  renderPairings();

  try {
    const serverData = await postJson(apiUrls.vote, { kind: "pairing", pairing_id: pairingId });
    apiAvailable = true;
    if (serverData.pairings) {
      pairings = serverData.pairings;
      localStorage.setItem(pairingsStorageKey, JSON.stringify(pairings, null, 2));
      renderPairings();
      renderSystemStatus();
    }
  } catch (error) {
    apiAvailable = false;
    console.warn("Pairing vote API unavailable, using local vote only.", error);
    renderSystemStatus();
  }
}

function randomFilm() {
  const challengeFilms = films.filter(film => film.ai_review && film.review);
  if (!challengeFilms.length) return;

  const film = challengeFilms[Math.floor(Math.random() * challengeFilms.length)];
  if ($("randomReview")) $("randomReview").textContent = film.ai_review;
  if ($("randomMeta")) $("randomMeta").textContent = `${film.title}, ${film.director || "Unknown director"}, ${film.year} · Martin: ${scoreText(film.rating)} · Can you beat this AI line?`;
}

function switchMode(mode) {
  document.querySelectorAll(".mode-tab").forEach(item => {
    item.classList.toggle("active", item.dataset.mode === mode);
  });

  document.querySelectorAll(".mode-section").forEach(section => {
    section.classList.toggle("active", section.dataset.section === mode);
  });
}

function formTags() {
  const tagsInput = $("tagsInput");
  if (!tagsInput) return [];

  return tagsInput.value
    .split(";")
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);
}

function editFilm(slug) {
  if (!ADMIN_ENABLED) return;

  const film = getFilm(slug);
  if (!film) return;

  $("editingSlug").value = slug;
  $("titleInput").value = film.title || "";
  $("yearInput").value = film.year || "";
  $("directorInput").value = film.director || "";
  $("countryInput").value = film.country || "";
  $("ratingInput").value = film.rating || 5;
  $("tagsInput").value = (film.tags || []).join("; ");
  $("aiReviewInput").value = film.ai_review || "";
  $("reviewInput").value = film.review || "";
  $("saveFilmButton").textContent = "Save review";

  const editor = $("filmEditor") || $("admin");
  if (editor) editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearEditor() {
  const form = $("addFilmForm");
  if (form) form.reset();

  if ($("editingSlug")) $("editingSlug").value = "";
  if ($("saveFilmButton")) $("saveFilmButton").textContent = "Add to page";
}

function buildReviews() {
  return films.map(film => ({
    film_id: film.slug || slugify(`${film.title}-${film.year}`),
    text: film.review || "Review pending.",
    author: "Martin Fry",
    status: film.status || "pending",
    rating: Number(film.rating) || 0,
    updated_at: film.updated_at || null
  }));
}

function buildChallenges() {
  return films.map(film => ({
    film_id: film.slug || slugify(`${film.title}-${film.year}`),
    text: film.ai_review || "AI draft pending.",
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


function modeForHash(hash) {
  const clean = (hash || "").replace("#", "").toLowerCase();
  if (clean === "reviews") return "reviewsMode";
  if (clean === "pairings") return "pairingsMode";
  if (clean === "beat-ai" || clean === "challenges" || clean === "") return "beatAiMode";
  return null;
}

function applyHashMode() {
  const mode = modeForHash(window.location.hash);
  if (mode) switchMode(mode);
}

function bindHashNavigation() {
  document.querySelectorAll('a[href^="/films/#"], a[href^="#"]').forEach(link => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      const hash = href.includes("#") ? href.slice(href.indexOf("#")) : href;
      const mode = modeForHash(hash);
      if (mode) {
        setTimeout(() => switchMode(mode), 0);
      }
    });
  });

  window.addEventListener("hashchange", applyHashMode);
}

function bindPublicEvents() {
  on("randomButton", "click", randomFilm);

  on("todayChallengeButton", "click", () => {
    randomFilm();
    switchMode("beatAiMode");
    if ($("beat-ai")) $("beat-ai").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  on("searchInput", "input", renderReviews);
  on("statusFilter", "change", renderReviews);
  on("scoreFilter", "change", renderReviews);
  on("sortSelect", "change", () => {
    renderReviews();
    renderChallenges();
    renderFilmSelects();
  });

  document.querySelectorAll(".mode-tab").forEach(tab => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  on("loadMoreChallengesButton", "click", () => {
    challengeLimit += 12;
    renderChallenges();
    renderSystemStatus();
  });
}

function bindAdminEvents() {
  if (!ADMIN_ENABLED) return;

  const pairingFilmSelect = $("pairingFilmSelect");
  const comparisonFilmSelect = $("comparisonFilmSelect");
  if (pairingFilmSelect && comparisonFilmSelect) {
    pairingFilmSelect.addEventListener("change", ensureDifferentPairingSelection);
    comparisonFilmSelect.addEventListener("change", ensureDifferentPairingSelection);
  }

  const addFilmForm = $("addFilmForm");
  if (addFilmForm) {
    addFilmForm.addEventListener("submit", event => {
      event.preventDefault();

      const existingSlug = $("editingSlug").value;
      const previousFilm = existingSlug ? getFilm(existingSlug) : null;
      const film = {
        ...(previousFilm || {}),
        slug: existingSlug || slugify(`${$("titleInput").value.trim()}-${$("yearInput").value}`),
        title: $("titleInput").value.trim(),
        year: Number($("yearInput").value),
        director: $("directorInput").value.trim(),
        country: $("countryInput").value.trim(),
        rating: Number($("ratingInput").value),
        tags: formTags(),
        review: $("reviewInput").value.trim(),
        ai_review: $("aiReviewInput").value.trim() || previousFilm?.ai_review || "AI draft pending.",
        status: $("reviewInput").value.trim() ? "reviewed" : "pending",
        updated_at: new Date().toISOString().slice(0, 10)
      };

      films = existingSlug
        ? films.map(item => (item.slug || slugify(`${item.title}-${item.year}`)) === existingSlug ? { ...item, ...film } : item)
        : [film, ...films];

      saveData();
      clearEditor();
      render();
      randomFilm();
    });
  }

  on("cancelEditButton", "click", clearEditor);

  const pairingForm = $("pairingForm");
  if (pairingForm) {
    pairingForm.addEventListener("submit", event => {
      event.preventDefault();

      const filmId = $("pairingFilmSelect").value;
      const comparisonFilmId = $("comparisonFilmSelect").value;
      if (!filmId || !comparisonFilmId || filmId === comparisonFilmId) return;

      const text = $("pairingTextInput").value.trim();
      const angle = $("pairingAngleInput").value.trim() || "comparison";
      if (!text) return;

      pairings.unshift({
        id: slugify(`${filmId}-through-${comparisonFilmId}-${Date.now()}`),
        film_id: filmId,
        comparison_film_id: comparisonFilmId,
        angle,
        text,
        votes: 0,
        created_at: new Date().toISOString().slice(0, 10)
      });

      saveData();
      pairingForm.reset();
      renderFilmSelects();
      renderPairings();
      renderAdminDashboard();
      switchMode("pairingsMode");
    });
  }

  on("downloadJsonButton", "click", () => downloadJson("films.json", films));
  on("downloadReviewsButton", "click", () => downloadJson("reviews.json", buildReviews()));
  on("downloadChallengesButton", "click", () => downloadJson("ai-challenges.json", buildChallenges()));
  on("downloadPairingsButton", "click", () => downloadJson("pairings.json", pairings));
  on("downloadBundleButton", "click", () => downloadJson("film-review-data-bundle.json", buildBundle()));

  on("importBundleButton", "click", () => {
    const importStatus = $("importStatus");
    try {
      const bundle = JSON.parse($("importBundleInput").value);
      if (!Array.isArray(bundle.films)) throw new Error("The bundle must include a films array.");

      films = bundle.films;
      pairings = Array.isArray(bundle.pairings) ? bundle.pairings : [];
      votes = bundle.votes || {};
      submissions = bundle.submissions || {};
      saveData();

      if (importStatus) {
        importStatus.textContent = `Imported ${films.length} films, ${pairings.length} pairings and ${Object.keys(submissions).length} submission groups.`;
      }

      render();
      randomFilm();
    } catch (error) {
      if (importStatus) importStatus.textContent = `Import failed: ${error.message}`;
    }
  });

  on("clearLocalButton", "click", () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(pairingsStorageKey);
    localStorage.removeItem(votesStorageKey);
    localStorage.removeItem(submissionsStorageKey);
    window.location.reload();
  });
}

function bindEvents() {
  bindHashNavigation();
  bindPublicEvents();
  bindAdminEvents();
}

loadData().then(() => {
  bindEvents();
  render();
  applyHashMode();
  randomFilm();
});