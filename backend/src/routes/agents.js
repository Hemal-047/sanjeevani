const express = require('express');
const router = express.Router();

// In-memory agent state tracking
const agentState = {
  DRISHTI: { status: 'idle', lastActive: null, documentsProcessed: 0 },
  BODHI: { status: 'idle', lastActive: null, analysesCompleted: 0, watchActive: false },
  MUDRA: { status: 'idle', lastActive: null, attestationsGenerated: 0 },
  SETU: { status: 'idle', lastActive: null, matchesFound: 0, autoMatchActive: false },
};

// Update agent state (called internally by other routes)
function updateAgent(name, updates) {
  if (agentState[name]) {
    Object.assign(agentState[name], updates, { lastActive: new Date().toISOString() });
  }
}

// GET /api/agents/status — returns status of all agents
router.get('/status', (req, res) => {
  const agents = Object.entries(agentState).map(([name, state]) => ({
    name,
    ...state,
    uptime: state.lastActive
      ? `${Math.round((Date.now() - new Date(state.lastActive).getTime()) / 1000)}s ago`
      : 'never',
  }));
  res.json({ success: true, agents, timestamp: new Date().toISOString() });
});

// GET /api/agents/:name/query — query a specific agent
router.get('/:name/query', (req, res) => {
  const name = req.params.name.toUpperCase();
  const state = agentState[name];
  if (!state) {
    return res.status(404).json({ error: 'agent_not_found', message: `Agent ${name} does not exist` });
  }

  const capabilities = {
    DRISHTI: {
      role: 'Document Intelligence',
      accepts: ['pdf', 'png', 'jpg', 'webp'],
      model: 'qwen3-vl-235b-a22b',
      description: 'Extracts structured health data from medical documents using vision AI',
    },
    BODHI: {
      role: 'Cross-Reference & Discovery',
      accepts: ['extractions'],
      model: 'llama-3.3-70b',
      description: '5-step reasoning chain: Timeline → Trends → Family Risk → Drug Interactions → Synthesis',
      watchCapable: true,
    },
    MUDRA: {
      role: 'Attestation Generation',
      accepts: ['analysis'],
      model: 'llama-3.3-70b',
      description: 'Maps findings to ICD-10 codes, generates evidence hashes, prepares onchain attestations',
    },
    SETU: {
      role: 'Marketplace Matching',
      accepts: ['attestations', 'criteria'],
      model: 'llama-3.3-70b',
      description: 'Bridges users to researchers via matchability profiling and ranked search',
      autoMatchCapable: true,
    },
  };

  res.json({
    success: true,
    agent: {
      name,
      ...state,
      ...capabilities[name],
    },
  });
});

module.exports = router;
module.exports.updateAgent = updateAgent;
module.exports.agentState = agentState;
