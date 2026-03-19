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

  // Parallel processing
  const results = await drishti.analyzeParallel(req.files);
  res.json({ success: true, count: results.length, data: results });
});

// Original comprehensive endpoint (non-streaming fallback)
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

  // Parallel Drishti processing
  const extractions = await drishti.analyzeParallel(req.files);
  const validExtractions = extractions.filter(e => !e.error);

  if (validExtractions.length === 0) {
    return res.status(422).json({
      error: 'no_valid_extractions',
      message: 'None of the uploaded files could be processed',
      extractions,
    });
  }

  const bodhiResult = await bodhi.analyze(validExtractions, familyHistory);

  // Also run Mudra if Bodhi succeeded
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

// SSE streaming endpoint for real-time analysis updates
router.post('/stream', upload.array('files', 10), async (req, res) => {
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

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  function sendEvent(type, data) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // Phase 1: Drishti — parallel document processing with progress callbacks
    sendEvent('drishti_start', { total: req.files.length });

    const extractions = await drishti.analyzeParallel(req.files, (progress) => {
      sendEvent('drishti_progress', progress);
    });

    const validExtractions = extractions.filter(e => !e.error);
    sendEvent('drishti_complete', {
      total: extractions.length,
      successful: validExtractions.length,
      extractions,
    });

    if (validExtractions.length === 0) {
      sendEvent('error', { message: 'None of the uploaded files could be processed' });
      sendEvent('done', {});
      res.end();
      return;
    }

    // Phase 2: Bodhi — with step-by-step progress
    sendEvent('bodhi_start', {});

    const bodhiResult = await bodhi.analyze(validExtractions, familyHistory, (step) => {
      sendEvent('bodhi_step', {
        step: step.step,
        title: step.title,
        summary: step.summary,
        timestamp: step.timestamp,
      });
    });

    sendEvent('bodhi_complete', {
      success: bodhiResult.success,
      synthesis: bodhiResult.synthesis,
      reasoningChain: (bodhiResult.reasoningChain || []).map(s => ({
        step: s.step,
        title: s.title,
        summary: s.summary,
        timestamp: s.timestamp,
      })),
    });

    // Phase 3: Mudra — attestation preparation
    let mudraResult = null;
    if (bodhiResult.success && bodhiResult.synthesis) {
      sendEvent('mudra_start', {});
      mudraResult = await mudra.prepare(bodhiResult);
      sendEvent('mudra_complete', mudraResult);
    }

    // All done
    sendEvent('done', {
      extractions,
      analysis: bodhiResult,
      mudra: mudraResult,
    });
  } catch (err) {
    sendEvent('error', { message: err.message });
  }

  res.end();
});

module.exports = router;
