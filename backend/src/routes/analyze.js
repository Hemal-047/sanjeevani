const express = require('express');
const multer = require('multer');
const drishti = require('../agents/drishti');

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

module.exports = router;
