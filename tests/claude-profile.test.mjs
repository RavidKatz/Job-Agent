import assert from "node:assert/strict";
import {
  analyzeWithClaude,
  sanitizeClaudeProfile
} from "../src/claude-profile.mjs";
import {
  buildResumeProfile,
  mergeClaudeProfile,
  toPublicResumeProfile
} from "../src/profile.mjs";

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalTimeout = process.env.CLAUDE_PROFILE_TIMEOUT_MS;

function restoreEnv() {
  if (originalApiKey == null) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  }

  if (originalTimeout == null) {
    delete process.env.CLAUDE_PROFILE_TIMEOUT_MS;
  } else {
    process.env.CLAUDE_PROFILE_TIMEOUT_MS = originalTimeout;
  }
}

function mockClient(responseFactory) {
  return {
    messages: {
      create: async (payload) => responseFactory(payload)
    }
  };
}

const ruleProfile = buildResumeProfile(`
Professional Experience
2021 - present | Recruiter, PeopleCo
Managed recruiting, interviews, onboarding and talent acquisition.
Education
2017 - 2020 | B.A. Human Resources
`, {
  coreSkills: ["Recruiting", "Talent Acquisition", "Onboarding", "Human Resources"],
  skillAliases: {},
  domainKeywords: [],
  targetRoles: []
});

try {
  delete process.env.ANTHROPIC_API_KEY;
  const noKey = await analyzeWithClaude("Resume text", {});
  assert.equal(noKey, null, "missing API key without mock client should return null");

  const validProfile = await analyzeWithClaude("Resume text", {}, {
    client: mockClient((payload) => {
      assert.equal(payload.temperature, 0);
      assert.ok(payload.tools?.[0]?.input_schema, "structured tool schema should be sent");
      return {
        content: [{
          type: "tool_use",
          name: "emit_candidate_profile",
          input: {
            previousRoles: [{
              title: "Recruiter",
              company: "PeopleCo",
              startDate: "2021",
              endDate: "Present",
              summary: "Managed full-cycle recruiting."
            }],
            languageDetected: "English",
            profileWarnings: ["Some dates are approximate."],
            extractionQualityNotes: ["CV text was readable."],
            claudeConfidenceScore: 87.7,
            claudeSuggestedRoles: ["Recruiter", "Talent Acquisition Specialist"]
          }
        }]
      };
    })
  });

  assert.deepEqual(validProfile, {
    previousRoles: [{
      title: "Recruiter",
      company: "PeopleCo",
      startDate: "2021",
      endDate: "Present",
      summary: "Managed full-cycle recruiting."
    }],
    languageDetected: "English",
    profileWarnings: ["Some dates are approximate."],
    extractionQualityNotes: ["CV text was readable."],
    claudeConfidenceScore: 88,
    claudeSuggestedRoles: ["Recruiter", "Talent Acquisition Specialist"]
  });

  const textJsonProfile = await analyzeWithClaude("Resume text", {}, {
    client: mockClient(() => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          previousRoles: [],
          languageDetected: "Hebrew",
          profileWarnings: [],
          extractionQualityNotes: ["Parsed from text response."],
          claudeConfidenceScore: 70,
          claudeSuggestedRoles: ["HR Coordinator"]
        })
      }]
    }))
  });
  assert.equal(textJsonProfile.languageDetected, "Hebrew");
  assert.equal(textJsonProfile.claudeSuggestedRoles[0], "HR Coordinator");

  const invalidJson = await analyzeWithClaude("Resume text", {}, {
    client: mockClient(() => ({
      content: [{ type: "text", text: "not json" }]
    }))
  });
  assert.equal(invalidJson, null, "invalid JSON should return null");

  const invalidSchema = sanitizeClaudeProfile("bad payload");
  assert.equal(invalidSchema, null, "invalid schema should sanitize to null");

  const timeout = await analyzeWithClaude("Resume text", {}, {
    timeoutMs: 5,
    client: mockClient(() => new Promise(() => {}))
  });
  assert.equal(timeout, null, "timeout should return null");

  const rulesOnly = mergeClaudeProfile(ruleProfile, null);
  assert.equal(rulesOnly.profileSource, "rules");
  assert.equal(rulesOnly.roleRecommendations, ruleProfile.roleRecommendations);

  const enriched = mergeClaudeProfile(ruleProfile, validProfile);
  assert.equal(enriched.profileSource, "claude+rules");
  assert.equal(enriched.roleRecommendations, ruleProfile.roleRecommendations);
  assert.equal(enriched.previousRoles[0].title, "Recruiter");
  assert.equal(enriched.claudeConfidenceScore, 88);

  const publicProfile = toPublicResumeProfile(enriched);
  assert.equal(publicProfile.profileSource, "claude+rules");
  assert.equal(publicProfile.previousRoles[0].company, "PeopleCo");
  assert.equal(publicProfile.languageDetected, "English");
  assert.deepEqual(publicProfile.profileWarnings, ["Some dates are approximate."]);
  assert.deepEqual(publicProfile.extractionQualityNotes, ["CV text was readable."]);
  assert.equal(publicProfile.claudeConfidenceScore, 88);
  assert.deepEqual(publicProfile.claudeSuggestedRoles, ["Recruiter", "Talent Acquisition Specialist"]);

  console.log("All claude-profile tests passed.");
} finally {
  restoreEnv();
}
