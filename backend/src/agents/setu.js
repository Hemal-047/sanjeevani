// SETU — Marketplace & Matching Agent
// Bridges patients to researchers via attestation matching

const { chatCompletion } = require('../utils/veniceClient');

async function patientProfile(attestations) {
  if (!attestations || attestations.length === 0) {
    return { error: 'no_attestations', message: 'No attestations provided' };
  }

  const messages = [
    {
      role: 'system',
      content: `You are Setu, a health data marketplace matching agent. Given a patient's published health attestations, generate a research matchability profile.

Analyze the conditions, severity, and confidence levels to determine what research studies this patient might qualify for, how valuable their data is, and what data packages they could sell.

Return ONLY valid JSON (no markdown, no code fences):
{
  "matchableStudyTypes": ["<type of clinical study this patient could join>"],
  "estimatedDataValue": "low|medium|high|premium",
  "suggestedDataPackages": [
    {
      "name": "<package name>",
      "description": "<what's included>",
      "dataPoints": ["<specific data points>"],
      "estimatedPrice": "<price range in ETH>"
    }
  ],
  "patientSummary": "<brief description of patient's research value>"
}

Rules:
- estimatedDataValue is "premium" if rare conditions or multiple comorbidities, "high" if trending/progressive conditions, "medium" for common conditions with good data, "low" for single common conditions
- Suggest 2-4 data packages ranging from basic to comprehensive
- Study types should be specific (e.g., "Phase 3 SGLT2 inhibitor trial" not just "diabetes study")`,
    },
    {
      role: 'user',
      content: `Generate a research matchability profile for a patient with these attestations:\n\n${JSON.stringify(attestations, null, 2)}`,
    },
  ];

  try {
    const raw = await chatCompletion(messages, { maxTokens: 4096 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return { error: 'profile_generation_failed', message: err.message };
  }
}

async function researcherSearch(criteria, availableAttestations) {
  if (!criteria) {
    return { error: 'no_criteria', message: 'Search criteria required' };
  }
  if (!availableAttestations || availableAttestations.length === 0) {
    return { error: 'no_attestations', message: 'No attestations to search' };
  }

  const messages = [
    {
      role: 'system',
      content: `You are Setu, a health data marketplace matching agent. A researcher is looking for patients matching specific criteria. Rank and score each available attestation against their requirements.

Return ONLY valid JSON (no markdown, no code fences):
{
  "matches": [
    {
      "attestationId": <number>,
      "matchScore": <0-100>,
      "matchReasons": ["<why this patient fits>"],
      "gaps": ["<what additional data might be needed>"]
    }
  ],
  "searchSummary": "<brief summary of results>",
  "totalMatches": <number of matches with score > 50>
}

Rules:
- Score 90-100: Perfect match, all criteria met
- Score 70-89: Strong match, minor gaps
- Score 50-69: Partial match, notable gaps
- Score <50: Weak match, include but flag limitations
- Sort by matchScore descending
- Be specific in matchReasons and gaps`,
    },
    {
      role: 'user',
      content: `Find matching patients for this researcher's criteria:\n\nCriteria:\n${JSON.stringify(criteria, null, 2)}\n\nAvailable Attestations:\n${JSON.stringify(availableAttestations, null, 2)}`,
    },
  ];

  try {
    const raw = await chatCompletion(messages, { maxTokens: 4096 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return { error: 'search_failed', message: err.message };
  }
}

module.exports = { patientProfile, researcherSearch };
