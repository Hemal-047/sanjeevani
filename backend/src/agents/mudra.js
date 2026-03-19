// MUDRA — Onchain Attestation Preparation Agent
// Takes Bodhi's output and prepares attestations for smart contract publishing

const crypto = require('crypto');
const { chatCompletion } = require('../utils/veniceClient');

const SEVERITY_MAP = { low: 1, moderate: 2, high: 3, critical: 4 };

function icd10ToBytes32(code) {
  // Pad ICD-10 code to 32 bytes (hex representation for Solidity bytes32)
  const hex = Buffer.from(code, 'utf8').toString('hex');
  return '0x' + hex.padEnd(64, '0');
}

function generateEvidenceHash(evidenceData) {
  const str = typeof evidenceData === 'string' ? evidenceData : JSON.stringify(evidenceData);
  return '0x' + crypto.createHash('sha256').update(str).digest('hex');
}

async function prepare(bodhiOutput) {
  if (!bodhiOutput || !bodhiOutput.synthesis) {
    return { error: 'invalid_input', message: 'No Bodhi synthesis provided' };
  }

  const { synthesis, reasoningChain } = bodhiOutput;
  const claims = synthesis.attestableClaims || [];
  const conditions = synthesis.conditions || [];
  const trends = synthesis.trends || [];

  if (claims.length === 0) {
    return {
      success: true,
      attestations: [],
      consentSummary: 'No claims met the confidence threshold for onchain attestation.',
      validationNotes: 'Bodhi found no conditions with >= 70% confidence.',
    };
  }

  // Build evidence context for Venice validation
  const evidenceContext = {
    conditions,
    trends,
    claims,
    reasoningSummary: (reasoningChain || []).map(s => `Step ${s.step} (${s.title}): ${s.summary}`),
  };

  // Venice "second opinion" call — validate and refine claims
  const validationMessages = [
    {
      role: 'system',
      content: `You are Mudra, a medical attestation validation agent. Your job is to review health claims before they are published as onchain attestations. You must be conservative — false attestations damage trust.

For each claim, evaluate:
1. Is the ICD-10 code accurate? Suggest a better one if not.
2. Is the confidence score reasonable given the evidence?
3. Is the severity classification correct?
4. Are there any red flags that should prevent publication?

Return ONLY valid JSON (no markdown, no code fences):
{
  "validatedClaims": [
    {
      "originalCode": "<from input>",
      "validatedCode": "<confirmed or corrected ICD-10>",
      "conditionName": "<confirmed or refined name>",
      "severity": "low|moderate|high|critical",
      "adjustedConfidence": <0-100>,
      "approved": true|false,
      "reason": "<why approved or rejected>",
      "evidenceSummary": "<brief description of supporting evidence>"
    }
  ],
  "overallAssessment": "<brief assessment of claim quality>"
}`,
    },
    {
      role: 'user',
      content: `Validate these health claims for onchain attestation:\n\nClaims:\n${JSON.stringify(claims, null, 2)}\n\nSupporting Evidence:\n${JSON.stringify(evidenceContext, null, 2)}`,
    },
  ];

  let validation;
  try {
    const raw = await chatCompletion(validationMessages, { maxTokens: 4096 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    validation = JSON.parse(cleaned);
  } catch (err) {
    return {
      error: 'validation_failed',
      message: `Venice validation call failed: ${err.message}`,
    };
  }

  // Build final attestations from validated claims
  const attestations = [];
  const consentLines = [];

  for (const vc of (validation.validatedClaims || [])) {
    if (!vc.approved) {
      consentLines.push(`REJECTED: ${vc.conditionName} (${vc.originalCode}) — ${vc.reason}`);
      continue;
    }

    const code = vc.validatedCode || vc.originalCode;
    const severityNum = SEVERITY_MAP[vc.severity] || 2;
    const evidenceData = {
      conditionCode: code,
      conditionName: vc.conditionName,
      evidence: vc.evidenceSummary,
      confidence: vc.adjustedConfidence,
      timestamp: new Date().toISOString(),
    };

    const attestation = {
      conditionCode: code,
      conditionCodeBytes32: icd10ToBytes32(code),
      conditionName: vc.conditionName,
      severity: severityNum,
      severityLabel: vc.severity,
      confidence: vc.adjustedConfidence,
      evidenceHash: generateEvidenceHash(evidenceData),
      evidenceSummary: vc.evidenceSummary,
      validationReason: vc.reason,
    };

    attestations.push(attestation);

    consentLines.push(
      `APPROVED: You are publishing that you have "${vc.conditionName}" (ICD-10: ${code}) ` +
      `with ${vc.adjustedConfidence}% confidence and ${vc.severity} severity. ` +
      `This attestation will be visible onchain. Evidence: ${vc.evidenceSummary}`
    );
  }

  const consentSummary = [
    'The following health attestations are ready to be published onchain:',
    '',
    ...consentLines,
    '',
    `Total attestations: ${attestations.length}`,
    '',
    'By publishing, you confirm these findings are based on your actual medical records. ',
    'Attestations can be revoked at any time. Researchers may send you trial invitations or data purchase requests based on these attestations.',
  ].join('\n');

  return {
    success: true,
    attestations,
    consentSummary,
    validationNotes: validation.overallAssessment,
    totalClaims: claims.length,
    approvedCount: attestations.length,
    rejectedCount: claims.length - attestations.length,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { prepare };
