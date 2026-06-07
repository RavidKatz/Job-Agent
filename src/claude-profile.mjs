const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const DEFAULT_TIMEOUT_MS = 12000;

const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    previousRoles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          summary: { type: "string" }
        }
      }
    },
    languageDetected: { type: "string" },
    profileWarnings: { type: "array", items: { type: "string" } },
    extractionQualityNotes: { type: "array", items: { type: "string" } },
    claudeConfidenceScore: { type: "number" },
    claudeSuggestedRoles: { type: "array", items: { type: "string" } }
  },
  required: [
    "previousRoles",
    "languageDetected",
    "profileWarnings",
    "extractionQualityNotes",
    "claudeConfidenceScore",
    "claudeSuggestedRoles"
  ]
};

function timeoutMsFromEnv(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function cleanString(value, maxLength = 180) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanStringArray(value, maxItems = 8, maxLength = 180) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    const cleaned = cleanString(item, maxLength);
    if (cleaned && !result.includes(cleaned)) result.push(cleaned);
    if (result.length >= maxItems) break;
  }
  return result;
}

function sanitizePreviousRoles(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((role) => ({
      title: cleanString(role?.title) ?? null,
      company: cleanString(role?.company) ?? null,
      startDate: cleanString(role?.startDate, 40) ?? null,
      endDate: cleanString(role?.endDate, 40) ?? null,
      summary: cleanString(role?.summary, 260) ?? null
    }))
    .filter((role) => role.title || role.company || role.summary)
    .slice(0, 8);
}

export function sanitizeClaudeProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const confidence = Number(value.claudeConfidenceScore);
  const sanitized = {
    previousRoles: sanitizePreviousRoles(value.previousRoles),
    languageDetected: cleanString(value.languageDetected, 80),
    profileWarnings: cleanStringArray(value.profileWarnings),
    extractionQualityNotes: cleanStringArray(value.extractionQualityNotes),
    claudeConfidenceScore: Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, Math.round(confidence)))
      : null,
    claudeSuggestedRoles: cleanStringArray(value.claudeSuggestedRoles, 8, 120)
  };

  const hasUsefulData = sanitized.previousRoles.length
    || sanitized.languageDetected
    || sanitized.profileWarnings.length
    || sanitized.extractionQualityNotes.length
    || sanitized.claudeConfidenceScore != null
    || sanitized.claudeSuggestedRoles.length;

  return hasUsefulData ? sanitized : null;
}

function extractJsonFromText(text) {
  const source = String(text ?? "").trim();
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractResponsePayload(response) {
  for (const block of response?.content ?? []) {
    if (block?.type === "tool_use" && block.name === "emit_candidate_profile") {
      return block.input;
    }
  }

  const text = (response?.content ?? [])
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n");
  return extractJsonFromText(text);
}

async function createDefaultClient(apiKey) {
  const mod = await import("@anthropic-ai/sdk");
  const Anthropic = mod.default ?? mod.Anthropic;
  return new Anthropic({ apiKey });
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Claude profile analysis timed out.")), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function analyzeWithClaude(resumeText, config = {}, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !options.client) return null;

  const timeoutMs = Number(options.timeoutMs)
    || timeoutMsFromEnv(process.env.CLAUDE_PROFILE_TIMEOUT_MS);
  const model = options.model
    || process.env.CLAUDE_PROFILE_MODEL
    || DEFAULT_MODEL;

  try {
    const client = options.client ?? await createDefaultClient(apiKey);
    const response = await withTimeout(client.messages.create({
      model,
      max_tokens: 900,
      temperature: 0,
      tools: [{
        name: "emit_candidate_profile",
        description: "Return safe structured candidate profile enrichment extracted from the CV.",
        input_schema: PROFILE_SCHEMA
      }],
      tool_choice: { type: "tool", name: "emit_candidate_profile" },
      messages: [{
        role: "user",
        content: [
          "Analyze the resume text and return only structured profile enrichment.",
          "Do not invent experience. Keep warnings explicit when evidence is weak.",
          "Do not include private contact details.",
          `Target role input, if any: ${config.targetRoleInput ?? ""}`,
          "Resume text:",
          String(resumeText ?? "").slice(0, 18000)
        ].join("\n\n")
      }]
    }), timeoutMs);

    return sanitizeClaudeProfile(extractResponsePayload(response));
  } catch {
    return null;
  }
}
