require('dotenv').config();
const setu = require('./src/agents/setu');

// Mock patient attestations (from Mudra output)
const PATIENT_ATTESTATIONS = [
  {
    attestationId: 1,
    conditionCode: 'R73.03',
    conditionName: 'Pre-diabetes',
    severity: 'high',
    confidence: 90,
    evidenceSummary: 'Fasting glucose rose from 110 to 126 mg/dL; HbA1c rose from 5.9% to 6.4% over 6 months',
    patientAge: 42,
  },
  {
    attestationId: 2,
    conditionCode: 'E78.5',
    conditionName: 'Dyslipidemia',
    severity: 'high',
    confidence: 95,
    evidenceSummary: 'Total cholesterol 225, LDL 148, HDL 39 (low), triglycerides 205',
    patientAge: 42,
  },
];

// Researcher search criteria
const RESEARCHER_CRITERIA = {
  conditions: ['Type 2 Diabetes', 'Pre-diabetes', 'Metabolic Syndrome'],
  severityMin: 2,
  confidenceMin: 80,
  ageRange: [30, 55],
  additionalRequirements: 'Looking for patients with progressive glycemic deterioration for a 12-week SGLT2 inhibitor clinical trial. Prefer patients with comorbid dyslipidemia.',
};

// Simulated available attestations (from multiple patients on-chain)
const AVAILABLE_ATTESTATIONS = [
  ...PATIENT_ATTESTATIONS,
  {
    attestationId: 3,
    conditionCode: 'E11',
    conditionName: 'Type 2 Diabetes',
    severity: 'high',
    confidence: 95,
    evidenceSummary: 'HbA1c 7.8%, on metformin + glipizide for 2 years',
    patientAge: 51,
  },
  {
    attestationId: 4,
    conditionCode: 'I10',
    conditionName: 'Essential Hypertension',
    severity: 'moderate',
    confidence: 88,
    evidenceSummary: 'BP consistently 145/92, on amlodipine 5mg',
    patientAge: 60,
  },
  {
    attestationId: 5,
    conditionCode: 'R73.03',
    conditionName: 'Pre-diabetes',
    severity: 'moderate',
    confidence: 75,
    evidenceSummary: 'Fasting glucose 108 mg/dL, single measurement',
    patientAge: 38,
  },
];

async function main() {
  console.log('=== SETU MARKETPLACE & MATCHING AGENT TEST ===\n');

  // MODE 1 — Patient Profile
  console.log('--- MODE 1: PATIENT PROFILE ---\n');
  console.log('Generating research matchability profile for pre-diabetes patient...\n');

  const profile = await setu.patientProfile(PATIENT_ATTESTATIONS);

  if (profile.error) {
    console.error('Patient profile failed:', profile.error, profile.message);
  } else {
    console.log(`Data Value: ${profile.estimatedDataValue}`);
    console.log(`Patient Summary: ${profile.patientSummary}`);
    console.log(`\nMatchable Study Types:`);
    (profile.matchableStudyTypes || []).forEach(s => console.log(`  - ${s}`));
    console.log(`\nSuggested Data Packages:`);
    (profile.suggestedDataPackages || []).forEach(p => {
      console.log(`  ${p.name} (${p.estimatedPrice})`);
      console.log(`    ${p.description}`);
      console.log(`    Data points: ${(p.dataPoints || []).join(', ')}`);
    });
  }

  console.log('\n\n--- MODE 2: RESEARCHER SEARCH ---\n');
  console.log('Searching for diabetes/pre-diabetes patients for SGLT2 trial...\n');

  const results = await setu.researcherSearch(RESEARCHER_CRITERIA, AVAILABLE_ATTESTATIONS);

  if (results.error) {
    console.error('Researcher search failed:', results.error, results.message);
  } else {
    console.log(`Search Summary: ${results.searchSummary}`);
    console.log(`Total Matches (score > 50): ${results.totalMatches}\n`);
    console.log('Ranked Matches:');
    (results.matches || []).forEach((m, i) => {
      console.log(`\n  #${i + 1} — Attestation ${m.attestationId} (Score: ${m.matchScore}/100)`);
      console.log(`  Reasons: ${(m.matchReasons || []).join('; ')}`);
      if (m.gaps && m.gaps.length > 0) {
        console.log(`  Gaps: ${m.gaps.join('; ')}`);
      }
    });
  }

  console.log('\n\nSetu test complete!');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
