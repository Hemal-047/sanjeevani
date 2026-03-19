// BODHI — Cross-Reference & Discovery Agent
// Optimized 3-step reasoning chain for health pattern discovery

const { chatCompletion } = require('../utils/veniceClient');

function makeTimestamp() {
  return new Date().toISOString();
}

// Compress extractions: strip normal findings, keep only abnormal + meds + diagnoses
function compressExtractions(extractions) {
  return extractions.map(e => ({
    filename: e.filename,
    documentType: e.documentType,
    date: e.date,
    patientAge: e.patientAge,
    findings: (e.findings || []).filter(f => f.status !== 'normal'),
    medications: e.medications || [],
    diagnoses: e.diagnoses || [],
    rawSummary: e.rawSummary,
  }));
}

async function runStep(stepNum, title, systemPrompt, userContent) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const raw = await chatCompletion(messages, { maxTokens: 4096 });

  return {
    step: stepNum,
    title,
    summary: '',
    details: raw,
    timestamp: makeTimestamp(),
  };
}

async function analyze(extractions, familyHistory, onStep) {
  if (!extractions || extractions.length === 0) {
    return { error: 'no_extractions', message: 'No Drishti extractions provided' };
  }

  const reasoningChain = [];
  const compressed = compressExtractions(extractions);
  const dataContext = JSON.stringify({ extractions: compressed, familyHistory: familyHistory || null }, null, 2);
  const allMeds = extractions.flatMap(e => e.medications || []);
  const hasFamilyHistory = familyHistory && familyHistory.members && familyHistory.members.length > 0;
  const hasMeds = allMeds.length > 1;

  try {
    // STEP 1 — TIMELINE BUILD + TREND ANALYSIS (merged)
    const step1 = await runStep(1, 'Timeline & Trend Analysis',
      `You are Bodhi, a health intelligence agent. Perform two tasks in one pass:

TASK A — TIMELINE: Organize all findings chronologically across documents. Identify biomarkers that appear in multiple reports.
TASK B — TRENDS: For recurring biomarkers, calculate direction (rising/falling/stable), rate of change, and flag accelerating or concerning trends.

Return ONLY valid JSON (no markdown, no code fences):
{
  "timeline": [{"date": "", "documentType": "", "keyFindings": [""]}],
  "recurringBiomarkers": [{"name": "", "occurrences": [{"date": "", "value": "", "unit": ""}]}],
  "trends": [{"biomarker": "", "direction": "rising|falling|stable", "values": [], "dates": [], "rateOfChange": "", "accelerating": false, "concern": false, "clinicalNote": ""}],
  "timelineSummary": "",
  "trendSummary": ""
}`,
      `Analyze these medical extractions — build timeline and analyze trends:\n\n${dataContext}`
    );
    step1.summary = 'Built chronological timeline and analyzed biomarker trends across documents';
    reasoningChain.push(step1);
    if (onStep) onStep(step1);

    // Also emit sub-steps for the reasoning chain display
    reasoningChain.push({
      step: 2,
      title: 'Trend Analysis',
      summary: 'Identified trending biomarkers, flagged concerning directions and acceleration',
      details: '(combined with Step 1)',
      timestamp: makeTimestamp(),
    });
    if (onStep) onStep(reasoningChain[reasoningChain.length - 1]);

    // STEP 2 — FAMILY RISK + DRUG INTERACTIONS (merged, conditional)
    let step2Context = '';
    if (hasFamilyHistory || hasMeds) {
      const familyBlock = hasFamilyHistory
        ? `\n\nFAMILY HISTORY:\n${JSON.stringify(familyHistory, null, 2)}\n\nCross-reference family conditions against patient biomarker trends. If a family member has a condition and patient's biomarkers trend toward it, flag HIGH risk.`
        : '\n\nNo family history provided — skip hereditary risk analysis.';

      const medsBlock = hasMeds
        ? `\n\nMEDICATIONS FOUND:\n${JSON.stringify(allMeds, null, 2)}\n\nCheck for drug-drug interactions, contraindications with current lab values, and duplicate therapies.`
        : '\n\nInsufficient medications for interaction analysis.';

      const step2 = await runStep(3, 'Risk Overlay & Drug Check',
        `You are Bodhi, a health intelligence agent. Perform two tasks:

TASK A — FAMILY RISK OVERLAY: Cross-reference family medical history with patient's biomarker trends to identify hereditary risk patterns. Weight first-degree relatives higher.
TASK B — DRUG INTERACTION CHECK: Check all medications for interactions, contraindications with lab values, and overlapping mechanisms.

Return ONLY valid JSON (no markdown, no code fences):
{
  "familyRisks": [{"condition": "", "familyMember": "", "relation": "", "ageOfOnset": null, "patientRiskLevel": "low|moderate|high|critical", "evidence": "", "relatedBiomarkers": [""]}],
  "interactions": [{"drugs": ["", ""], "severity": "low|moderate|high|critical", "description": "", "recommendation": ""}],
  "contraindications": [{"drug": "", "labValue": "", "concern": ""}],
  "riskSummary": "",
  "drugSummary": ""
}`,
        `Analyze risks and drug interactions based on prior findings:\n\nTimeline & Trends:\n${step1.details}${familyBlock}${medsBlock}`
      );
      step2.summary = 'Cross-referenced family history and checked medication interactions';
      reasoningChain.push(step2);
      if (onStep) onStep(step2);
      step2Context = step2.details;
    } else {
      const skipEntry = {
        step: 3,
        title: 'Risk Overlay & Drug Check',
        summary: 'Skipped — no family history or multiple medications found',
        details: 'Insufficient data for risk overlay or drug interaction analysis.',
        timestamp: makeTimestamp(),
      };
      reasoningChain.push(skipEntry);
      if (onStep) onStep(skipEntry);
    }

    // Also emit sub-step for drug interactions
    reasoningChain.push({
      step: 4,
      title: 'Drug Interaction Check',
      summary: hasMeds ? 'Checked medication interactions and contraindications' : 'Skipped — insufficient medications',
      details: '(combined with Step 3)',
      timestamp: makeTimestamp(),
    });
    if (onStep) onStep(reasoningChain[reasoningChain.length - 1]);

    // STEP 3 — SYNTHESIS (standalone — quality matters here)
    const step3 = await runStep(5, 'Synthesis',
      `You are Bodhi, a health intelligence agent producing a final comprehensive health profile. Synthesize ALL prior analysis into a unified assessment.

Return ONLY valid JSON (no markdown, no code fences):
{
  "overallRiskScore": <0-100>,
  "conditions": [{"name": "", "confidence": <0-100>, "severity": "low|moderate|high|critical", "evidence": ""}],
  "trends": [{"biomarker": "", "direction": "rising|falling|stable", "values": [], "dates": [], "concern": false}],
  "drugInteractions": [],
  "riskFactors": [{"factor": "", "source": "personal|family|lifestyle", "severity": "low|moderate|high|critical"}],
  "recommendations": [""],
  "attestableClaims": [{"conditionCode": "", "conditionName": "", "confidence": <0-100>, "severity": "low|moderate|high|critical", "evidenceHash": ""}]
}

Rules for attestableClaims:
- Only include conditions with confidence >= 70
- conditionCode should be an ICD-10-like code (e.g., E11 for Type 2 Diabetes, R73.03 for Prediabetes)
- evidenceHash should be a descriptive hash placeholder like "sha256:<description_of_evidence>"
- These claims must be strong enough to publish as onchain health attestations`,
      `Produce the final unified health profile:\n\nTimeline & Trends:\n${step1.details}\n\nRisk & Drug Analysis:\n${step2Context || 'N/A'}\n\nRaw Data:\n${dataContext}`
    );
    step3.summary = 'Produced unified health profile with risk scores, conditions, and attestable claims';
    reasoningChain.push(step3);
    if (onStep) onStep(step3);

    // Parse final synthesis
    let synthesis;
    try {
      const cleaned = step3.details.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      synthesis = JSON.parse(cleaned);
    } catch {
      synthesis = {
        overallRiskScore: 0,
        conditions: [],
        trends: [],
        drugInteractions: [],
        riskFactors: [],
        recommendations: [],
        attestableClaims: [],
        parseError: 'Could not parse synthesis JSON',
        rawSynthesis: step3.details,
      };
    }

    return {
      success: true,
      synthesis,
      reasoningChain,
      documentsAnalyzed: extractions.length,
      familyHistoryIncluded: hasFamilyHistory,
      timestamp: makeTimestamp(),
    };
  } catch (err) {
    return {
      error: 'bodhi_analysis_failed',
      message: err.message,
      reasoningChain,
    };
  }
}

module.exports = { analyze };
