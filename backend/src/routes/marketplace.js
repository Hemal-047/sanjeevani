const express = require('express');
const setu = require('../agents/setu');
const { getAllAttestations } = require('../services/contractReader');
const { updateAgent } = require('./agents');

const router = express.Router();

// In-memory stores
const trialInvitations = [];
const purchaseRequests = [];

// Demo fallback attestations (used when contract has no data)
const DEMO_ATTESTATIONS = [
  { attestationId: 1, conditionCode: 'R73.03', conditionName: 'Pre-diabetes', severity: 3, confidence: 90, evidenceSummary: 'Fasting glucose 126, HbA1c 6.4%', source: 'demo' },
  { attestationId: 2, conditionCode: 'E78.5', conditionName: 'Dyslipidemia', severity: 3, confidence: 95, evidenceSummary: 'LDL 148, HDL 39, Triglycerides 205', source: 'demo' },
  { attestationId: 3, conditionCode: 'E11', conditionName: 'Type 2 Diabetes', severity: 3, confidence: 95, evidenceSummary: 'HbA1c 7.8%, on metformin + glipizide', source: 'demo' },
  { attestationId: 4, conditionCode: 'I10', conditionName: 'Essential Hypertension', severity: 2, confidence: 88, evidenceSummary: 'BP 145/92, on amlodipine', source: 'demo' },
  { attestationId: 5, conditionCode: 'R73.03', conditionName: 'Pre-diabetes', severity: 2, confidence: 75, evidenceSummary: 'Fasting glucose 108, single reading', source: 'demo' },
];

// Auto-match state
let autoMatchConfig = null;
let autoMatchResults = [];

// POST /auto-match — query real onchain attestations + Venice matching
router.post('/auto-match', async (req, res) => {
  const { criteria, enabled } = req.body;

  if (enabled === false) {
    autoMatchConfig = null;
    autoMatchResults = [];
    updateAgent('SETU', { status: 'idle', autoMatchActive: false });
    return res.json({ success: true, status: 'disabled', matches: [] });
  }

  if (!criteria) {
    return res.status(400).json({ error: 'missing_input', message: 'criteria is required' });
  }

  updateAgent('SETU', { status: 'scanning', autoMatchActive: true });

  // Fetch real onchain attestations
  let onchainAttestations = [];
  try {
    onchainAttestations = await getAllAttestations();
  } catch (err) {
    console.error('[auto-match] Contract read error:', err.message);
  }

  // Merge onchain with demo fallbacks (dedup by attestationId)
  const seenIds = new Set(onchainAttestations.map(a => a.attestationId));
  const allAttestations = [
    ...onchainAttestations,
    ...DEMO_ATTESTATIONS.filter(d => !seenIds.has(d.attestationId)),
  ];

  autoMatchConfig = { criteria, lastRun: new Date().toISOString() };

  try {
    const result = await setu.researcherSearch(criteria, allAttestations);
    autoMatchResults = result.matches || [];
    autoMatchConfig.lastRun = new Date().toISOString();
    updateAgent('SETU', { status: 'monitoring', autoMatchActive: true, matchesFound: autoMatchResults.length });
    res.json({
      success: true,
      status: 'active',
      matches: autoMatchResults,
      totalMatches: autoMatchResults.length,
      lastRun: autoMatchConfig.lastRun,
      searchSummary: result.searchSummary || null,
      onchainCount: onchainAttestations.length,
      demoCount: allAttestations.length - onchainAttestations.length,
    });
  } catch (err) {
    updateAgent('SETU', { status: 'error', autoMatchActive: false });
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
  const { criteria } = req.body;

  if (!criteria) {
    return res.status(400).json({ error: 'missing_input', message: 'criteria object is required' });
  }

  // Fetch real onchain attestations + demo fallbacks
  let onchainAttestations = [];
  try {
    onchainAttestations = await getAllAttestations();
  } catch (err) {
    console.error('[search] Contract read error:', err.message);
  }

  const seenIds = new Set(onchainAttestations.map(a => a.attestationId));
  const allAttestations = [
    ...onchainAttestations,
    ...DEMO_ATTESTATIONS.filter(d => !seenIds.has(d.attestationId)),
  ];

  if (allAttestations.length === 0) {
    return res.status(400).json({ error: 'no_attestations', message: 'No attestations available for search' });
  }

  updateAgent('SETU', { status: 'searching' });
  const result = await setu.researcherSearch(criteria, allAttestations);
  updateAgent('SETU', { status: 'idle' });

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
