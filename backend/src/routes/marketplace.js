const express = require('express');
const setu = require('../agents/setu');

const router = express.Router();

// In-memory stores (will connect to smart contract later)
const trialInvitations = [];
const purchaseRequests = [];

// Auto-match state
let autoMatchConfig = null;
let autoMatchResults = [];

// POST /auto-match — configure and trigger auto-match
router.post('/auto-match', async (req, res) => {
  const { criteria, attestations, enabled } = req.body;

  if (enabled === false) {
    autoMatchConfig = null;
    autoMatchResults = [];
    return res.json({ success: true, status: 'disabled', matches: [] });
  }

  if (!criteria || !attestations || attestations.length === 0) {
    return res.status(400).json({ error: 'missing_input', message: 'criteria and attestations are required' });
  }

  autoMatchConfig = { criteria, attestations, lastRun: new Date().toISOString() };

  try {
    const result = await setu.researcherSearch(criteria, attestations);
    autoMatchResults = result.matches || [];
    autoMatchConfig.lastRun = new Date().toISOString();
    res.json({
      success: true,
      status: 'active',
      matches: autoMatchResults,
      totalMatches: autoMatchResults.length,
      lastRun: autoMatchConfig.lastRun,
      searchSummary: result.searchSummary || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'auto_match_failed', message: err.message });
  }
});

// GET /auto-match/status — check auto-match state
router.get('/auto-match/status', (req, res) => {
  res.json({
    success: true,
    active: !!autoMatchConfig,
    lastRun: autoMatchConfig?.lastRun || null,
    matchCount: autoMatchResults.length,
  });
});

router.post('/patient-profile', async (req, res) => {
  const { attestations } = req.body;

  if (!attestations || attestations.length === 0) {
    return res.status(400).json({ error: 'missing_input', message: 'attestations array is required' });
  }

  const result = await setu.patientProfile(attestations);

  if (result.error) {
    return res.status(422).json(result);
  }

  res.json({ success: true, data: result });
});

router.post('/search', async (req, res) => {
  const { criteria, attestations } = req.body;

  if (!criteria) {
    return res.status(400).json({ error: 'missing_input', message: 'criteria object is required' });
  }
  if (!attestations || attestations.length === 0) {
    return res.status(400).json({ error: 'missing_input', message: 'attestations array is required' });
  }

  const result = await setu.researcherSearch(criteria, attestations);

  if (result.error) {
    return res.status(422).json(result);
  }

  res.json({ success: true, data: result });
});

router.post('/invite', (req, res) => {
  const { researcher, patientAddress, attestationId, studyName, description, compensation } = req.body;

  if (!researcher || !patientAddress || !attestationId || !studyName) {
    return res.status(400).json({ error: 'missing_fields', message: 'researcher, patientAddress, attestationId, and studyName are required' });
  }

  const invitation = {
    id: trialInvitations.length + 1,
    researcher,
    patientAddress,
    attestationId,
    studyName,
    description: description || '',
    compensation: compensation || '0',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  trialInvitations.push(invitation);
  res.json({ success: true, data: invitation });
});

router.post('/purchase-request', (req, res) => {
  const { researcher, patientAddress, attestationId, dataRequested, priceOffered } = req.body;

  if (!researcher || !patientAddress || !attestationId || !dataRequested) {
    return res.status(400).json({ error: 'missing_fields', message: 'researcher, patientAddress, attestationId, and dataRequested are required' });
  }

  const request = {
    id: purchaseRequests.length + 1,
    researcher,
    patientAddress,
    attestationId,
    dataRequested,
    priceOffered: priceOffered || '0',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  purchaseRequests.push(request);
  res.json({ success: true, data: request });
});

module.exports = router;
