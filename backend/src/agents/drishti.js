const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const { chatCompletion, visionCompletion } = require('../utils/veniceClient');

const EXTRACTION_PROMPT = `You are Drishti, a medical document intelligence agent. Analyze the provided health document and extract structured data.

Return ONLY valid JSON (no markdown, no code fences) with this exact schema:
{
  "documentType": "lab_report" | "prescription" | "discharge_summary" | "scan_report",
  "patientAge": <number or null if not found>,
  "date": "<date string or null if not found>",
  "findings": [
    {
      "testName": "<string>",
      "value": "<string>",
      "unit": "<string>",
      "referenceRange": "<string or null>",
      "status": "normal" | "high" | "low" | "critical"
    }
  ],
  "medications": [
    {
      "name": "<string>",
      "dosage": "<string>",
      "frequency": "<string>",
      "duration": "<string or null>"
    }
  ],
  "diagnoses": ["<string>"],
  "rawSummary": "<brief text summary of the document>",
  "confidence": <0-100>
}

Rules:
- Only include fields that are present in the document. Use empty arrays for missing sections.
- Set status based on reference ranges when available.
- confidence reflects how complete and reliable the extraction is.
- If the document is unclear or partially readable, still extract what you can and lower the confidence score.`;

async function analyzePDF(fileBuffer) {
  const { text } = await pdfParse(fileBuffer);

  if (!text || text.trim().length === 0) {
    return { error: 'no_text_extracted', message: 'PDF contained no extractable text. Try uploading as an image.' };
  }

  const messages = [
    { role: 'system', content: EXTRACTION_PROMPT },
    { role: 'user', content: `Extract structured health data from this document:\n\n${text}` },
  ];

  const raw = await chatCompletion(messages);
  return parseResponse(raw);
}

async function analyzeImage(fileBuffer, mimeType) {
  const processed = await sharp(fileBuffer).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).toBuffer();
  const base64 = processed.toString('base64');
  const prompt = `${EXTRACTION_PROMPT}\n\nExtract structured health data from this medical document image.`;
  const raw = await visionCompletion(base64, mimeType, prompt);
  return parseResponse(raw);
}

function parseResponse(raw) {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      error: 'parse_failure',
      message: 'Failed to parse structured data from Venice response',
      rawResponse: raw,
    };
  }
}

async function analyze(fileBuffer, { mimeType = 'application/pdf', documentType = 'auto' } = {}) {
  try {
    let result;
    if (mimeType === 'application/pdf') {
      result = await analyzePDF(fileBuffer);
    } else if (mimeType.startsWith('image/')) {
      result = await analyzeImage(fileBuffer, mimeType);
    } else {
      return { error: 'unsupported_type', message: `Unsupported file type: ${mimeType}` };
    }

    if (!result.error && documentType !== 'auto') {
      result.documentType = documentType;
    }

    return result;
  } catch (err) {
    return {
      error: 'analysis_failed',
      message: err.message,
    };
  }
}

// Process multiple files in parallel
async function analyzeParallel(files, onProgress) {
  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

  const promises = files.map(async (file, index) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      const result = { filename: file.originalname, error: 'invalid_type', message: `Unsupported: ${file.mimetype}` };
      if (onProgress) onProgress({ index, filename: file.originalname, status: 'error', result });
      return result;
    }

    if (onProgress) onProgress({ index, filename: file.originalname, status: 'processing' });

    const result = await analyze(file.buffer, { mimeType: file.mimetype });
    const output = { filename: file.originalname, ...result };

    if (onProgress) onProgress({ index, filename: file.originalname, status: result.error ? 'error' : 'complete', result: output });

    return output;
  });

  return Promise.all(promises);
}

module.exports = { analyze, analyzeParallel };
