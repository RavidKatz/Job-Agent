import { setupAuth } from "./auth.js";

const applicationTrackerBody = document.querySelector("#applicationTrackerBody");
const addManualApplication = document.querySelector("#addManualApplication");
const exportTrackerButton = document.querySelector("#exportTrackerButton");
const trackerTotal = document.querySelector("#trackerTotal");
const trackerActive = document.querySelector("#trackerActive");
const trackerFollowUp = document.querySelector("#trackerFollowUp");
const importTrackerFile = document.querySelector("#importTrackerFile");
const syncStatus = document.querySelector("#syncStatus");
const lockedDashboard = document.querySelector("#lockedDashboard");
const mainWorkspace = document.querySelector("#mainWorkspace");

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

let trackedApplications = loadTracker();
let auth = null;

function isRealApplyUrl(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("http://") || text.startsWith("https://");
}

function renderTracker() {
  exportTrackerButton.disabled = !trackedApplications.length;
  renderTrackerStats();

  if (!trackedApplications.length) {
    applicationTrackerBody.innerHTML = `<tr><td colspan="9" class="empty-state">Save jobs from your match results to manage them here.</td></tr>`;
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
        <label class="document-upload">
          <span>Attach files</span>
          <input type="file" multiple data-document-id="${escapeAttribute(item.id)}" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg">
        </label>
        <div class="document-list">
          ${renderDocuments(item.documents)}
        </div>
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
}

function setDashboardLockState(user) {
  const isLoggedIn = Boolean(user);
  if (lockedDashboard) lockedDashboard.hidden = isLoggedIn;
  if (mainWorkspace) mainWorkspace.hidden = !isLoggedIn;
  if (addManualApplication) addManualApplication.disabled = !isLoggedIn;
  if (importTrackerFile) importTrackerFile.disabled = !isLoggedIn;
  if (!isLoggedIn) exportTrackerButton.disabled = true;
}

async function loadServerApplications() {
  if (!auth?.currentUser) return;
  const response = await fetch("/api/applications");
  const payload = await response.json();
  if (!response.ok) return;
  trackedApplications = (payload.applications ?? []).map(normalizeTrackerItem);
  persistTracker({ rerender: true });
}

function renderTrackerStats() {
  const closedStatuses = new Set(["Rejected", "Withdrawn", "Closed"]);
  const followUpStatuses = new Set(["Follow-up needed", "No response"]);
  trackerTotal.textContent = trackedApplications.length;
  trackerActive.textContent = trackedApplications.filter((item) => !closedStatuses.has(item.status)).length;
  trackerFollowUp.textContent = trackedApplications.filter((item) => followUpStatuses.has(item.status)).length;
}

function setSyncStatus(text, isError = false) {
  if (!syncStatus) return;
  syncStatus.textContent = text;
  syncStatus.classList.toggle("error", isError);
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
  renderTrackerStats();
  if (rerender) renderTracker();
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
    status: TRACKER_STATUSES.includes(item.status) ? item.status : "Saved",
    updatedAt: String(item.updatedAt || today()),
    nextStep: String(item.nextStep || ""),
    documents: normalizeDocuments(item.documents),
    addedAt: String(item.addedAt || new Date().toISOString())
  };
}

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map((document) => ({
    id: String(document.id || createId()),
    name: String(document.name || "Document"),
    type: String(document.type || ""),
    size: Number(document.size || 0),
    uploadedAt: String(document.uploadedAt || new Date().toISOString())
  }));
}

function renderDocuments(documents = []) {
  if (!documents.length) {
    return `<span class="document-empty">No documents yet</span>`;
  }

  return documents.map((document) => `
    <span class="document-chip" title="${escapeAttribute(document.name)}">
      ${escapeHtml(document.name)}
      <button class="document-remove-button" type="button" data-document-id="${escapeAttribute(document.id)}" aria-label="Remove document">Remove</button>
    </span>
  `).join("");
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

async function addManualTrackerRow() {
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
  await saveTrackerItem(trackedApplications[0]);
}

async function removeTrackerItem(id) {
  trackedApplications = trackedApplications.filter((item) => item.id !== id);
  persistTracker();
  if (auth?.currentUser) {
    await fetch(`/api/applications/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

async function updateTrackerItem(id, field, value) {
  const item = trackedApplications.find((entry) => entry.id === id);
  if (!item) return;
  item[field] = value;
  if (field === "status") item.updatedAt = today();
  persistTracker({ rerender: field === "status" || field === "applyUrl" });
  await saveTrackerItem(item);
}

async function addApplicationDocuments(applicationId, files) {
  const item = trackedApplications.find((entry) => entry.id === applicationId);
  if (!item || !files.length) return;

  const documents = files.map((file) => ({
    id: createId(),
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString()
  }));

  item.documents = [...item.documents, ...documents];
  item.updatedAt = today();
  persistTracker();
  await saveTrackerItem(item);
}

async function removeApplicationDocument(applicationId, documentId) {
  const item = trackedApplications.find((entry) => entry.id === applicationId);
  if (!item) return;

  item.documents = item.documents.filter((document) => document.id !== documentId);
  item.updatedAt = today();
  persistTracker();
  await saveTrackerItem(item);
}

function exportTrackerCsv() {
  if (!trackedApplications.length) return;
  const csv = toCsv([
    ["Company", "Role", "Category", "Fit %", "Priority", "Status", "Source", "Location", "Work Model", "Main Fit", "Main Gap", "Recommended Action", "Notes", "Documents", "Apply URL", "Last update", "Added at"],
    ...trackedApplications.map((item) => [
      item.company,
      item.role,
      item.category,
      item.matchPercent ? `${item.matchPercent}%` : "",
      item.priority,
      item.status,
      item.source,
      item.location,
      item.workModel,
      item.mainFit,
      item.mainGap,
      item.recommendedAction,
      item.nextStep,
      item.documents.map((document) => document.name).join(" | "),
      item.applyUrl,
      item.updatedAt,
      item.addedAt
    ])
  ]);
  downloadTextFile(`\uFEFF${csv}`, "application-tracker.csv", "text/csv;charset=utf-8");
}

async function importTrackerCsv(file) {
  if (!file) return;
  if (!auth?.currentUser) {
    setSyncStatus("Login or create an account before importing a tracker file.", true);
    return;
  }

  const text = await file.text();
  const rows = parseCsv(text.replace(/^\uFEFF/u, ""));
  const [header = [], ...dataRows] = rows;
  const indexes = Object.fromEntries(header.map((name, index) => [String(name).trim().toLowerCase(), index]));
  const importedItems = dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => normalizeTrackerItem({
      company: row[indexes.company],
      role: row[indexes.role],
      category: row[indexes.category],
      matchPercent: String(row[indexes["fit %"]] ?? "").replace("%", ""),
      priority: row[indexes.priority],
      status: row[indexes.status],
      source: row[indexes.source],
      location: row[indexes.location],
      workModel: row[indexes["work model"]],
      mainFit: row[indexes["main fit"]],
      mainGap: row[indexes["main gap"]],
      recommendedAction: row[indexes["recommended action"]],
      nextStep: row[indexes.notes],
      documents: String(row[indexes.documents] ?? "")
        .split("|")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
      applyUrl: row[indexes["apply url"]],
      updatedAt: row[indexes["last update"]],
      addedAt: row[indexes["added at"]]
    }));

  if (!importedItems.length) {
    setSyncStatus("No valid rows were found in the uploaded tracker file.", true);
    return;
  }

  const existingKeys = new Set(trackedApplications.map(trackerKey));
  const newItems = importedItems.filter((item) => !existingKeys.has(trackerKey(item)));
  trackedApplications = [...newItems, ...trackedApplications];
  persistTracker();
  await Promise.all(newItems.map((item) => saveTrackerItem(item)));
  setSyncStatus(`Imported ${newItems.length} new tracker rows.`);
}

function trackerKey(item) {
  const url = String(item.applyUrl ?? "").trim().toLowerCase();
  if (url) return `url:${url}`;
  return `role:${String(item.company ?? "").trim().toLowerCase()}|${String(item.role ?? "").trim().toLowerCase()}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
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

applicationTrackerBody.addEventListener("input", (event) => {
  const field = event.target.dataset.trackerField;
  const id = event.target.dataset.trackerId;
  if (!field || !id) return;
  updateTrackerItem(id, field, event.target.value);
});

applicationTrackerBody.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='file'][data-document-id]");
  if (input) {
    addApplicationDocuments(input.dataset.documentId, [...input.files]);
    input.value = "";
    return;
  }

  const field = event.target.dataset.trackerField;
  const id = event.target.dataset.trackerId;
  if (!field || !id) return;
  updateTrackerItem(id, field, event.target.value);
});

applicationTrackerBody.addEventListener("click", (event) => {
  const documentRemoveButton = event.target.closest(".document-remove-button");
  if (documentRemoveButton) {
    const row = documentRemoveButton.closest("tr");
    const owner = row?.querySelector("[data-tracker-id]")?.dataset.trackerId;
    removeApplicationDocument(owner, documentRemoveButton.dataset.documentId);
    return;
  }

  const button = event.target.closest(".remove-tracker-button");
  if (!button) return;
  removeTrackerItem(button.dataset.trackerId);
});

addManualApplication.addEventListener("click", addManualTrackerRow);
exportTrackerButton.addEventListener("click", exportTrackerCsv);
importTrackerFile?.addEventListener("change", async () => {
  try {
    await importTrackerCsv(importTrackerFile.files[0]);
  } catch (error) {
    setSyncStatus(error.message, true);
  } finally {
    importTrackerFile.value = "";
  }
});

auth = await setupAuth({
  onUserChange(user) {
    setDashboardLockState(user);
    if (user) {
      loadServerApplications();
      return;
    }
    trackedApplications = [];
    renderTracker();
  }
});

renderTracker();
