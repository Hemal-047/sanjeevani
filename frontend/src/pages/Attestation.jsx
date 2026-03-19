import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { publishAttestation, switchToBaseSepolia, txLink } from '../services/wallet';

function Toggle({ active, onToggle }) {
  return (
    <div className={`toggle-track ${active ? 'active' : ''}`} onClick={onToggle}>
      <div className="toggle-thumb" />
    </div>
  );
}

export default function Attestation() {
  const { mudraResult } = useApp();
  const [selected, setSelected] = useState(() => {
    if (!mudraResult?.attestations) return {};
    return Object.fromEntries(mudraResult.attestations.map((_, i) => [i, true]));
  });
  const [publishing, setPublishing] = useState(false);
  const [txHashes, setTxHashes] = useState([]);
  const [stampVisible, setStampVisible] = useState(false);
  const [publishError, setPublishError] = useState(null);

  const attestations = mudraResult?.attestations || [];
  const selectedCount = Object.values(selected).filter(Boolean).length;

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const hashes = [];

    try {
      await switchToBaseSepolia();
      for (let i = 0; i < attestations.length; i++) {
        if (!selected[i]) continue;
        const a = attestations[i];
        try {
          const result = await publishAttestation(
            a.conditionCodeBytes32,
            a.conditionName,
            a.severity,
            a.confidence,
            a.evidenceHash
          );
          hashes.push({ index: i, hash: result.tx.hash, txUrl: result.txUrl, success: true });
        } catch (err) {
          if (err.message.includes('Contract not yet deployed')) {
            setPublishError(err.message);
            setPublishing(false);
            return;
          }
          hashes.push({ index: i, hash: null, error: err.message, success: false });
        }
      }
    } catch (err) {
      setPublishError(err.message);
      setPublishing(false);
      return;
    }

    setTxHashes(hashes);
    setPublishing(false);
    if (hashes.some(t => t.success)) setStampVisible(true);
  }

  const consentLines = mudraResult?.consentSummary?.split('\n').filter(l => l.startsWith('APPROVED:')) || [];

  return (
    <div className="pt-14 min-h-screen" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>
      <div className="py-8">
        <h2 className="agent-name mb-2" style={{ fontSize: '14px', color: 'var(--color-gold)' }}>
          MUDRA — SEAL YOUR CLAIMS
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
          Review and publish your health attestations onchain. Only selected claims will be visible — no personal data is revealed.
        </p>

        {attestations.length === 0 ? (
          <div className="text-center py-16">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-dim)' }}>
              No attestable claims found. Run analysis first.
            </p>
          </div>
        ) : (
          <>
            {attestations.map((a, i) => (
              <div key={i} className="mb-4 slide-in" style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '2px', padding: '16px', animationDelay: `${i * 100}ms`,
              }}>
                <div className="flex items-center gap-4">
                  {/* Left: Condition + code */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>{a.conditionName}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', background: 'var(--color-surface)', padding: '1px 6px', border: '1px solid var(--color-border)', borderRadius: '1px' }}>
                        {a.conditionCode}
                      </span>
                    </div>
                  </div>

                  {/* Center: Confidence bar */}
                  <div className="flex items-center gap-2" style={{ minWidth: '140px' }}>
                    <div style={{ flex: 1, height: '2px', background: 'var(--color-border)', position: 'relative', borderRadius: '1px' }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${a.confidence}%`, borderRadius: '1px',
                        background: 'var(--color-gold)',
                      }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {a.confidence}%
                    </span>
                  </div>

                  {/* Right: Severity + toggle */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '1px',
                        background: a.severityLabel === 'critical' ? '#DC2626' : a.severityLabel === 'high' ? 'var(--color-critical)' : a.severityLabel === 'moderate' ? 'var(--color-amber)' : 'var(--color-emerald)',
                      }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                        {a.severityLabel}
                      </span>
                    </div>
                    <Toggle active={selected[i]} onToggle={() => setSelected(prev => ({ ...prev, [i]: !prev[i] }))} />
                  </div>
                </div>

                {/* Consent line */}
                {consentLines[i] && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '8px', lineHeight: '1.5' }}>
                    {consentLines[i].replace('APPROVED: ', '')}
                  </p>
                )}

                {/* Tx hash if published */}
                {txHashes.find(t => t.index === i) && (
                  <div className="mt-2">
                    {txHashes.find(t => t.index === i).success ? (
                      <a
                        href={txLink(txHashes.find(t => t.index === i).hash)}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-emerald)', textDecoration: 'none' }}>
                        ✓ tx: {txHashes.find(t => t.index === i).hash?.slice(0, 20)}...
                      </a>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-critical)' }}>
                        ✗ {txHashes.find(t => t.index === i).error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Publish bar */}
            <div className="mt-8 flex items-center gap-4">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Publishing {selectedCount} attestation{selectedCount !== 1 ? 's' : ''} to Base Sepolia
              </span>
              <button
                onClick={handlePublish}
                disabled={selectedCount === 0 || publishing}
                className="flex-1 py-3 relative overflow-hidden transition-all duration-200"
                style={{
                  background: selectedCount > 0 && !publishing ? 'transparent' : 'var(--color-surface)',
                  color: selectedCount > 0 && !publishing ? 'var(--color-gold)' : 'var(--color-text-dim)',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.15em', fontWeight: 600,
                  border: `1px solid ${selectedCount > 0 ? 'var(--color-gold)' : 'var(--color-border)'}`,
                  borderRadius: '2px',
                  cursor: selectedCount > 0 && !publishing ? 'pointer' : 'not-allowed',
                }}>
                {publishing ? 'SEALING...' : 'SEAL & PUBLISH'}
              </button>
            </div>

            {publishError && (
              <div style={{
                marginTop: '12px', padding: '12px 16px',
                background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)',
                borderRadius: '2px',
              }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-amber)' }}>
                  {publishError}
                </p>
              </div>
            )}

            {/* Stamp Animation */}
            {stampVisible && txHashes.some(t => t.success) && (
              <div className="flex items-center justify-center py-8">
                <div className="stamp-animate" style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  border: '3px solid var(--color-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-gold)', fontFamily: 'var(--font-mono)',
                  fontSize: '11px', letterSpacing: '0.1em', textAlign: 'center',
                  boxShadow: '0 0 20px rgba(212,165,116,0.3)',
                }}>
                  SEALED
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
