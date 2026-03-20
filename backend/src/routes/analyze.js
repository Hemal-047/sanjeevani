const express = require('express');
const multer = require('multer');
const drishti = require('../agents/drishti');
const bodhi = require('../agents/bodhi');
const mudra = require('../agents/mudra');

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

  const results = await drishti.analyzeParallel(req.files);
  res.json({ success: true, count: results.length, data: results });
});

// Comprehensive analysis: sequential Drishti (batches of 2) → Bodhi (3-step) → Mudra
router.post('/comprehensive', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'no_files', message: 'No files uploaded' });
  }

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

  // Sequential Drishti processing (batches of 2 with 1s delay between batches)
  const extractions = await drishti.analyzeParallel(req.files);
  const validExtractions = extractions.filter(e => !e.error);

  if (validExtractions.length === 0) {
    return res.status(422).json({
      error: 'no_valid_extractions',
      message: 'None of the uploaded files could be processed',
      extractions,
    });
  }

  // Bodhi analysis (optimized 3-step chain, compressed payloads)
  const bodhiResult = await bodhi.analyze(validExtractions, familyHistory);

  // Mudra attestation preparation
  let mudraResult = null;
  if (bodhiResult.success && bodhiResult.synthesis) {
    mudraResult = await mudra.prepare(bodhiResult);
  }

  res.json({
    success: true,
    extractions,
    analysis: bodhiResult,
    mudra: mudraResult,
  });
});

module.exports = router;
