import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const AGENTS = [
  { name: 'DRISHTI', desc: 'Document Intelligence' },
  { name: 'BODHI', desc: 'Cross-Reference & Discovery' },
  { name: 'MUDRA', desc: 'Onchain Attestation' },
  { name: 'SETU', desc: 'Marketplace Matching' },
];

export default function Entry() {
  const { connectWallet } = useApp();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [pipelineActive, setPipelineActive] = useState(false);

  async function handleConnect(role) {
    setConnecting(true);
    try {
      await connectWallet(role);
      setPipelineActive(true);
      setTimeout(() => {
        navigate(role === 'user' ? '/upload' : '/research');
      }, 2200);
    } catch (err) {
      console.error(err);
      setConnecting(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center relative grid-bg" style={{ minHeight: '100vh', overflow: 'hidden' }}>

      {/* Subtle background radial pulse */}
      <div className="bg-pulse" />

      {/* Title */}
      <h1 className="gold-shimmer entry-title" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(48px, 8vw, 96px)',
        lineHeight: 1.15,
        paddingBottom: '4px',
        marginBottom: '16px',
        fontWeight: 400,
        position: 'relative',
        zIndex: 1,
      }}>
        Sanjeevani
      </h1>

      <p className="entry-tagline" style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.05em',
        marginBottom: '64px',
        position: 'relative',
        zIndex: 1,
      }}>
        Private Health Cognition → Trustworthy Public Action
      </p>

      {/* Agent Pipeline */}
      <div className="flex items-center gap-0" style={{ maxWidth: '680px', width: '90%', justifyContent: 'center', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
        {AGENTS.map((agent, i) => (
          <div key={agent.name} className="flex items-center">
            <div className={`flex flex-col items-center entry-agent`} style={{
              minWidth: '120px',
              maxWidth: '130px',
              animationDelay: `${1.6 + i * 0.2}s`,
            }}>
              <span className="agent-name" style={{
                fontSize: '13px',
                color: pipelineActive ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                transition: `color 0.4s ease ${i * 0.4}s`,
              }}>
                {agent.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: '#8A8680',
                marginTop: '10px',
                textAlign: 'center',
                lineHeight: '1.4',
              }}>
                {agent.desc}
              </span>
            </div>
            {i < AGENTS.length - 1 && (
              <div className="relative entry-agent" style={{
                width: '32px',
                height: '1px',
                background: 'var(--color-border-strong)',
                margin: '0 2px',
                marginBottom: '24px',
                animationDelay: `${1.8 + i * 0.2}s`,
              }}>
                {pipelineActive && (
                  <div className="absolute top-0 h-full pipeline-glow" style={{
                    width: '16px',
                    background: 'var(--color-gold)',
                    boxShadow: '0 0 8px var(--color-gold)',
                    animationDelay: `${i * 0.5}s`,
                  }} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Connect Buttons */}
      <div className="flex gap-4 entry-buttons" style={{ marginTop: '60px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => handleConnect('user')}
          disabled={connecting}
          className="px-6 py-3"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-gold)',
            color: 'var(--color-gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            borderRadius: '2px',
            cursor: connecting ? 'wait' : 'pointer',
            opacity: connecting ? 0.5 : 1,
          }}>
          Connect Wallet — User Health Data Center
        </button>
        <button
          onClick={() => handleConnect('researcher')}
          disabled={connecting}
          className="px-6 py-3"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-gold)',
            color: 'var(--color-gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            borderRadius: '2px',
            cursor: connecting ? 'wait' : 'pointer',
            opacity: connecting ? 0.5 : 1,
          }}>
          Connect Wallet — Research Marketplace
        </button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 entry-footer" style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--color-text-dim)',
        letterSpacing: '0.05em',
      }}>
        Powered by Venice AI · Zero Data Retention
      </div>
    </div>
  );
}
