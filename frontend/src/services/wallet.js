import { BrowserProvider, Contract, parseEther } from 'ethers';
import HealthAttestationABI from '../contracts/HealthAttestation.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
const BASE_SEPOLIA_CHAIN_ID = '0x14A34'; // 84532
const BASE_SEPOLIA_NETWORK = { chainId: 84532, name: 'base-sepolia' };
const BASESCAN_TX_URL = 'https://sepolia.basescan.org/tx/';

export function truncateAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function txLink(hash) {
  return `${BASESCAN_TX_URL}${hash}`;
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No wallet found — install MetaMask, Coinbase Wallet, or any EIP-1193 compatible browser wallet');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export async function switchToBaseSepolia() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_SEPOLIA_CHAIN_ID,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
    } else {
      throw err;
    }
  }
}

async function ensureNetwork() {
  if (!window.ethereum) return;
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId.toLowerCase() !== BASE_SEPOLIA_CHAIN_ID.toLowerCase()) {
    await switchToBaseSepolia();
    // Wait for wallet to settle after network switch
    await new Promise(r => setTimeout(r, 500));
  }
}

function ensureContractAddress() {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract not yet deployed. Deploy to Base Sepolia to enable onchain attestations.');
  }
}

// Create BrowserProvider with explicit network to prevent chain ID mismatch
function createProvider() {
  return new BrowserProvider(window.ethereum, BASE_SEPOLIA_NETWORK);
}

export async function getContract() {
  ensureContractAddress();
  await ensureNetwork();
  const provider = createProvider();
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, HealthAttestationABI.abi || HealthAttestationABI, signer);
}

export async function getReadOnlyContract() {
  ensureContractAddress();
  await ensureNetwork();
  const provider = createProvider();
  return new Contract(CONTRACT_ADDRESS, HealthAttestationABI.abi || HealthAttestationABI, provider);
}

export async function publishAttestation(conditionCodeBytes32, conditionName, severity, confidence, evidenceHash) {
  try {
    const contract = await getContract();
    const tx = await contract.publishAttestation(conditionCodeBytes32, conditionName, severity, confidence, evidenceHash);
    const receipt = await tx.wait();
    return { tx, receipt, txUrl: txLink(tx.hash) };
  } catch (err) {
    console.error('[publishAttestation] Error:', err);
    if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    if (err.message?.includes('insufficient funds')) {
      throw new Error('Insufficient ETH for gas. Get Base Sepolia ETH from a faucet.');
    }
    throw new Error(err.reason || err.shortMessage || err.message || 'Transaction failed');
  }
}

export async function revokeAttestation(attestationId) {
  try {
    const contract = await getContract();
    const tx = await contract.revokeAttestation(attestationId);
    const receipt = await tx.wait();
    return { tx, receipt, txUrl: txLink(tx.hash) };
  } catch (err) {
    throw new Error(err.reason || err.shortMessage || err.message || 'Revoke failed');
  }
}

export async function getPatientAttestations(address) {
  try {
    const contract = await getReadOnlyContract();
    const ids = await contract.getPatientAttestations(address);
    const attestations = [];
    for (const id of ids) {
      const a = await contract.getAttestation(id);
      if (a.active) {
        attestations.push({
          id: Number(id),
          patient: a.patient,
          conditionCode: a.conditionCode,
          conditionName: a.conditionName,
          severity: Number(a.severity),
          confidence: Number(a.confidence),
          evidenceHash: a.evidenceHash,
          timestamp: Number(a.timestamp),
          active: a.active,
        });
      }
    }
    return attestations;
  } catch {
    return [];
  }
}

export async function sendTrialInvitation(attestationId, studyName, description, compensationEth) {
  try {
    const contract = await getContract();
    const tx = await contract.sendTrialInvitation(attestationId, studyName, description, {
      value: parseEther(compensationEth),
    });
    const receipt = await tx.wait();
    return { tx, receipt, txUrl: txLink(tx.hash) };
  } catch (err) {
    if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    if (err.message?.includes('insufficient funds')) {
      throw new Error('Insufficient ETH. Get Base Sepolia ETH from a faucet.');
    }
    throw new Error(err.reason || err.shortMessage || err.message || 'Invitation failed');
  }
}

export async function requestDataPurchase(attestationId, dataRequested, priceEth) {
  try {
    const contract = await getContract();
    const tx = await contract.requestDataPurchase(attestationId, dataRequested, {
      value: parseEther(priceEth),
    });
    const receipt = await tx.wait();
    return { tx, receipt, txUrl: txLink(tx.hash) };
  } catch (err) {
    if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(err.reason || err.shortMessage || err.message || 'Purchase request failed');
  }
}

export async function queryByCondition(conditionCodeBytes32) {
  try {
    const contract = await getReadOnlyContract();
    const ids = await contract.queryByCondition(conditionCodeBytes32);
    const attestations = [];
    for (const id of ids) {
      const a = await contract.getAttestation(id);
      if (a.active) {
        attestations.push({
          id: Number(id),
          patient: a.patient,
          conditionName: a.conditionName,
          severity: Number(a.severity),
          confidence: Number(a.confidence),
          timestamp: Number(a.timestamp),
        });
      }
    }
    return attestations;
  } catch {
    return [];
  }
}
