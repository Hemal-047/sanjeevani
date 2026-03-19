require('dotenv').config();
const mudra = require('./src/agents/mudra');

// Mock Bodhi output based on our earlier test (pre-diabetes + dyslipidemia)
const MOCK_BODHI_OUTPUT = {
  success: true,
  synthesis: {
    overallRiskScore: 80,
    conditions: [
      { name: 'Pre-diabetes', confidence: 90, severity: 'high', evidence: 'Fasting glucose rose from 110 to 126 mg/dL; HbA1c rose from 5.9% to 6.4% over 6 months' },
      { name: 'Dyslipidemia', confidence: 95, severity: 'high', evidence: 'Total cholesterol 225, LDL 148, HDL 39 (low), triglycerides 205 — all outside normal range' },
      { name: 'Early nephropathy', confidence: 80, severity: 'moderate', evidence: 'Microalbumin at 25 mg/L (above 20 threshold), new finding in latest report' },
    ],
    trends: [
      { biomarker: 'Fasting Glucose', direction: 'rising', values: ['110', '126'], dates: ['2024-06-15', '2024-12-15'], concern: true },
      { biomarker: 'HbA1c', direction: 'rising', values: ['5.9', '6.4'], dates: ['2024-06-15', '2024-12-15'], concern: true },
      { biomarker: 'Total Cholesterol', direction: 'rising', values: ['210', '225'], dates: ['2024-06-15', '2024-12-15'], concern: true },
      { biomarker: 'LDL Cholesterol', direction: 'rising', values: ['140', '148'], dates: ['2024-06-15', '2024-12-15'], concern: true },
      { biomarker: 'HDL Cholesterol', direction: 'falling', values: ['42', '39'], dates: ['2024-06-15', '2024-12-15'], concern: true },
      { biomarker: 'Triglycerides', direction: 'rising', values: ['180', '205'], dates: ['2024-06-15', '2024-12-15'], concern: true },
    ],
    drugInteractions: [],
    riskFactors: [
      { factor: 'Family history of Type 2 Diabetes (father, onset 52)', source: 'family', severity: 'high' },
      { factor: 'Family history of Coronary Artery Disease (father)', source: 'family', severity: 'high' },
    ],
    recommendations: [
      'Urgent follow-up for glucose management — patient at diabetic threshold',
      'Initiate or intensify statin therapy for dyslipidemia',
      'Monitor kidney function — repeat microalbumin in 3 months',
    ],
    attestableClaims: [
      { conditionCode: 'R73.03', conditionName: 'Pre-diabetes', confidence: 90, severity: 'high', evidenceHash: 'sha256:glucose_trend_hba1c_trend' },
      { conditionCode: 'E78.5', conditionName: 'Dyslipidemia', confidence: 95, severity: 'high', evidenceHash: 'sha256:lipid_panel_abnormal' },
    ],
  },
  reasoningChain: [
    { step: 1, title: 'Timeline Build', summary: 'Organized 2 lab reports chronologically (Jun-Dec 2024)', details: '...', timestamp: '2024-12-20T10:00:00Z' },
    { step: 2, title: 'Trend Analysis', summary: 'All metabolic markers trending adversely', details: '...', timestamp: '2024-12-20T10:01:00Z' },
    { step: 3, title: 'Family Risk Overlay', summary: 'Father had T2DM at 52 — patient showing same trajectory at 42', details: '...', timestamp: '2024-12-20T10:02:00Z' },
    { step: 4, title: 'Drug Interaction Check', summary: 'No significant interactions between Metformin and Atorvastatin', details: '...', timestamp: '2024-12-20T10:03:00Z' },
    { step: 5, title: 'Synthesis', summary: 'High risk profile with 2 attestable claims', details: '...', timestamp: '2024-12-20T10:04:00Z' },
  ],
  documentsAnalyzed: 2,
  familyHistoryIncluded: true,
};

async function main() {
  console.log('=== MUDRA ATTESTATION PREPARATION AGENT TEST ===\n');
  console.log('Feeding Mudra mock Bodhi output (pre-diabetes + dyslipidemia)...\n');

  const result = await mudra.prepare(MOCK_BODHI_OUTPUT);

  if (result.error) {
    console.error('Mudra failed:', result.error, result.message);
    process.exit(1);
  }

  console.log('--- PREPARED ATTESTATIONS ---\n');
  for (const a of result.attestations) {
    console.log(`  Condition: ${a.conditionName}`);
    console.log(`  ICD-10 Code: ${a.conditionCode}`);
    console.log(`  Bytes32: ${a.conditionCodeBytes32}`);
    console.log(`  Severity: ${a.severityLabel} (${a.severity})`);
    console.log(`  Confidence: ${a.confidence}%`);
    console.log(`  Evidence Hash: ${a.evidenceHash}`);
    console.log(`  Evidence: ${a.evidenceSummary}`);
    console.log(`  Validation: ${a.validationReason}`);
    console.log('');
  }

  console.log('--- CONSENT SUMMARY ---\n');
  console.log(result.consentSummary);

  console.log('\n--- METADATA ---');
  console.log(`Total claims from Bodhi: ${result.totalClaims}`);
  console.log(`Approved for attestation: ${result.approvedCount}`);
  console.log(`Rejected: ${result.rejectedCount}`);
  console.log(`Validation notes: ${result.validationNotes}`);
  console.log(`\nMudra test complete!`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
