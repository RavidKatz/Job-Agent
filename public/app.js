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

let latestCsv = "";

function isRealApplyUrl(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("http://") || text.startsWith("https://");
}

function renderApplyAction(match) {
  if (!isRealApplyUrl(match.applyUrl)) {
    return `<span class="muted-action">No direct link</span>`;
  }

  return `<a class="apply-link" href="${escapeAttribute(match.applyUrl)}" target="_blank" rel="noreferrer">Open role</a>`;
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
  jobsScanned.textContent = analysis.jobsScanned ?? 0;
  matchCount.textContent = analysis.matches?.length ?? 0;
  termCount.textContent = analysis.resumeTerms?.length ?? 0;
  generatedAt.textContent = analysis.generatedAt ? formatDate(analysis.generatedAt) : "";
  renderProfile(analysis.resumeProfile);
  renderSourceLinks(analysis.sourceLinks ?? []);

  if (!analysis.matches?.length) {
    resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state">No roles passed the current match threshold</td></tr>`;
    return;
  }

  resultsBody.innerHTML = analysis.matches.map((match) => `
    <tr>
      <td><span class="score-pill">${match.matchPercent}%</span></td>
      <td>${escapeHtml(match.company)}</td>
      <td>${escapeHtml(match.position)}</td>
      <td>${escapeHtml(match.location)}</td>
      <td class="notes">${escapeHtml(match.notes || match.warnings || "")}</td>
      <td>${renderApplyAction(match)}</td>
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
  const blob = new Blob([latestCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "job-matches.csv";
  link.click();
  URL.revokeObjectURL(url);
});
