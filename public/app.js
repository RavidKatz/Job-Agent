import { setupAuth } from "./auth.js";

const form = document.querySelector("#matchForm");
const resumeFile = document.querySelector("#resumeFile");
const jobsFile = document.querySelector("#jobsFile");
const resumeFileName = document.querySelector("#resumeFileName");
const jobsFileName = document.querySelector("#jobsFileName");
const minimumScore = document.querySelector("#minimumScore");
const minimumScoreValue = document.querySelector("#minimumScoreValue");
const thresholdSearchButton = document.querySelector("#thresholdSearchButton");
const scanButton = document.querySelector("#scanButton");
const exportButton = document.querySelector("#exportButton");
const sourceCheckboxes = document.querySelectorAll('input[name="sourceIds"]');
const statusText = document.querySelector("#statusText");
const jobsScanned = document.querySelector("#jobsScanned");
const matchCount = document.querySelector("#matchCount");
const termCount = document.querySelector("#termCount");
const highestScore = document.querySelector("#highestScore");
const generatedAt = document.querySelector("#generatedAt");
const scanVisual = document.querySelector("#scanVisual");
const resultsBody = document.querySelector("#resultsBody");
const sourceLinks = document.querySelector("#sourceLinks");
const profileSummary = document.querySelector("#profileSummary");
const profileFacts = document.querySelector("#profileFacts");
const roleRecommendations = document.querySelector("#roleRecommendations");

const TRACKER_STORAGE_KEY = "job-agent-application-tracker-v1";

let latestCsv = "";
let latestMatches = [];
let latestNearMatches = [];
let trackedApplications = loadTracker();
let auth = null;

function isRealApplyUrl(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("http://") || text.startsWith("https://");
}

function renderApplyAction(match, index, isNear = false) {
  const directAction = isRealApplyUrl(match.applyUrl)
    ? `<a class="apply-link" href="${escapeAttribute(match.applyUrl)}" target="_blank" rel="noreferrer">View job</a>`
    : `<span class="muted-action">No direct link</span>`;
  const isTracked = isTrackedMatch(match);
  const indexAttr = isNear ? `data-near-index="${index}"` : `data-track-index="${index}"`;

  return `
    <div class="application-actions">
      ${directAction}
      <button class="track-job-button" type="button" ${indexAttr} ${isTracked ? "disabled" : ""}>
        ${isTracked ? "Tracked" : "Track"}
      </button>
    </div>
  `;
}

function setStatus(text, isError = false) {
  statusText.textContent = text;
  statusText.classList.toggle("error", isError);
}

function setScanning(isScanning) {
  scanVisual?.classList.toggle("is-active", isScanning);
  document.querySelector(".summary-panel")?.classList.toggle("is-scanning", isScanning);
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid response. Refresh the page and try again.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The scan response could not be read. Refresh the page and try again.");
  }
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function resetScanResults() {
  latestCsv = "";
  latestMatches = [];
  latestNearMatches = [];
  jobsScanned.textContent = "0";
  matchCount.textContent = "0";
  termCount.textContent = "0";
  if (highestScore) highestScore.textContent = "—";
  generatedAt.textContent = "";
  profileSummary.textContent = "Building profile from the uploaded CV...";
  profileFacts.innerHTML = "";
  roleRecommendations.innerHTML = "";
  sourceLinks.innerHTML = "";
  resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state">Scanning this CV now. Previous results were cleared.</td></tr>`;
}

function renderMatches(analysis) {
  latestMatches = analysis.matches ?? [];
  latestNearMatches = analysis.nearMatches ?? [];
  jobsScanned.textContent = analysis.jobsScanned ?? 0;
  matchCount.textContent = latestMatches.length;
  termCount.textContent = analysis.resumeTerms?.length ?? 0;
  if (highestScore) {
    const highest = analysis.diagnostics?.highestScore ?? 0;
    highestScore.textContent = highest ? `${highest}%` : "—";
  }
  generatedAt.textContent = analysis.generatedAt ? formatDate(analysis.generatedAt) : "";
  renderProfile(analysis.resumeProfile);
  renderSourceLinks(analysis.sourceLinks ?? []);

  if (!latestMatches.length) {
    resultsBody.innerHTML = renderNoMatchesState(analysis);
    refreshTrackButtons();
    return;
  }

  resultsBody.innerHTML = latestMatches.map((match, index) => `
    <tr class="job-result-row">
      <td class="result-fit-cell" data-label="Fit">
        <span class="score-pill">${match.matchPercent}%</span>
      </td>
      <td class="result-company-cell" data-label="Company">${escapeHtml(match.company || "Company not listed")}</td>
      <td class="result-role-cell" data-label="Role">
        ${renderRoleTitle(match)}
        <span class="mobile-result-meta">${escapeHtml(match.source || match.appliedVia || "Unknown source")}</span>
      </td>
      <td class="result-location-cell" data-label="Location">${escapeHtml(match.location || "Location not listed")}</td>
      <td class="notes result-rationale-cell" data-label="Fit rationale">
        ${renderResultSummary(match)}
        <details class="fit-details"><summary>More details</summary>${renderMatchRationale(match)}</details>
      </td>
      <td class="result-actions-cell" data-label="Actions">${renderApplyAction(match, index)}</td>
    </tr>
  `).join("");
}

// Renders the no-matches view: a diagnostics summary, and the closest near
// matches below the threshold when any exist. Never an empty dead end.
function renderNoMatchesState(analysis) {
  const near = analysis.nearMatches ?? [];
  const diagnosticsRow = renderDiagnosticsRow(analysis.diagnostics || {}, near.length > 0);
  if (!near.length) return diagnosticsRow;
  return diagnosticsRow + near.map((match, index) => nearMatchRow(match, index)).join("");
}

function renderDiagnosticsRow(diagnostics, hasNear) {
  const threshold = diagnostics.threshold ?? "";
  const highest = diagnostics.highestScore ?? 0;
  const headline = hasNear
    ? "אף משרה לא עברה את הסף שנבחר, אך אלה ההתאמות הקרובות ביותר."
    : "אף משרה לא עברה את הסף שנבחר.";
  const suggestion = (highest > 0 && threshold !== "" && highest < threshold)
    ? `כדאי לנסות להוריד את הסף לכ-${escapeHtml(String(highest))}% כדי לראות התאמות קרובות.`
    : "";
  const failureReasons = (diagnostics.topFailureReasons ?? [])
    .map((item) => `${escapeHtml(item.reason)} (${escapeHtml(String(item.count))})`)
    .join(" | ");
  const sourceWarnings = (diagnostics.sourceWarnings ?? []).map(escapeHtml).join(" | ");
  const searchTerms = (diagnostics.searchTerms ?? []).slice(0, 8).map(escapeHtml).join(", ");

  const lines = [
    `<p class="diag-headline">${headline}</p>`,
    `<p><b>סף שנבחר</b>${escapeHtml(String(threshold))}%</p>`,
    `<p><b>הציון הגבוה ביותר</b>${escapeHtml(String(highest))}%</p>`,
    `<p><b>נסרקו / קיבלו ציון</b>${escapeHtml(String(diagnostics.jobsScanned ?? 0))} / ${escapeHtml(String(diagnostics.jobsScored ?? 0))}</p>`,
    `<p><b>ציון ממוצע</b>${escapeHtml(String(diagnostics.averageScore ?? 0))}%</p>`,
    suggestion ? `<p class="diag-suggestion">${suggestion}</p>` : "",
    searchTerms ? `<p><b>מונחי חיפוש שנוצרו</b>${searchTerms}</p>` : "",
    failureReasons ? `<p><b>סיבות עיקריות לאי-התאמה</b>${failureReasons}</p>` : "",
    sourceWarnings ? `<p><b>אזהרות מקור</b>${sourceWarnings}</p>` : ""
  ].filter(Boolean).join("");

  return `<tr class="diagnostics-row"><td colspan="6" dir="rtl"><div class="diagnostics-box">${lines}</div></td></tr>`;
}

function nearMatchRow(match, index) {
  return `
    <tr class="job-result-row near-match-row">
      <td class="result-fit-cell" data-label="Fit">
        <span class="score-pill score-pill-near">${match.matchPercent}%</span>
        <span class="near-badge">מתחת לסף</span>
      </td>
      <td class="result-company-cell" data-label="Company">${escapeHtml(match.company || "Company not listed")}</td>
      <td class="result-role-cell" data-label="Role">
        ${renderRoleTitle(match)}
        <span class="mobile-result-meta">${escapeHtml(match.source || match.appliedVia || "Unknown source")}</span>
      </td>
      <td class="result-location-cell" data-label="Location">${escapeHtml(match.location || "Location not listed")}</td>
      <td class="notes result-rationale-cell" data-label="Fit rationale">
        <p class="near-reason" dir="rtl"><b>למה לא עבר את הסף</b>${escapeHtml(match.reason || "")}</p>
        ${renderResultSummary(match)}
        <details class="fit-details"><summary>More details</summary>${renderMatchRationale(match)}</details>
      </td>
      <td class="result-actions-cell" data-label="Actions">${renderApplyAction(match, index, true)}</td>
    </tr>
  `;
}

function renderRoleTitle(match) {
  const title = escapeHtml(match.position || "Untitled role");
  if (!isRealApplyUrl(match.applyUrl)) {
    return `
      <strong class="mobile-result-title">${title}</strong>
      <span class="desktop-result-title">${title}</span>
    `;
  }

  const url = escapeAttribute(match.applyUrl);
  return `
    <a class="mobile-result-title result-title-link" href="${url}" target="_blank" rel="noreferrer">${title}</a>
    <a class="desktop-result-title result-title-link" href="${url}" target="_blank" rel="noreferrer">${title}</a>
  `;
}

const FIT_LABEL_HE = { High: "התאמה גבוהה", Medium: "התאמה בינונית", Low: "התאמה נמוכה" };
const RELIABILITY_HE = { high: "מקור אמין", medium: "מקור בינוני", low: "מקור חלש" };

function renderQualityNote(match) {
  const quality = match.dataQuality;
  if (!quality) return "";
  const reliability = RELIABILITY_HE[quality.sourceReliability] || quality.sourceReliability || "";
  const warnings = Array.isArray(quality.qualityWarnings) ? quality.qualityWarnings : [];
  const showWarnings = warnings.length && (quality.dataQualityScore < 60 || quality.isSearchShortcut);
  const warningLine = showWarnings
    ? `<p class="quality-warning"><b>איכות נתונים</b>${escapeHtml(warnings.join(" | "))}</p>`
    : "";
  return `
    <p><b>מקור</b>${escapeHtml(reliability)} (${escapeHtml(String(quality.dataQualityScore))}/100)</p>
    ${warningLine}
  `;
}

function renderResultSummary(match) {
  const fit = match.fitAnalysis || {};
  return `
    <div class="result-summary" dir="rtl">
      <p><b>Confidence</b>${escapeHtml(String(fit.confidenceScore ?? match.confidenceScore ?? "N/A"))}/100</p>
      <p><b>רמת התאמה</b>${escapeHtml(FIT_LABEL_HE[fit.fitLabel] || fit.fitLabel || "")}</p>
      <p><b>למה מתאים</b>${escapeHtml(match.mainFit || fit.whyFits || "לא זוהו סימני התאמה")}</p>
      <p><b>מה חסר</b>${escapeHtml(match.mainGap || fit.whatsMissing || "לא זוהה פער")}</p>
      <p><b>המלצה</b>${escapeHtml(fit.finalRecommendationHe || match.recommendedAction || "לבדוק את המשרה")}</p>
    </div>
  `;
}

function renderMatchRationale(match) {
  const fit = match.fitAnalysis;
  if (fit) {
    return `
      <div class="fit-analysis" dir="rtl">
        <div class="fit-meta">
          <span>${escapeHtml(String(fit.confidenceScore ?? match.confidenceScore ?? "N/A"))}/100 confidence</span>
          <span>${escapeHtml(FIT_LABEL_HE[fit.fitLabel] || fit.fitLabel || "")}</span>
          <span>${escapeHtml(match.category || "ללא קטגוריה")}</span>
          <span>${escapeHtml(fit.requirementCoverage || "כיסוי לא זוהה")}</span>
        </div>
        <p><b>סיכום</b>${escapeHtml(fit.hebrewSummary || "")}</p>
        <p><b>למה זה מתאים</b>${escapeHtml(fit.whyFits || "")}</p>
        <p><b>מה חסר</b>${escapeHtml(fit.whatsMissing || "")}</p>
        <p><b>איך התפקיד האחרון תומך</b>${escapeHtml(fit.recentRoleSupport || "")}</p>
        <p><b>איך ההשכלה תומכת</b>${escapeHtml(fit.educationSupport || "")}</p>
        <p><b>סיכונים ופערים</b>${escapeHtml(fit.risks || "")}</p>
        <p><b>התאמת קורות החיים</b>${escapeHtml(fit.cvTailoring || "")}</p>
        <p><b>המלצה סופית</b>${escapeHtml(fit.finalRecommendationHe || "")}</p>
        ${renderQualityNote(match)}
      </div>
    `;
  }

  const parts = [];
  if (match.notes) {
    parts.push(`<span>${escapeHtml(match.notes)}</span>`);
  }
  if (match.warnings) {
    parts.push(`<strong>${escapeHtml(match.warnings)}</strong>`);
  }
  return parts.join("");
}

function renderProfile(profile) {
  if (!profile) {
    profileSummary.textContent = "Your profile appears after a scan.";
    roleRecommendations.innerHTML = "";
    return;
  }

  const yearsText = profile.yearsExperience == null
    ? "No explicit years of experience detected"
    : `${profile.yearsExperience} years of experience`;
  const terms = (profile.matchedTerms ?? []).slice(0, 8).join(", ");
  profileSummary.textContent = `${yearsText}. Seniority: ${profile.seniority}. Detected signals: ${terms || "No strong signals detected yet"}.`;
  profileFacts.innerHTML = renderProfileFacts(profile);

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

function renderProfileFacts(profile) {
  const topRole = profile.roleRecommendations?.[0];
  const searchTerms = (profile.searchTerms ?? []).slice(0, 4);
  const matchedTerms = (profile.matchedTerms ?? []).slice(0, 6);

  // Show CV-matched config terms when present. When absent but a target role was
  // typed, surface it clearly labeled as user input — not as CV evidence.
  const evidenceText = matchedTerms.length
    ? matchedTerms.join(", ")
    : profile.targetRoleInput
      ? `Target role: ${profile.targetRoleInput}`
      : "No evidence yet";

  return [
    ["Best direction", topRole ? `${topRole.title} (${topRole.score}%)` : "Not detected yet"],
    ["Search terms", searchTerms.length ? searchTerms.join(", ") : "No terms yet"],
    ["Profile evidence", evidenceText]
  ].map(([label, value]) => `
    <article class="profile-fact-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
}

function renderSourceLinks(links) {
  if (!links.length) {
    sourceLinks.innerHTML = `<span class="empty-state inline">Search shortcuts appear after a scan.</span>`;
    return;
  }

  sourceLinks.innerHTML = links.map((link) => `
    <a class="source-link" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">
      ${escapeHtml(link.label)}
    </a>
  `).join("");
}

async function loadServerApplications() {
  if (!auth?.currentUser) return;
  try {
    const response = await fetch("/api/applications");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load applications.");
    trackedApplications = (payload.applications ?? []).map(normalizeTrackerItem);
    persistTracker();
    refreshTrackButtons();
  } catch (error) {
    setStatus(error.message, true);
  }
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

function persistTracker() {
  localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(trackedApplications));
}

async function saveTrackerItem(item) {
  if (!auth?.currentUser) return;
  const response = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...item,
      fitPercent: item.matchPercent
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not save application.");
}

function normalizeTrackerItem(item) {
  return {
    id: String(item.id || createId()),
    company: String(item.company || ""),
    role: String(item.role || item.position || ""),
    source: String(item.source || "Manual"),
    matchPercent: item.matchPercent || item.fitPercent ? String(item.matchPercent || item.fitPercent) : "",
    category: String(item.category || ""),
    priority: String(item.priority || ""),
    location: String(item.location || ""),
    workModel: String(item.workModel || ""),
    mainFit: String(item.mainFit || ""),
    mainGap: String(item.mainGap || ""),
    recommendedAction: String(item.recommendedAction || ""),
    applyUrl: String(item.applyUrl || ""),
    status: String(item.status || "Saved"),
    updatedAt: String(item.updatedAt || today()),
    nextStep: String(item.nextStep || ""),
    addedAt: String(item.addedAt || new Date().toISOString())
  };
}

async function addMatchToTracker(match) {
  if (!auth?.currentUser) {
    setStatus("Create an account to save this role into your application dashboard.", true);
    document.querySelector("#authPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

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
      category: match.category,
      priority: match.priority,
      location: match.location,
      workModel: match.workModel,
      mainFit: match.mainFit,
      mainGap: match.mainGap,
      recommendedAction: match.recommendedAction,
      applyUrl: match.applyUrl,
      status: "Saved",
      nextStep: match.recommendedAction || "Review and apply",
      updatedAt: today()
    }),
    ...trackedApplications
  ];

  persistTracker();
  refreshTrackButtons();
  await saveTrackerItem(trackedApplications[0]);
  setStatus("Saved to the dedicated application dashboard");
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
    const match = button.dataset.nearIndex != null
      ? latestNearMatches[Number(button.dataset.nearIndex)]
      : latestMatches[Number(button.dataset.trackIndex)];
    if (!match) return;
    const isTracked = isTrackedMatch(match);
    button.disabled = isTracked;
    button.textContent = isTracked ? "Tracked" : "Track";
  });
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

function getSelectedSourceIds() {
  return [...sourceCheckboxes]
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

minimumScore.addEventListener("input", () => {
  minimumScoreValue.textContent = `${minimumScore.value}%`;
});

thresholdSearchButton?.addEventListener("click", () => {
  if (!resumeFile.files[0]) {
    setStatus("Upload a CV before searching.", true);
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  form.requestSubmit();
});

resumeFile.addEventListener("change", updateFileLabels);
jobsFile.addEventListener("change", updateFileLabels);

resultsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".track-job-button");
  if (!button) return;
  const match = button.dataset.nearIndex != null
    ? latestNearMatches[Number(button.dataset.nearIndex)]
    : latestMatches[Number(button.dataset.trackIndex)];
  if (match) addMatchToTracker(match);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedSourceIds = getSelectedSourceIds();
  if (!selectedSourceIds.length && !jobsFile.files[0]) {
    setStatus("Select at least one job source before running the scan.", true);
    return;
  }

  setStatus("Scanning role fit...");
  resetScanResults();
  setScanning(true);
  scanButton.disabled = true;
  exportButton.disabled = true;

  try {
    const formData = new FormData();
    formData.append("resume", resumeFile.files[0]);
    formData.append("minimumScore", minimumScore.value);
    formData.append("sourceIds", JSON.stringify(selectedSourceIds));
    const targetRoleValue = document.querySelector("#targetRoleInput")?.value?.trim();
    if (targetRoleValue) {
      formData.append("targetRoleInput", targetRoleValue);
    }
    if (jobsFile.files[0]) {
      formData.append("jobsFile", jobsFile.files[0]);
    }

    const response = await fetch("/api/match", {
      method: "POST",
      body: formData
    });
    const payload = await readJsonResponse(response);

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
    setScanning(false);
    scanButton.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  if (!latestCsv) return;
  downloadTextFile(latestCsv, "job-matches.csv", "text/csv;charset=utf-8");
});

auth = await setupAuth({
  onUserChange(user) {
    if (user) {
      scanButton.disabled = false;
      setStatus("Account connected. You can scan and save roles to the dashboard.");
      loadServerApplications();
      return;
    }
    scanButton.disabled = false;
    setStatus("Upload a CV to scan. Create an account to save your dashboard.");
  }
});
