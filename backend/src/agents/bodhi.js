// BODHI — Cross-Reference & Discovery Agent
// Multi-step reasoning chain for health pattern discovery

const { chatCompletion } = require('../utils/veniceClient');

function makeTimestamp() {
  return new Date().toISOString();
}

function buildContext(extractions, familyHistory) {
  return JSON.stringify({ extractions, familyHistory: familyHistory || null }, null, 2);
}

async function runStep(stepNum, title, systemPrompt, userContent, priorContext) {
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  if (priorContext) {
    messages.push({ role: 'assistant', content: `Previous analysis:\n${priorContext}` });
  }

  messages.push({ role: 'user', content: userContent });

  const raw = await chatCompletion(messages, { maxTokens: 4096 });

  return {
    step: stepNum,
    title,
    summary: '',
    details: raw,
    timestamp: makeTimestamp(),
  };
}

async function analyze(extractions, familyHistory) {
  if (!extractions || extractions.length === 0) {
    return { error: 'no_extractions', message: 'No Drishti extractions provided' };
  }

  const reasoningChain = [];
  const dataContext = buildContext(extractions, familyHistory);
  let accumulatedContext = '';

  try {
    // STEP 1 — TIMELINE BUILD
    const step1 = await runStep(1, 'Timeline Build',
      `You are Bodhi, a health intelligence agent. Your task is to organize health findings chronologically and identify biomarkers that appear across multiple reports.

Return ONLY valid JSON (no markdown, no code fences):
{
  "timeline": [{"date": "", "documentType": "", "keyFindings": [""]}],
  "recurringBiomarkers": [{"name": "", "occurrences": [{"date": "", "value": "", "unit": ""}]}],
  "summary": ""
}`,
      `Analyze these medical extractions and build a chronological timeline:\n\n${dataContext}`
    );
    step1.summary = 'Organized findings chronologically, identified recurring biomarkers across documents';
    reasoningChain.push(step1);
    accumulatedContext = step1.details;

    // STEP 2 — TREND ANALYSIS
    const step2 = await runStep(2, 'Trend Analysis',
      `You are Bodhi, a health intelligence agent performing trend analysis. Given chronological health data and recurring biomarkers, analyze trends.

For each recurring biomarker, determine:
- Direction: rising, falling, or stable
- Rate of change (percentage between measurements)
- Whether the trend is accelerating
- Clinical significance

Return ONLY valid JSON (no markdown, no code fences):
{
  "trends": [{"biomarker": "", "direction": "rising|falling|stable", "values": [], "dates": [], "rateOfChange": "", "accelerating": false, "concern": false, "clinicalNote": ""}],
  "summary": ""
}`,
      `Based on this timeline analysis, identify and analyze all biomarker trends:\n\nTimeline Analysis:\n${accumulatedContext}\n\nRaw Data:\n${dataContext}`,
      accumulatedContext
    );
    step2.summary = 'Analyzed biomarker trends, flagged concerning directions and acceleration';
    reasoningChain.push(step2);
    accumulatedContext += '\n\n' + step2.details;

    // STEP 3 — FAMILY RISK OVERLAY (conditional)
    let step3Result = null;
    if (familyHistory && familyHistory.members && familyHistory.members.length > 0) {
      const step3 = await runStep(3, 'Family Risk Overlay',
        `You are Bodhi, a health intelligence agent. Cross-reference the patient's biomarker trends with their family medical history to identify hereditary risk patterns.

Key logic:
- If a family member has a condition and the patient's related biomarkers are trending toward that condition, flag HIGH risk
- Consider age of onset in family members vs patient's current trajectory
- Weight first-degree relatives (parents, siblings) higher than second-degree

Return ONLY valid JSON (no markdown, no code fences):
{
  "familyRisks": [{"condition": "", "familyMember": "", "relation": "", "ageOfOnset": null, "patientRiskLevel": "low|moderate|high|critical", "evidence": "", "relatedBiomarkers": [""]}],
  "summary": ""
}`,
        `Cross-reference family history against patient biomarker trends:\n\nFamily History:\n${JSON.stringify(familyHistory, null, 2)}\n\nPrior Analysis:\n${accumulatedContext}`,
        accumulatedContext
      );
      step3.summary = 'Cross-referenced family conditions with patient biomarker trends';
      reasoningChain.push(step3);
      step3Result = step3.details;
      accumulatedContext += '\n\n' + step3.details;
    } else {
      reasoningChain.push({
        step: 3,
        title: 'Family Risk Overlay',
        summary: 'Skipped — no family history provided',
        details: 'No family history data available. Proceeding without hereditary risk analysis.',
        timestamp: makeTimestamp(),
      });
    }

    // STEP 4 — DRUG INTERACTION CHECK
    const allMeds = extractions.flatMap(e => e.medications || []);
    if (allMeds.length > 1) {
      const step4 = await runStep(4, 'Drug Interaction Check',
        `You are Bodhi, a health intelligence agent checking for drug interactions. Analyze all medications found across documents for:
- Direct drug-drug interactions
- Contraindications with current lab values (e.g., a drug that stresses the liver when liver enzymes are already elevated)
- Duplicate therapies or overlapping mechanisms

Return ONLY valid JSON (no markdown, no code fences):
{
  "interactions": [{"drugs": ["", ""], "severity": "low|moderate|high|critical", "description": "", "recommendation": ""}],
  "contraindications": [{"drug": "", "labValue": "", "concern": ""}],
  "summary": ""
}`,
        `Check for drug interactions and contraindications:\n\nMedications found:\n${JSON.stringify(allMeds, null, 2)}\n\nPrior Analysis:\n${accumulatedContext}`,
        accumulatedContext
      );
      step4.summary = 'Checked medication interactions and contraindications against lab values';
      reasoningChain.push(step4);
      accumulatedContext += '\n\n' + step4.details;
    } else {
      reasoningChain.push({
        step: 4,
        title: 'Drug Interaction Check',
        summary: allMeds.length === 0 ? 'Skipped — no medications found' : 'Skipped — only one medication found',
        details: 'Insufficient medications for interaction analysis.',
        timestamp: makeTimestamp(),
      });
    }

    // STEP 5 — SYNTHESIS
    const step5 = await runStep(5, 'Synthesis',
      `You are Bodhi, a health intelligence agent producing a final comprehensive health profile. Synthesize ALL prior analysis steps into a unified assessment.

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
      `Produce the final unified health profile by synthesizing all analysis:\n\n${accumulatedContext}`,
      accumulatedContext
    );
    step5.summary = 'Produced unified health profile with risk scores, conditions, and attestable claims';
    reasoningChain.push(step5);

    // Parse final synthesis
    const synthesisRaw = step5.details;
    let synthesis;
    try {
      const cleaned = synthesisRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
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
        rawSynthesis: synthesisRaw,
      };
    }

    return {
      success: true,
      synthesis,
      reasoningChain,
      documentsAnalyzed: extractions.length,
      familyHistoryIncluded: !!(familyHistory && familyHistory.members && familyHistory.members.length > 0),
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

/**
 * Predictive Alert — Venice-powered 3-6 month health projection
 * Used by Bodhi Health Watch for real autonomous monitoring
 */
async function predictiveAlert(synthesis) {
  if (!synthesis) {
    return { error: 'no_synthesis', message: 'No synthesis data provided' };
  }

  const messages = [
    {
      role: 'system',
      content: `You are Bodhi, a health intelligence agent providing predictive health monitoring. Based on a patient's current health trends, conditions, and biomarker data, predict what will happen in 3-6 months if no intervention occurs.

Return ONLY valid JSON (no markdown, no code fences):
{
  "prediction": "<2-3 sentence summary of projected health trajectory>",
  "urgency": "low|moderate|high|critical",
  "projectedBiomarkers": [
    {
      "biomarker": "<name>",
      "currentValue": "<current>",
      "projectedValue": "<projected in 3-6 months>",
      "direction": "rising|falling|stable",
      "concern": true|false
    }
  ],
  "recommendedActions": ["<specific action>"],
  "timeframe": "3-6 months"
}

Be specific with biomarker projections. Use actual numbers where possible. Focus on actionable insights.`,
    },
    {
      role: 'user',
      content: `Based on these health trends and conditions, predict what will happen in 3-6 months if no intervention occurs. Give specific biomarker projections.\n\n${JSON.stringify(synthesis, null, 2)}`,
    },
  ];

  try {
    const raw = await chatCompletion(messages, { maxTokens: 2048 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return { error: 'prediction_failed', message: err.message };
  }
}

module.exports = { analyze, predictiveAlert };
