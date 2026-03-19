const express = require('express');
const mudra = require('../agents/mudra');

const router = express.Router();

router.post('/prepare', async (req, res) => {
  const { bodhiOutput } = req.body;

  if (!bodhiOutput) {
    return res.status(400).json({ error: 'missing_input', message: 'bodhiOutput is required' });
  }

  const result = await mudra.prepare(bodhiOutput);

  if (result.error) {
    return res.status(422).json(result);
  }

  res.json({ success: true, data: result });
});

module.exports = router;
