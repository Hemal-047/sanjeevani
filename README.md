# Sanjeevani

**Private health cognition → trustworthy public action.**

> A multi-agent health intelligence system that privately analyzes medical records through Venice AI's zero-retention infrastructure, discovers hidden health patterns, and publishes anonymous onchain attestations for clinical trial matching and a health data marketplace.

Built for the **Synthesis Hackathon** — Venice AI Track.

---

## The Problem

Health data is trapped. Patients have lab reports, prescriptions, and discharge summaries scattered across providers — but no unified intelligence layer to connect the dots. Meanwhile, clinical researchers struggle to find qualified trial participants, and patients have no way to monetize their health data without exposing it.

**Three gaps exist today:**
1. No AI system cross-references a patient's full medical history to discover hidden patterns
2. No privacy-preserving way to prove health conditions onchain for trial matching
3. No marketplace where patients control and profit from their anonymized health data

## The Solution

Sanjeevani deploys four autonomous AI agents that work as a pipeline — each agent builds on the previous one's output:

```
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ DRISHTI  │───▶│  BODHI   │───▶│  MUDRA   │───▶│   SETU   │
  │ Document │    │ Cross-   │    │ Onchain  │    │ Market-  │
  │ Intel    │    │ Reference│    │ Attestor │    │ place    │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │               │               │               │
   PDF/Image      5-Step Chain     ICD-10 Map      Match Score
   Extraction     Risk Analysis    Evidence Hash   Trial Invite
                  Family Overlay   Consent Gen     Data Purchase
```

**All AI processing happens through Venice AI — zero data retention.** Your medical records are never stored by the AI provider.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  Entry → Upload → Analysis Dashboard → Attestation       │
│  Researcher Search → Trial Invitations → Data Purchases  │
│  MetaMask / Coinbase Wallet / EIP-1193                   │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────┐
│                   BACKEND (Express)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ DRISHTI  │ │  BODHI   │ │  MUDRA   │ │   SETU   │   │
│  │ Agent    │ │  Agent   │ │  Agent   │ │  Agent   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       └─────────────┴─────────────┴────────────┘         │
│                     Venice AI API                         │
│              (Zero Data Retention)                        │
└────────────────────────┬────────────────────────────────┘
                         │ ethers.js
┌────────────────────────┴────────────────────────────────┐
│              BASE SEPOLIA (Blockchain)                    │
│  HealthAttestation.sol                                    │
│  - Publish/Revoke Attestations                            │
│  - Trial Invitations (with ETH deposit)                   │
│  - Data Purchase Requests (with ETH payment)              │
│  - Query by Condition Code                                │
└─────────────────────────────────────────────────────────┘
```

---

## The Four Agents

### DRISHTI — Document Intelligence
Accepts PDFs and images of lab reports, prescriptions, discharge summaries, and scan reports. Extracts structured health data including findings with reference ranges, medications with dosages, and diagnoses. Uses Venice vision model (`qwen3-vl-235b-a22b`) for image-based documents.

### BODHI — Cross-Reference & Discovery
Takes all Drishti extractions plus optional family history and runs a 5-step reasoning chain:
1. **Timeline Build** — organizes findings chronologically
2. **Trend Analysis** — calculates biomarker direction, rate of change, acceleration
3. **Family Risk Overlay** — cross-references hereditary conditions with patient trends
4. **Drug Interaction Check** — flags medication interactions and contraindications
5. **Synthesis** — produces unified health profile with risk score, conditions, and attestable claims

### MUDRA — Attestation Generation
Validates Bodhi's findings through a Venice "second opinion" call, maps conditions to ICD-10 codes, generates SHA-256 evidence hashes (proving evidence exists without revealing it), and prepares human-readable consent summaries.

### SETU — Marketplace Matching
Two modes:
- **Patient side**: Generates research matchability profiles and suggested data packages with estimated value
- **Researcher side**: Ranks and scores patient attestations against search criteria with match reasons and gap analysis

---

## Smart Contract

**HealthAttestation.sol** — deployed on Base Sepolia

| Feature | Description |
|---------|-------------|
| Publish Attestation | Patient publishes condition code, severity, confidence, evidence hash |
| Revoke Attestation | Patient can revoke their own attestations |
| Trial Invitations | Researchers send invitations with ETH deposit |
| Data Purchases | Researchers request data with ETH payment |
| Query by Condition | Search attestations by ICD-10 condition code |
| ReentrancyGuard | OpenZeppelin protection on all payment functions |

**Deployed Contract:** [`0xAB37D12B4f2e0f2C5e4B6aE44DdA173813917A17`](https://sepolia.basescan.org/address/0xAB37D12B4f2e0f2C5e4B6aE44DdA173813917A17)

**Network:** Base Sepolia (Chain ID: 84532)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TailwindCSS, ethers.js v6 |
| Backend | Node.js, Express, multer, pdf-parse, sharp |
| AI | Venice AI (llama-3.3-70b, qwen3-vl-235b-a22b) |
| Blockchain | Solidity 0.8.24, Hardhat, Base Sepolia |
| Security | OpenZeppelin ReentrancyGuard, SHA-256 evidence hashing |
| Privacy | Venice AI zero data retention policy |

---

## Run Locally

```bash
# 1. Clone
git clone https://github.com/Hemal-047/sanjeevani.git
cd sanjeevani

# 2. Backend
cd backend
npm install
cp .env.example .env  # Add your VENICE_API_KEY
npm run dev            # Starts on :3001

# 3. Frontend
cd ../frontend
npm install
npm run dev            # Starts on :5173

# 4. Contracts (optional — already deployed)
cd ../contracts
npm install
npx hardhat compile
npx hardhat test
```

### Environment Variables

**Backend (`/backend/.env`):**
```
VENICE_API_KEY=your_venice_api_key
PRIVATE_KEY=your_deployer_wallet_private_key
PORT=3001
```

**Frontend (`/frontend/.env`):**
```
VITE_CONTRACT_ADDRESS=0xAB37D12B4f2e0f2C5e4B6aE44DdA173813917A17
VITE_API_URL=http://localhost:3001
```

---

## Venice AI Integration

All four agents communicate with Venice AI through a unified client (`/backend/src/utils/veniceClient.js`):

- **Text completion**: `llama-3.3-70b` for structured health data extraction, reasoning chains, and attestation validation
- **Vision completion**: `qwen3-vl-235b-a22b` for image-based medical document OCR
- **Zero retention**: Venice AI does not store any data sent through its API — critical for handling sensitive medical records
- **Structured output**: All agent prompts enforce JSON-only responses with strict schemas

---

## Project Structure

```
sanjeevani/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── drishti.js      # Document intelligence
│   │   │   ├── bodhi.js        # Cross-reference & discovery
│   │   │   ├── mudra.js        # Attestation generation
│   │   │   └── setu.js         # Marketplace matching
│   │   ├── routes/
│   │   │   ├── analyze.js      # Analysis endpoints
│   │   │   ├── attestation.js  # Attestation preparation
│   │   │   └── marketplace.js  # Researcher marketplace
│   │   ├── utils/
│   │   │   └── veniceClient.js # Venice AI API client
│   │   └── index.js            # Express server
│   └── test-*.js               # Agent test scripts
├── frontend/
│   ├── src/
│   │   ├── pages/              # Entry, Upload, Analysis, Attestation, Research
│   │   ├── services/           # api.js, wallet.js
│   │   ├── context/            # AppContext.jsx
│   │   └── contracts/          # ABI
│   └── public/
│       ├── agent.json          # Agent manifest
│       └── agent_log.json      # Sample agent log
├── contracts/
│   ├── contracts/
│   │   └── HealthAttestation.sol
│   ├── scripts/deploy.js
│   └── test/HealthAttestation.test.js
└── README.md
```

---

## License

MIT

---

*Built with Venice AI for the Synthesis Hackathon.*
