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

let latestCsv = "";

function setStatus(text, isError = false) {
  statusText.textContent = text;
  statusText.classList.toggle("error", isError);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderMatches(analysis) {
  jobsScanned.textContent = analysis.jobsScanned ?? 0;
  matchCount.textContent = analysis.matches?.length ?? 0;
  termCount.textContent = analysis.resumeTerms?.length ?? 0;
  generatedAt.textContent = analysis.generatedAt ? formatDate(analysis.generatedAt) : "";

  if (!analysis.matches?.length) {
    resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state">לא נמצאו משרות מעל הסף הנוכחי</td></tr>`;
    return;
  }

  resultsBody.innerHTML = analysis.matches.map((match) => `
    <tr>
      <td><span class="score-pill">${match.matchPercent}%</span></td>
      <td>${escapeHtml(match.company)}</td>
      <td>${escapeHtml(match.position)}</td>
      <td>${escapeHtml(match.location)}</td>
      <td class="notes">${escapeHtml(match.notes || match.warnings || "")}</td>
      <td>${match.applyUrl ? `<a class="apply-link" href="${escapeAttribute(match.applyUrl)}" target="_blank" rel="noreferrer">פתח</a>` : ""}</td>
    </tr>
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
  resumeFileName.textContent = resumeFile.files[0]?.name || "PDF, DOCX או TXT";
  jobsFileName.textContent = jobsFile.files[0]?.name || "אופציונלי: JSON";
}

minimumScore.addEventListener("input", () => {
  minimumScoreValue.textContent = `${minimumScore.value}%`;
});

resumeFile.addEventListener("change", updateFileLabels);
jobsFile.addEventListener("change", updateFileLabels);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("סורק התאמות...");
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
      throw new Error(payload.error || "הסריקה נכשלה");
    }

    latestCsv = payload.csv || "";
    renderMatches(payload);
    exportButton.disabled = !latestCsv;
    setStatus(payload.sourceNotices?.[0] || "הסריקה הושלמה");
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
