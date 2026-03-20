// Contract Reader — reads HealthAttestation contract from Base Sepolia (read-only)
const { ethers } = require('ethers');
const abi = require('../contracts/HealthAttestation.json');

const RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xAB37D12B4f2e0f2C5e4B6aE44DdA173813917A17';

let provider = null;
let contract = null;

// Cache
let cachedAttestations = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

function getContract() {
  if (!contract) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT_ADDRESS, abi.abi || abi, provider);
  }
  return contract;
}

/**
 * Enumerate all attestations by scanning AttestationPublished events,
 * then fetching each attestation's current state.
 */
async function getAllAttestations() {
  const now = Date.now();
  if (cachedAttestations && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedAttestations;
  }

  const c = getContract();
  const attestations = [];

  try {
    // Query all AttestationPublished events from contract creation
    const filter = c.filters.AttestationPublished();
    const events = await c.queryFilter(filter, 0, 'latest');

    // Deduplicate attestation IDs
    const ids = [...new Set(events.map(e => Number(e.args[0])))];

    // Fetch current state for each
    for (const id of ids) {
      try {
        const a = await c.getAttestation(id);
        if (a.active) {
          attestations.push({
            attestationId: id,
            patient: a.patient,
            conditionCode: a.conditionCode,
            conditionName: a.conditionName,
            severity: Number(a.severity),
            confidence: Number(a.confidence),
            evidenceHash: a.evidenceHash,
            timestamp: Number(a.timestamp),
            active: a.active,
            source: 'onchain',
          });
        }
      } catch {
        // Skip individual attestation errors
      }
    }
  } catch (err) {
    console.error('[contractReader] Error fetching attestations:', err.message);
    // Return empty on RPC errors — caller merges with fallback data
  }

  cachedAttestations = attestations;
  cacheTimestamp = now;
  return attestations;
}

/**
 * Get attestations matching a specific condition code
 */
async function getAttestationsByCondition(conditionCodeBytes32) {
  const c = getContract();
  try {
    const ids = await c.queryByCondition(conditionCodeBytes32);
    const results = [];
    for (const id of ids) {
      const a = await c.getAttestation(id);
      if (a.active) {
        results.push({
          attestationId: Number(id),
          patient: a.patient,
          conditionCode: a.conditionCode,
          conditionName: a.conditionName,
          severity: Number(a.severity),
          confidence: Number(a.confidence),
          timestamp: Number(a.timestamp),
          source: 'onchain',
        });
      }
    }
    return results;
  } catch (err) {
    console.error('[contractReader] Condition query error:', err.message);
    return [];
  }
}

function invalidateCache() {
  cachedAttestations = null;
  cacheTimestamp = 0;
}

module.exports = { getAllAttestations, getAttestationsByCondition, invalidateCache };
