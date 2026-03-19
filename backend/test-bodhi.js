require('dotenv').config();
const bodhi = require('./src/agents/bodhi');

// Two fake Drishti extractions — lab reports 6 months apart
// showing glucose trending from 110 to 126, HbA1c from 5.9 to 6.4
const EXTRACTION_1 = {
  documentType: 'lab_report',
  patientAge: 42,
  date: '2024-06-15',
  findings: [
    { testName: 'Fasting Glucose', value: '110', unit: 'mg/dL', referenceRange: '70-100', status: 'high' },
    { testName: 'HbA1c', value: '5.9', unit: '%', referenceRange: '4.0-5.6', status: 'high' },
    { testName: 'Total Cholesterol', value: '210', unit: 'mg/dL', referenceRange: '<200', status: 'high' },
    { testName: 'LDL Cholesterol', value: '140', unit: 'mg/dL', referenceRange: '<100', status: 'high' },
    { testName: 'HDL Cholesterol', value: '42', unit: 'mg/dL', referenceRange: '>40', status: 'normal' },
    { testName: 'Triglycerides', value: '180', unit: 'mg/dL', referenceRange: '<150', status: 'high' },
    { testName: 'Creatinine', value: '1.0', unit: 'mg/dL', referenceRange: '0.7-1.3', status: 'normal' },
  ],
  medications: [
    { name: 'Metformin', dosage: '500mg', frequency: 'Once daily', duration: '3 months' },
  ],
  diagnoses: ['Impaired fasting glucose', 'Dyslipidemia'],
  rawSummary: 'Patient shows elevated fasting glucose and HbA1c in pre-diabetic range, with lipid abnormalities.',
  confidence: 92,
};

const EXTRACTION_2 = {
  documentType: 'lab_report',
  patientAge: 42,
  date: '2024-12-15',
  findings: [
    { testName: 'Fasting Glucose', value: '126', unit: 'mg/dL', referenceRange: '70-100', status: 'high' },
    { testName: 'HbA1c', value: '6.4', unit: '%', referenceRange: '4.0-5.6', status: 'high' },
    { testName: 'Total Cholesterol', value: '225', unit: 'mg/dL', referenceRange: '<200', status: 'high' },
    { testName: 'LDL Cholesterol', value: '148', unit: 'mg/dL', referenceRange: '<100', status: 'high' },
    { testName: 'HDL Cholesterol', value: '39', unit: 'mg/dL', referenceRange: '>40', status: 'low' },
    { testName: 'Triglycerides', value: '205', unit: 'mg/dL', referenceRange: '<150', status: 'high' },
    { testName: 'Creatinine', value: '1.1', unit: 'mg/dL', referenceRange: '0.7-1.3', status: 'normal' },
    { testName: 'Microalbumin (Urine)', value: '25', unit: 'mg/L', referenceRange: '<20', status: 'high' },
  ],
  medications: [
    { name: 'Metformin', dosage: '1000mg', frequency: 'Twice daily', duration: '6 months' },
    { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily', duration: '6 months' },
  ],
  diagnoses: ['Pre-diabetes', 'Dyslipidemia', 'Early nephropathy screening positive'],
  rawSummary: 'Worsening glycemic control with glucose now at diabetic threshold. Lipids worsened. New microalbuminuria detected.',
  confidence: 95,
};

const FAMILY_HISTORY = {
  members: [
    { relation: 'Father', conditions: ['Type 2 Diabetes', 'Coronary Artery Disease'], ageOfOnset: 52 },
    { relation: 'Mother', conditions: ['Hypertension', 'Hypothyroidism'], ageOfOnset: 48 },
    { relation: 'Paternal Grandfather', conditions: ['Type 2 Diabetes', 'Stroke'], ageOfOnset: 60 },
  ],
};

async function main() {
  console.log('=== BODHI CROSS-REFERENCE & DISCOVERY AGENT TEST ===\n');
  console.log(`Testing with ${2} Drishti extractions + family history\n`);
  console.log('Starting 5-step reasoning chain...\n');

  const result = await bodhi.analyze([EXTRACTION_1, EXTRACTION_2], FAMILY_HISTORY);

  if (result.error) {
    console.error('Bodhi analysis failed:', result.error, result.message);
    if (result.reasoningChain) {
      console.log('\nPartial reasoning chain:');
      result.reasoningChain.forEach(s => console.log(`  Step ${s.step}: ${s.title} — ${s.summary}`));
    }
    process.exit(1);
  }

  // Print reasoning chain
  console.log('--- REASONING CHAIN ---\n');
  for (const step of result.reasoningChain) {
    console.log(`[Step ${step.step}] ${step.title}`);
    console.log(`  Summary: ${step.summary}`);
    console.log(`  Timestamp: ${step.timestamp}`);
    console.log('');
  }

  // Print synthesis
  console.log('--- SYNTHESIS ---\n');
  const s = result.synthesis;
  console.log(`Overall Risk Score: ${s.overallRiskScore}/100`);
  console.log(`\nConditions found: ${s.conditions?.length || 0}`);
  if (s.conditions) {
    s.conditions.forEach(c => console.log(`  - ${c.name} (confidence: ${c.confidence}%, severity: ${c.severity})`));
  }
  console.log(`\nTrends: ${s.trends?.length || 0}`);
  if (s.trends) {
    s.trends.forEach(t => console.log(`  - ${t.biomarker}: ${t.direction} ${t.concern ? '[CONCERN]' : ''}`));
  }
  console.log(`\nDrug Interactions: ${s.drugInteractions?.length || 0}`);
  if (s.drugInteractions) {
    s.drugInteractions.forEach(d => console.log(`  - ${d.drugs?.join(' + ') || d.description || JSON.stringify(d)}`));
  }
  console.log(`\nRisk Factors: ${s.riskFactors?.length || 0}`);
  if (s.riskFactors) {
    s.riskFactors.forEach(r => console.log(`  - [${r.source}] ${r.factor} (${r.severity})`));
  }
  console.log(`\nRecommendations: ${s.recommendations?.length || 0}`);
  if (s.recommendations) {
    s.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  }
  console.log(`\nAttestable Claims (onchain-ready): ${s.attestableClaims?.length || 0}`);
  if (s.attestableClaims) {
    s.attestableClaims.forEach(a => console.log(`  - [${a.conditionCode}] ${a.conditionName} (confidence: ${a.confidence}%, severity: ${a.severity})`));
  }

  console.log(`\n--- METADATA ---`);
  console.log(`Documents analyzed: ${result.documentsAnalyzed}`);
  console.log(`Family history included: ${result.familyHistoryIncluded}`);
  console.log(`Reasoning steps: ${result.reasoningChain.length}`);
  console.log(`\nBodhi analysis complete!`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
