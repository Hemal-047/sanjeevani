require('dotenv').config();
const { chatCompletion } = require('./src/utils/veniceClient');

const SAMPLE_LAB_REPORT = `
PATHOLOGY LAB REPORT
Date: 2024-12-15
Patient Age: 45 years

Complete Blood Count (CBC):
- Hemoglobin: 11.2 g/dL (Ref: 13.0-17.0) LOW
- WBC Count: 8,500 /cumm (Ref: 4,000-11,000) NORMAL
- Platelet Count: 1,50,000 /cumm (Ref: 1,50,000-4,00,000) NORMAL
- RBC Count: 4.2 million/cumm (Ref: 4.5-5.5) LOW

Liver Function Test:
- SGPT (ALT): 78 U/L (Ref: 7-56) HIGH
- SGOT (AST): 65 U/L (Ref: 10-40) HIGH
- Bilirubin Total: 1.1 mg/dL (Ref: 0.1-1.2) NORMAL
- Albumin: 3.8 g/dL (Ref: 3.5-5.5) NORMAL

Diagnosis: Mild anemia, Elevated liver enzymes - recommend follow-up

Medications Prescribed:
1. Ferrous Sulfate 325mg - Once daily - 3 months
2. Ursodeoxycholic Acid 300mg - Twice daily - 1 month
`;

const EXTRACTION_PROMPT = `You are Drishti, a medical document intelligence agent. Analyze the provided health document and extract structured data.

Return ONLY valid JSON (no markdown, no code fences) with this exact schema:
{
  "documentType": "lab_report" | "prescription" | "discharge_summary" | "scan_report",
  "patientAge": <number or null>,
  "date": "<date string or null>",
  "findings": [{"testName":"","value":"","unit":"","referenceRange":"","status":"normal|high|low|critical"}],
  "medications": [{"name":"","dosage":"","frequency":"","duration":""}],
  "diagnoses": ["<string>"],
  "rawSummary": "<brief summary>",
  "confidence": <0-100>
}`;

async function main() {
  console.log('Testing Venice API connection with sample lab report...\n');

  const messages = [
    { role: 'system', content: EXTRACTION_PROMPT },
    { role: 'user', content: `Extract structured health data from this document:\n\n${SAMPLE_LAB_REPORT}` },
  ];

  const raw = await chatCompletion(messages);
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const result = JSON.parse(cleaned);

  console.log('Result:');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nVenice API connection successful!');
  console.log(`Document type: ${result.documentType}`);
  console.log(`Confidence: ${result.confidence}%`);
  console.log(`Findings: ${result.findings?.length || 0}`);
  console.log(`Medications: ${result.medications?.length || 0}`);
  console.log(`Diagnoses: ${result.diagnoses?.length || 0}`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
