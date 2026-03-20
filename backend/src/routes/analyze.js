const express = require('express');
const multer = require('multer');
const drishti = require('../agents/drishti');
const bodhi = require('../agents/bodhi');
const { updateAgent } = require('./agents');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

router.post('/document', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'no_file', message: 'No file uploaded' });
  }

  if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'invalid_type', message: `Unsupported file type: ${req.file.mimetype}` });
  }

  const documentType = req.body.documentType || 'auto';
  const result = await drishti.analyze(req.file.buffer, {
    mimeType: req.file.mimetype,
    documentType,
  });

  if (result.error) {
    return res.status(422).json(result);
  }

  res.json({ success: true, data: result });
});

router.post('/batch', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'no_files', message: 'No files uploaded' });
  }

  const results = [];
  for (const file of req.files) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      results.push({ filename: file.originalname, error: 'invalid_type', message: `Unsupported: ${file.mimetype}` });
      continue;
    }

    const result = await drishti.analyze(file.buffer, { mimeType: file.mimetype });
    results.push({ filename: file.originalname, ...result });
  }

  res.json({ success: true, count: results.length, data: results });
});

router.post('/comprehensive', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'no_files', message: 'No files uploaded' });
  }

  // Parse optional family history from request body
  let familyHistory = null;
  if (req.body.familyHistory) {
    try {
      familyHistory = typeof req.body.familyHistory === 'string'
        ? JSON.parse(req.body.familyHistory)
        : req.body.familyHistory;
    } catch {
      return res.status(400).json({ error: 'invalid_family_history', message: 'familyHistory must be valid JSON' });
    }
  }

  // Step 1: Run Drishti on each file
  const extractions = [];
  for (const file of req.files) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      extractions.push({ filename: file.originalname, error: 'invalid_type', message: `Unsupported: ${file.mimetype}` });
      continue;
    }

    updateAgent('DRISHTI', { status: 'processing', currentFile: file.originalname });
    const result = await drishti.analyze(file.buffer, { mimeType: file.mimetype });
    extractions.push({ filename: file.originalname, ...result });
    updateAgent('DRISHTI', { status: 'idle', documentsProcessed: extractions.filter(e => !e.error).length });
  }

  // Filter out failed extractions for Bodhi
  const validExtractions = extractions.filter(e => !e.error);

  if (validExtractions.length === 0) {
    updateAgent('DRISHTI', { status: 'idle' });
    return res.status(422).json({
      error: 'no_valid_extractions',
      message: 'None of the uploaded files could be processed',
      extractions,
    });
  }

  // Step 2: Run Bodhi on all valid extractions
  updateAgent('BODHI', { status: 'analyzing', currentStep: 1 });
  const bodhiResult = await bodhi.analyze(validExtractions, familyHistory);
  updateAgent('BODHI', { status: 'idle', analysesCompleted: 1 });

  // Step 3: Mark Mudra as ready (attestation prep happens client-side via /attestation/prepare)
  if (bodhiResult.success && bodhiResult.synthesis) {
    updateAgent('MUDRA', { status: 'ready', attestationsGenerated: 0 });
  }

  res.json({
    success: true,
    extractions,
    analysis: bodhiResult,
  });
});

// Health Watch — real Venice-powered predictive alert
router.post('/health-watch', async (req, res) => {
  const { synthesis } = req.body;
  if (!synthesis) {
    return res.status(400).json({ error: 'missing_input', message: 'synthesis data is required' });
  }

  updateAgent('BODHI', { status: 'predicting', watchActive: true });

  try {
    const prediction = await bodhi.predictiveAlert(synthesis);
    updateAgent('BODHI', { status: 'watching', watchActive: true });
    res.json({ success: true, data: prediction });
  } catch (err) {
    updateAgent('BODHI', { status: 'idle', watchActive: false });
    res.status(500).json({ error: 'prediction_failed', message: err.message });
  }
});

module.exports = router;
