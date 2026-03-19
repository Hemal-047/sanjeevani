import { BrowserProvider, Contract, parseEther } from 'ethers';
import HealthAttestationABI from '../contracts/HealthAttestation.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

export function truncateAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No wallet found — install MetaMask, Coinbase Wallet, or any EIP-1193 compatible browser wallet');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export async function getProvider() {
  if (!window.ethereum) throw new Error('No wallet found — install MetaMask, Coinbase Wallet, or any EIP-1193 compatible browser wallet');
  return new BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

function ensureContractAddress() {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract not yet deployed. Deploy to Base Sepolia to enable onchain attestations.');
  }
}

export async function getContract() {
  ensureContractAddress();
  const signer = await getSigner();
  return new Contract(CONTRACT_ADDRESS, HealthAttestationABI.abi || HealthAttestationABI, signer);
}

export async function publishAttestation(conditionCodeBytes32, conditionName, severity, confidence, evidenceHash) {
  const contract = await getContract();
  const tx = await contract.publishAttestation(conditionCodeBytes32, conditionName, severity, confidence, evidenceHash);
  const receipt = await tx.wait();
  return { tx, receipt };
}

export async function revokeAttestation(attestationId) {
  const contract = await getContract();
  const tx = await contract.revokeAttestation(attestationId);
  const receipt = await tx.wait();
  return { tx, receipt };
}

export async function sendTrialInvitation(attestationId, studyName, description, compensationEth) {
  const contract = await getContract();
  const tx = await contract.sendTrialInvitation(attestationId, studyName, description, {
    value: parseEther(compensationEth),
  });
  const receipt = await tx.wait();
  return { tx, receipt };
}

export async function requestDataPurchase(attestationId, dataRequested, priceEth) {
  const contract = await getContract();
  const tx = await contract.requestDataPurchase(attestationId, dataRequested, {
    value: parseEther(priceEth),
  });
  const receipt = await tx.wait();
  return { tx, receipt };
}

export async function switchToBaseSepolia() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14a34' }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x14a34',
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
    }
  }
}
