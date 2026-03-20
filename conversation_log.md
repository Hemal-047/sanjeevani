# Sanjeevani — Human-Agent Conversation Log

> A record of how a human and an AI agent built a health intelligence system together in 3 days.

---

## Day 1: Ideation & Backend Build

### Project Ideation

**Human**: Chose the Venice AI track because it offered something most health platforms can't — zero data retention for medical records. Named the system *Sanjeevani* after the mythological life-restoring herb from the Ramayana. Designed four agents with Sanskrit names that map to their roles:

- **DRISHTI** (vision): Document intelligence. It sees and reads medical records.
- **BODHI** (enlightenment): Cross-reference reasoning. It understands what the documents mean together.
- **MUDRA** (seal): Onchain attestation. It stamps claims with cryptographic authority.
- **SETU** (bridge): Marketplace matching. It connects patients to researchers.

**Agent (Claude Code)**: Scaffolded the monorepo structure — `/backend` (Node.js Express), `/frontend` (React + Vite + Tailwind v4), `/contracts` (Hardhat + Solidity). Set up the project architecture to keep concerns clean.

### Backend Build

**Agent**: Built all four agents sequentially:

1. **Drishti** — Used `pdf-parse` for PDFs and `sharp` + Venice's `qwen3-vl-235b-a22b` vision model for images. The vision model reads lab reports, prescriptions, and discharge summaries, returning structured JSON with findings, medications, diagnoses, and a confidence score. Tested with a real blood panel image — it correctly identified HbA1c 6.4%, fasting glucose 126, and flagged pre-diabetic markers.

2. **Bodhi** — The most complex agent. A 5-step reasoning chain where each step is a separate Venice API call with accumulated context:
   - Step 1: Timeline Build (order all findings chronologically)
   - Step 2: Trend Analysis (identify worsening/improving biomarkers)
   - Step 3: Family Risk Overlay (conditional — only runs if family history provided)
   - Step 4: Drug Interaction Check (conditional — only if multiple medications detected)
   - Step 5: Synthesis (overall risk score, conditions, and recommendations)

3. **Mudra** — Takes Bodhi's output and generates ICD-10 codes, SHA-256 evidence hashes, severity levels. Runs a Venice "second opinion" validation call to check its own work.

4. **Setu** — Two modes: patient profile generation and researcher search with AI-powered matching and ranking.

**Human**: Drove the agent design decisions — insisted on the 5-step reasoning chain for Bodhi rather than a single prompt, and on the family history conditional logic. Also defined the ICD-10 code requirement for Mudra to make attestations medically meaningful.

### Smart Contract

**Agent**: Wrote `HealthAttestation.sol` — Solidity 0.8.24 with OpenZeppelin's ReentrancyGuard. Features:
- Attestation publish/revoke with condition codes, severity, confidence, evidence hashes
- Trial invitation system (payable — researchers pay to invite patients)
- Data purchase request/accept/decline with ETH escrow
- Events for everything (important for indexing)
- 20/20 tests passing in Hardhat

**Human**: Defined the economic model — researchers pay to contact patients, not the other way around. This flips the usual healthcare data dynamic.

---

## Day 2: Frontend, Pivots & Deployment

### Frontend Build

**Human**: Designed the entire visual direction — a dark "Medical Intelligence Theater" aesthetic. Specified Instrument Serif for headings, JetBrains Mono for data, gold (#D4A574) as the accent. Wanted it to feel like a high-end diagnostic tool, not a consumer health app.

**Agent**: Built 5 pages:
- **Entry**: Animated pipeline visualization, wallet connection for two roles (user vs. researcher)
- **Upload**: Drag-and-drop with family history panel, file type detection
- **Analysis**: Three-column layout (Agent Log / Health Profile / Documents), animated risk ring with requestAnimationFrame counter, grouped biomarker trends with sparklines, severity-coded condition cards
- **Attestation**: MUDRA seal page with stamp animation, toggle cards for selective publishing, BaseScan tx links
- **Research Marketplace**: Filter panel + results with inline trial invitation and data purchase forms, MetaMask-triggered transactions

All animations CSS-only — no animation libraries. Human was insistent on this.

### The Pivots (Real Talk)

**Attempt 1: Parallel Document Processing**
We tried to process all uploaded documents through Drishti simultaneously (Promise.all with 5 files). Venice's API rate-limited us hard — all 5 calls failed. The error wasn't obvious at first; it looked like a parsing issue, not a rate limit.

**Attempt 2: SSE Streaming**
Built a Server-Sent Events endpoint to stream agent progress to the frontend in real-time. Multipart file uploads + SSE don't play nicely together. The implementation got messy and fragile.

**The Revert**: Human made the call — "revert to what works." We restored 4 files from the last known-good commit (fb2ea16) using `git checkout`. Sequential processing is slower but 100% reliable. **Lesson: ship what works, optimize later.** This is a hackathon, not a production deployment.

### Contract Deployment & Chain ID Hell

Deployed `HealthAttestation.sol` to Base Sepolia at `0xAB37D12B4f2e0f2C5e4B6aE44DdA173813917A17`.

Then came the chain ID bug. MetaMask was connected to Base Sepolia (chain ID 84532), but ethers.js v6's `BrowserProvider` was auto-detecting Base Mainnet (chain ID 8453). The error message was cryptic: "invalid chain id for signer: have 84532 want 8453." We debugged this step by step — adding console logs to trace the provider's network detection, discovering that `BrowserProvider` defaults to whatever the network "looks like" without an explicit override.

**Fix**: Pass the network explicitly to the constructor:
```js
const BASE_SEPOLIA_NETWORK = { chainId: 84532, name: 'base-sepolia' };
new BrowserProvider(window.ethereum, BASE_SEPOLIA_NETWORK);
```
Plus a 500ms delay after `wallet_switchEthereumChain` to let MetaMask settle. Unglamorous but effective.

Also: testnet faucet frustration. Base Sepolia faucets are stingy. Needed ETH for contract deployment and test transactions. Multiple faucets, multiple tries.

### Competitive Differentiation

**Human**: Analyzed other Venice track projects and realized most were human-triggered tools — upload a file, get a response. Sanjeevani needed to be genuinely agentic, not just an API wrapper.

Added autonomous features:
- **Setu Auto-Match**: Polling every 30 seconds for new matching patients when researcher enables it
- **Bodhi Health Watch**: Autonomous monitoring that generates alerts based on detected risk patterns
- **Agent-to-Agent API**: REST endpoints so agents can query each other's state and capabilities

**Agent**: Implemented all three — new backend routes (`/api/agents/status`, `/api/agents/:name/query`, `/api/marketplace/auto-match`), polling logic with `setInterval`, state management, UI toggles with pulsing status indicators.

---

## Day 3: Deployment & Polish

### Deployment

- **Frontend**: Deployed to Vercel at `sanjeevani-peach.vercel.app`
- **Backend**: Deployed to Render at `sanjeevani-api-5qgx.onrender.com`
- CORS issues between Vercel and Render — had to explicitly allowlist the Vercel domain with a preflight `OPTIONS` handler. The default CORS config wasn't enough; needed explicit `methods`, `allowedHeaders`, and `credentials: true`.

### UI Polish

Final pass across all pages:
- Back button on every page (except Entry) — simple monospace arrow, gold on hover
- Entry page: font fallback chain (`'Instrument Serif', 'Georgia', serif`), visible gold pipeline connecting lines, description text below the agent diagram
- Upload page: constrained drop zone to 300px (was filling viewport), colored left borders on file rows (green for PDF, blue for image), gold ANALYZE button when files exist
- Analysis page: filtered SYSTEM error messages from agent log, increased separator padding, enlarged risk score to 56px, subtle background on condition cards
- Attestation page: enhanced stamp animation (gold fill with radial glow that fades to outline), full "View on BaseScan" links instead of truncated hashes, 24px gap between cards

### Key Decision

**Human**: Kept Sanjeevani as its own standalone project, separate from their existing app IP. Clean codebase, clean story, no baggage.

---

## Architecture Decisions

| Decision | Rationale | Made By |
|----------|-----------|---------|
| Venice AI (zero retention) | Privacy-first for medical data | Human |
| 4-agent pipeline | Separation of concerns: extract, reason, attest, match | Human |
| Sequential processing | Venice API rate limits killed parallel attempts | Human (after failed attempt) |
| 5-step Bodhi reasoning chain | Each step builds on accumulated context; single prompt was too shallow | Human |
| Base Sepolia testnet | Low-cost testing, EVM compatible, BaseScan explorer | Human |
| CSS-only animations | No library dependencies, smaller bundle, full control | Human |
| Explicit BrowserProvider network | Prevents chain ID mismatch with testnets | Agent (debug fix) |
| Researcher-pays economic model | Flips traditional healthcare data dynamic | Human |
| Mock attestations for demo | Contract may not be deployed in all environments | Agent |

---

## Agent Contribution Summary

**Claude Code (Agent)** handled:
- All code scaffolding and architecture
- All four agent implementations (Drishti, Bodhi, Mudra, Setu)
- Smart contract development and 20 tests
- Complete frontend (5 pages, CSS animations, wallet integration)
- Deployment configuration and CORS debugging
- Chain ID mismatch diagnosis and fix
- Every commit in the repo

**Human** drove:
- Product vision and naming (Sanjeevani, Sanskrit agent names)
- Visual design direction (dark medical-intelligence aesthetic, color palette, typography choices)
- Architectural decisions (5-step reasoning chain, conditional steps, ICD-10 codes)
- Economic model (researcher-pays, not patient-pays)
- Competitive strategy (autonomous features to differentiate from other Venice track projects)
- The critical "revert to what works" pivot decision
- All testing, QA, and deployment platform selection

---

## Agent Capabilities

| Agent | Input | Output | Model | Autonomous? |
|-------|-------|--------|-------|-------------|
| DRISHTI | PDF, images | Structured extractions | qwen3-vl-235b-a22b | No (triggered by upload) |
| BODHI | Extractions + family history | 5-step synthesis | llama-3.3-70b | Yes (Health Watch) |
| MUDRA | Bodhi analysis | ICD-10 attestations | llama-3.3-70b | No (triggered after Bodhi) |
| SETU | Attestations + criteria | Ranked matches | llama-3.3-70b | Yes (Auto-Match) |

---

## Tech Stack

- **LLM**: Venice AI (`llama-3.3-70b` text, `qwen3-vl-235b-a22b` vision) — zero data retention
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express
- **Blockchain**: Solidity 0.8.24, Hardhat, Base Sepolia (chain ID 84532)
- **Wallet**: ethers.js v6, MetaMask
- **Agent Harness**: Claude Code
- **Model**: Claude (Anthropic)
- **Hosting**: Vercel (frontend) + Render (backend)

---

*Built in 3 days. Every line of code written by an AI agent. Every decision made by a human. That's the collaboration.*
