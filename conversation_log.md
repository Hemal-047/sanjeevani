# Sanjeevani — Human-Agent Collaboration Log

> This document records the collaborative development process between human and AI agents in building Sanjeevani.

---

## Session 1: Foundation & Agent Pipeline

### Phase 1 — Scaffold & DRISHTI
- **Human**: Defined monorepo structure (backend/frontend/contracts), specified Venice AI integration, multi-agent architecture
- **AI Agent**: Scaffolded Express backend, React+Vite frontend, Hardhat contracts. Built DRISHTI agent with pdf-parse + Venice vision API (qwen3-vl-235b-a22b)
- **Decision**: Sequential document processing chosen over parallel due to Venice API rate limits
- **Outcome**: Working document extraction from PDFs and images

### Phase 2 — BODHI Reasoning Chain
- **Human**: Specified 5-step reasoning chain (Timeline → Trends → Family Risk → Drug Interactions → Synthesis)
- **AI Agent**: Implemented accumulated-context pattern where each step builds on all previous outputs
- **Decision**: Each reasoning step is a separate Venice API call with full context passing
- **Outcome**: Cross-document pattern discovery working across multiple lab reports

### Phase 3 — MUDRA & Smart Contract
- **Human**: Defined HealthAttestation.sol with attestation publishing, trial invitations, data marketplace
- **AI Agent**: Built Solidity contract with OpenZeppelin ReentrancyGuard, ICD-10 mapping in MUDRA agent, SHA-256 evidence hashing
- **Decision**: Base Sepolia chosen for testnet deployment (chain ID 84532)
- **Outcome**: Contract deployed at `0xAB37D12B4f2e0f2C5e4B6aE44DdA173813917A17`

### Phase 4 — SETU Marketplace
- **Human**: Defined dual-mode matching (patient profiles + researcher search)
- **AI Agent**: Built Venice-powered matchability scoring, researcher dashboard with inline invite/purchase forms
- **Outcome**: Full marketplace pipeline from attestation to researcher matching

---

## Session 2: Frontend & Integration

### Phase 5 — Wallet Integration
- **Human**: Reported chain ID mismatch error ("have 84532 want 8453")
- **AI Agent**: Diagnosed ethers.js BrowserProvider auto-detecting Base Mainnet. Fixed with explicit network config
- **Key Fix**: `new BrowserProvider(window.ethereum, { chainId: 84532, name: 'base-sepolia' })` + 500ms delay after network switch
- **Lesson**: Always pass explicit network to BrowserProvider when working with testnets

### Phase 6 — Analysis Page
- **Human**: Specified three-column layout (Agent Log / Health Profile / Documents)
- **AI Agent**: Built animated RiskRing with requestAnimationFrame, grouped biomarker trends with sparklines, severity-based color coding
- **Decision**: CSS-only animations (no libraries) — staggered fade-ins, SVG sparkline draw, seal stamp keyframes
- **Outcome**: Full analysis visualization with real-time agent progress tracking

### Phase 7 — SSE Attempt & Revert
- **Human**: Requested parallel processing + SSE streaming for speed
- **AI Agent**: Implemented parallel Drishti calls + SSE endpoint
- **Problem**: Venice API rate limiting caused all 5 parallel calls to fail
- **Human Decision**: "Revert to sequential approach" — 4 specific files restored from commit fb2ea16
- **Lesson**: Venice API requires sequential calls; SSE adds complexity without benefit for this use case

---

## Session 3: Polish & Deployment

### Phase 8 — UI Animations & Visual Polish
- **Human**: Detailed animation requirements for Entry, Upload, Analysis, Attestation pages
- **AI Agent**: Implemented staggered load animations, gold pulse effects, seal stamp animation, collapsible biomarker groups
- **Outcome**: Cohesive "Medical Intelligence Theater" aesthetic across all pages

### Phase 9 — Hackathon Prep
- **Human**: Requested contract verification, agent manifests, README, Vercel/Render deployment configs
- **AI Agent**: Built comprehensive README with ASCII architecture diagram, agent.json manifest, deployment configurations
- **Outcome**: Production-ready deployment pipeline

---

## Session 4: Autonomous Agent Features

### Phase 10 — Making Agents Genuinely Agentic
- **Human**: "Add autonomous agent features to make Sanjeevani genuinely agentic, not just a human-triggered tool"
- **AI Agent**: Implemented four autonomous features:
  1. **SETU Auto-Match**: 30-second polling interval, researcher dashboard toggle, real-time match count
  2. **BODHI Health Watch**: Autonomous monitoring section, simulated alert after 10s based on actual analysis data
  3. **Agent-to-Agent API**: GET /api/agents/status (all agents), GET /api/agents/:name/query (individual capabilities)
  4. **Conversation Log**: This document — recording human-agent collaboration decisions

---

## Architecture Decisions

| Decision | Rationale | Made By |
|----------|-----------|---------|
| Venice AI (zero retention) | Privacy-first for medical data | Human |
| Sequential processing | Venice API rate limits | Human (after failed parallel attempt) |
| Base Sepolia testnet | Low-cost testing, EVM compatible | Human |
| CSS-only animations | No library dependencies, smaller bundle | Human |
| Explicit BrowserProvider network | Prevents chain ID mismatch with testnets | AI Agent (debug fix) |
| 4-agent pipeline | Separation of concerns: extract → reason → attest → match | Human |
| Mock attestations for demo | Contract may not be deployed in all environments | AI Agent |

---

## Agent Capabilities Summary

| Agent | Input | Output | Model | Autonomous? |
|-------|-------|--------|-------|-------------|
| DRISHTI | PDF, images | Structured extractions | qwen3-vl-235b-a22b | No (triggered by upload) |
| BODHI | Extractions + family history | 5-step synthesis | llama-3.3-70b | Yes (Health Watch) |
| MUDRA | Bodhi analysis | ICD-10 attestations | llama-3.3-70b | No (triggered after Bodhi) |
| SETU | Attestations + criteria | Ranked matches | llama-3.3-70b | Yes (Auto-Match) |
