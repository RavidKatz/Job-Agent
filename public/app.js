const form = document.querySelector("#matchForm");
const resumeFile = document.querySelector("#resumeFile");
const jobsFile = document.querySelector("#jobsFile");
const resumeFileName = document.querySelector("#resumeFileName");
const jobsFileName = document.querySelector("#jobsFileName");
const minimumScore = document.querySelector("#minimumScore");
const minimumScoreValue = document.querySelector("#minimumScoreValue");
const scanButton = document.querySelector("#scanButton");
const exportButton = document.querySelector("#exportButton");
const statusText = document.querySelector("#statusText");
const jobsScanned = document.querySelector("#jobsScanned");
const matchCount = document.querySelector("#matchCount");
const termCount = document.querySelector("#termCount");
const generatedAt = document.querySelector("#generatedAt");
const resultsBody = document.querySelector("#resultsBody");
const sourceLinks = document.querySelector("#sourceLinks");
const profileSummary = document.querySelector("#profileSummary");
const roleRecommendations = document.querySelector("#roleRecommendations");
const applicationTrackerBody = document.querySelector("#applicationTrackerBody");
const addManualApplication = document.querySelector("#addManualApplication");
const exportTrackerButton = document.querySelector("#exportTrackerButton");

const TRACKER_STORAGE_KEY = "job-agent-application-tracker-v1";
const TRACKER_STATUSES = [
  "Saved",
  "Applied",
  "Recruiter screen",
  "Interview scheduled",
  "Interview completed",
  "Home assignment",
  "Follow-up needed",
  "Offer",
  "Rejected",
  "No response",
  "Withdrawn",
  "Closed"
];

let latestCsv = "";
let latestMatches = [];
let trackedApplications = loadTracker();

function isRealApplyUrl(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("http://") || text.startsWith("https://");
}

function renderApplyAction(match, index) {
  const directAction = isRealApplyUrl(match.applyUrl)
    ? `<a class="apply-link" href="${escapeAttribute(match.applyUrl)}" target="_blank" rel="noreferrer">Open role</a>`
    : `<span class="muted-action">No direct link</span>`;
  const isTracked = isTrackedMatch(match);

  return `
    <div class="application-actions">
      ${directAction}
      <button class="track-job-button" type="button" data-track-index="${index}" ${isTracked ? "disabled" : ""}>
        ${isTracked ? "Tracked" : "Track"}
      </button>
    </div>
  `;
}

function setStatus(text, isError = false) {
  statusText.textContent = text;
  statusText.classList.toggle("error", isError);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderMatches(analysis) {
  latestMatches = analysis.matches ?? [];
  jobsScanned.textContent = analysis.jobsScanned ?? 0;
  matchCount.textContent = latestMatches.length;
  termCount.textContent = analysis.resumeTerms?.length ?? 0;
  generatedAt.textContent = analysis.generatedAt ? formatDate(analysis.generatedAt) : "";
  renderProfile(analysis.resumeProfile);
  renderSourceLinks(analysis.sourceLinks ?? []);

  if (!latestMatches.length) {
    resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state">No roles passed the current match threshold</td></tr>`;
    return;
  }

  resultsBody.innerHTML = latestMatches.map((match, index) => `
    <tr>
      <td><span class="score-pill">${match.matchPercent}%</span></td>
      <td>${escapeHtml(match.company)}</td>
      <td>${escapeHtml(match.position)}</td>
      <td>${escapeHtml(match.location)}</td>
      <td class="notes">${escapeHtml(match.notes || match.warnings || "")}</td>
      <td>${renderApplyAction(match, index)}</td>
    </tr>
  `).join("");
}

function renderProfile(profile) {
  if (!profile) {
    profileSummary.textContent = "The resume profile will appear after the scan.";
    roleRecommendations.innerHTML = "";
    return;
  }

  const yearsText = profile.yearsExperience == null
    ? "No explicit years of experience detected"
    : `${profile.yearsExperience} years of experience`;
  const terms = (profile.matchedTerms ?? []).slice(0, 8).join(", ");
  profileSummary.textContent = `${yearsText}. Seniority: ${profile.seniority}. Detected signals: ${terms || "No strong signals detected yet"}.`;

  const roles = profile.roleRecommendations ?? [];
  if (!roles.length) {
    roleRecommendations.innerHTML = `<span class="empty-state inline">No strong role recommendations detected</span>`;
    return;
  }

  roleRecommendations.innerHTML = roles.map((role) => `
    <article class="role-card">
      <div class="role-card-head">
        <strong>${escapeHtml(role.title)}</strong>
        <span>${role.score}%</span>
      </div>
      <p>${escapeHtml((role.reasons ?? []).join(" | "))}</p>
      <small>${escapeHtml((role.searchTerms ?? []).slice(0, 3).join(", "))}</small>
    </article>
  `).join("");
}

function renderSourceLinks(links) {
  if (!links.length) {
    sourceLinks.innerHTML = `<span class="empty-state inline">No search shortcuts yet</span>`;
    return;
  }

  sourceLinks.innerHTML = links.map((link) => `
    <a class="source-link" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">
      ${escapeHtml(link.label)}
    </a>
  `).join("");
}

function renderTracker() {
  exportTrackerButton.disabled = !trackedApplications.length;

  if (!trackedApplications.length) {
    applicationTrackerBody.innerHTML = `<tr><td colspan="8" class="empty-state">No tracked applications yet</td></tr>`;
    refreshTrackButtons();
    return;
  }

  applicationTrackerBody.innerHTML = trackedApplications.map((item) => `
    <tr>
      <td>
        <select class="status-select" data-tracker-id="${escapeAttribute(item.id)}" data-tracker-field="status">
          ${renderStatusOptions(item.status)}
        </select>
      </td>
      <td>
        <input class="tracker-input" data-tracker-id="${escapeAttribute(item.id)}" data-tracker-field="company" value="${escapeAttribute(item.company)}" placeholder="Company">
      </td>
      <td>
        <input class="tracker-input" data-tracker-id="${escapeAttribute(item.id)}" data-tracker-field="role" value="${escapeAttribute(item.role)}" placeholder="Role">
        <small>${escapeHtml(item.source || "Manual")}</small>
      </td>
      <td><span class="score-pill tracker-score">${item.matchPercent ? `${escapeHtml(item.matchPercent)}%` : "Manual"}</span></td>
      <td>
        <input class="tracker-date" type="date" data-tracker-id="${escapeAttribute(item.id)}" data-tracker-field="updatedAt" value="${escapeAttribute(item.updatedAt)}">
      </td>
      <td>
        <input class="tracker-input wide" data-tracker-id="${escapeAttribute(item.id)}" data-tracker-field="nextStep" value="${escapeAttribute(item.nextStep)}" placeholder="Next step or note">
      </td>
      <td>
        <div class="tracker-link-cell">
          <input class="tracker-input wide" data-tracker-id="${escapeAttribute(item.id)}" data-tracker-field="applyUrl" value="${escapeAttribute(item.applyUrl)}" placeholder="Application URL">
          ${isRealApplyUrl(item.applyUrl) ? `<a class="apply-link compact" href="${escapeAttribute(item.applyUrl)}" target="_blank" rel="noreferrer">Open</a>` : ""}
        </div>
      </td>
      <td>
        <button class="remove-tracker-button" type="button" data-tracker-id="${escapeAttribute(item.id)}">Remove</button>
      </td>
    </tr>
  `).join("");

  refreshTrackButtons();
}

function renderStatusOptions(selectedStatus) {
  const currentStatus = TRACKER_STATUSES.includes(selectedStatus) ? selectedStatus : "Saved";
  return TRACKER_STATUSES.map((status) => `
    <option value="${escapeAttribute(status)}" ${status === currentStatus ? "selected" : ""}>${escapeHtml(status)}</option>
  `).join("");
}

function loadTracker() {
  try {
    const stored = JSON.parse(localStorage.getItem(TRACKER_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.map(normalizeTrackerItem);
  } catch {
    return [];
  }
}

function persistTracker({ rerender = true } = {}) {
  localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(trackedApplications));
  exportTrackerButton.disabled = !trackedApplications.length;
  if (rerender) renderTracker();
}

function normalizeTrackerItem(item) {
  return {
    id: String(item.id || createId()),
    company: String(item.company || ""),
    role: String(item.role || item.position || ""),
    source: String(item.source || "Manual"),
    matchPercent: item.matchPercent ? String(item.matchPercent) : "",
    applyUrl: String(item.applyUrl || ""),
    status: TRACKER_STATUSES.includes(item.status) ? item.status : "Saved",
    updatedAt: String(item.updatedAt || today()),
    nextStep: String(item.nextStep || ""),
    addedAt: String(item.addedAt || new Date().toISOString())
  };
}

function addMatchToTracker(match) {
  if (isTrackedMatch(match)) {
    refreshTrackButtons();
    return;
  }

  trackedApplications = [
    normalizeTrackerItem({
      company: match.company,
      role: match.position,
      source: match.source,
      matchPercent: match.matchPercent,
      applyUrl: match.applyUrl,
      status: "Saved",
      nextStep: "Review and apply",
      updatedAt: today()
    }),
    ...trackedApplications
  ];

  persistTracker();
  setStatus("Added to application tracker");
}

function addManualTrackerRow() {
  trackedApplications = [
    normalizeTrackerItem({
      status: "Saved",
      source: "Manual",
      updatedAt: today(),
      nextStep: "Add details"
    }),
    ...trackedApplications
  ];

  persistTracker();
}

function removeTrackerItem(id) {
  trackedApplications = trackedApplications.filter((item) => item.id !== id);
  persistTracker();
}

function updateTrackerItem(id, field, value) {
  const item = trackedApplications.find((entry) => entry.id === id);
  if (!item) return;
  item[field] = value;
  if (field === "status") {
    item.updatedAt = today();
    persistTracker();
    return;
  }
  persistTracker({ rerender: false });
}

function isTrackedMatch(match) {
  const key = trackerKey({
    company: match.company,
    role: match.position,
    applyUrl: match.applyUrl
  });
  return trackedApplications.some((item) => trackerKey(item) === key);
}

function trackerKey(item) {
  const url = normalizeString(item.applyUrl);
  if (url) return `url:${url}`;
  return `role:${normalizeString(item.company)}|${normalizeString(item.role)}`;
}

function refreshTrackButtons() {
  document.querySelectorAll(".track-job-button").forEach((button) => {
    const match = latestMatches[Number(button.dataset.trackIndex)];
    if (!match) return;
    const isTracked = isTrackedMatch(match);
    button.disabled = isTracked;
    button.textContent = isTracked ? "Tracked" : "Track";
  });
}

function exportTrackerCsv() {
  if (!trackedApplications.length) return;
  const csv = toCsv([
    ["Status", "Company", "Role", "Source", "Fit", "Last update", "Next step", "Apply URL", "Added at"],
    ...trackedApplications.map((item) => [
      item.status,
      item.company,
      item.role,
      item.source,
      item.matchPercent ? `${item.matchPercent}%` : "",
      item.updatedAt,
      item.nextStep,
      item.applyUrl,
      item.addedAt
    ])
  ]);
  downloadTextFile(`\uFEFF${csv}`, "application-tracker.csv", "text/csv;charset=utf-8");
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeString(value) {
  return String(value ?? "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function updateFileLabels() {
  resumeFileName.textContent = resumeFile.files[0]?.name || "PDF, DOCX, TXT, or MD";
  jobsFileName.textContent = jobsFile.files[0]?.name || "Optional JSON file";
}

minimumScore.addEventListener("input", () => {
  minimumScoreValue.textContent = `${minimumScore.value}%`;
});

resumeFile.addEventListener("change", updateFileLabels);
jobsFile.addEventListener("change", updateFileLabels);

resultsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".track-job-button");
  if (!button) return;
  const match = latestMatches[Number(button.dataset.trackIndex)];
  if (match) addMatchToTracker(match);
});

applicationTrackerBody.addEventListener("input", (event) => {
  const field = event.target.dataset.trackerField;
  const id = event.target.dataset.trackerId;
  if (!field || !id) return;
  updateTrackerItem(id, field, event.target.value);
});

applicationTrackerBody.addEventListener("change", (event) => {
  const field = event.target.dataset.trackerField;
  const id = event.target.dataset.trackerId;
  if (!field || !id) return;
  updateTrackerItem(id, field, event.target.value);
  if (field === "applyUrl") renderTracker();
});

applicationTrackerBody.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-tracker-button");
  if (!button) return;
  removeTrackerItem(button.dataset.trackerId);
});

addManualApplication.addEventListener("click", addManualTrackerRow);
exportTrackerButton.addEventListener("click", exportTrackerCsv);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Scanning role fit...");
  scanButton.disabled = true;
  exportButton.disabled = true;

  try {
    const formData = new FormData();
    formData.append("resume", resumeFile.files[0]);
    formData.append("minimumScore", minimumScore.value);
    if (jobsFile.files[0]) {
      formData.append("jobsFile", jobsFile.files[0]);
    }

    const response = await fetch("/api/match", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "The scan failed");
    }

    latestCsv = payload.csv || "";
    renderMatches(payload);
    exportButton.disabled = !latestCsv;
    setStatus(payload.sourceNotices?.[0] || "Scan complete");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    scanButton.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  if (!latestCsv) return;
  downloadTextFile(latestCsv, "job-matches.csv", "text/csv;charset=utf-8");
});

renderTracker();
