import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { analyzeComprehensive, prepareAttestations } from '../services/api';

function RiskRing({ score, size = 140, stroke = 3 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? 'var(--color-critical)' : score >= 40 ? 'var(--color-amber)' : 'var(--color-emerald)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
      </svg>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '42px', color, lineHeight: 1 }}>
        {score}
      </span>
    </div>
  );
}

function Sparkline({ values, direction, concern }) {
  if (!values || values.length < 2) return null;
  const nums = values.map(v => parseFloat(String(v).replace(/,/g, '')));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const points = nums.map((v, i) => `${(i / (nums.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const color = concern ? 'var(--color-critical)' : 'var(--color-emerald)';

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        {nums.map((v, i) => (
          <circle key={i} cx={(i / (nums.length - 1)) * w} cy={h - ((v - min) / range) * h} r="2" fill={color} />
        ))}
      </svg>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color }}>
        {direction === 'rising' ? '↑' : direction === 'falling' ? '↓' : '→'}
      </span>
    </div>
  );
}

function SeverityDot({ severity }) {
  const colors = { low: 'var(--color-emerald)', moderate: 'var(--color-amber)', high: 'var(--color-critical)', critical: '#DC2626' };
  return <div style={{ width: '6px', height: '6px', borderRadius: '1px', background: colors[severity] || '#888', flexShrink: 0 }} />;
}

export default function Analysis() {
  const {
    uploadedFiles, familyHistory, extractions, setExtractions,
    bodhiAnalysis, setBodhiAnalysis, setMudraResult,
    agentLog, addLogEntry,
  } = useApp();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agentLog]);

  useEffect(() => {
    if (uploadedFiles.length === 0) return;
    if (running || done) return;
    runAnalysis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAnalysis() {
    setRunning(true);

    // Log: Drishti starts
    addLogEntry({ agent: 'DRISHTI', action: 'Initializing document intelligence...', type: 'start' });

    uploadedFiles.forEach((f, i) => {
      setTimeout(() => {
        addLogEntry({ agent: 'DRISHTI', action: `Reading ${f.name}...`, type: 'progress' });
      }, i * 300);
    });

    try {
      const fh = familyHistory.members.length > 0 ? familyHistory : null;
      const result = await analyzeComprehensive(uploadedFiles, fh);

      if (result.success || result.extractions) {
        const exts = result.extractions || [];
        setExtractions(exts);

        exts.forEach(ext => {
          addLogEntry({
            agent: 'DRISHTI',
            action: `Extracted ${ext.findings?.length || 0} findings from ${ext.filename}`,
            type: 'complete',
          });
        });

        // Bodhi analysis
        if (result.analysis) {
          const analysis = result.analysis;
          setBodhiAnalysis(analysis);

          if (analysis.reasoningChain) {
            analysis.reasoningChain.forEach((step, i) => {
              setTimeout(() => {
                addLogEntry({
                  agent: step.step <= 1 ? 'DRISHTI' : 'BODHI',
                  action: `${step.title}: ${step.summary}`,
                  type: step.step === analysis.reasoningChain.length ? 'complete' : 'progress',
                });
              }, i * 200);
            });
          }

          // Prepare Mudra attestations
          if (analysis.synthesis) {
            setTimeout(async () => {
              addLogEntry({ agent: 'MUDRA', action: 'Preparing onchain attestations...', type: 'start' });
              try {
                const mudra = await prepareAttestations(analysis);
                if (mudra.success && mudra.data) {
                  setMudraResult(mudra.data);
                  addLogEntry({
                    agent: 'MUDRA',
                    action: `${mudra.data.approvedCount} attestations ready for publishing`,
                    type: 'complete',
                  });
                }
              } catch {
                addLogEntry({ agent: 'MUDRA', action: 'Attestation preparation deferred', type: 'complete' });
              }
              setDone(true);
            }, 500);
          } else {
            setDone(true);
          }
        } else {
          setDone(true);
        }
      } else {
        addLogEntry({ agent: 'SYSTEM', action: 'Analysis failed — check uploaded files', type: 'error' });
        setDone(true);
      }
    } catch (err) {
      addLogEntry({ agent: 'SYSTEM', action: `Error: ${err.message}`, type: 'error' });
      setDone(true);
    }

    setRunning(false);
  }

  const synthesis = bodhiAnalysis?.synthesis || {};
  const conditions = synthesis.conditions || [];
  const trends = synthesis.trends || [];
  const drugInteractions = synthesis.drugInteractions || [];
  const medications = extractions.flatMap(e => e.medications || []);

  return (
    <div className="pt-14 h-screen flex" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* LEFT: Agent Log (25%) */}
      <div className="w-1/4 flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>AGENT LOG</h3>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {agentLog.map((entry, i) => {
            const prevAgent = i > 0 ? agentLog[i - 1].agent : null;
            const showSeparator = prevAgent && prevAgent !== entry.agent;
            return (
              <div key={i}>
                {showSeparator && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1" style={{ height: '1px', background: 'var(--color-border)' }} />
                    <span style={{ color: 'var(--color-gold)', fontSize: '10px', letterSpacing: '0.15em' }}>{entry.agent}</span>
                    <div className="flex-1" style={{ height: '1px', background: 'var(--color-border)' }} />
                  </div>
                )}
                <div className="py-1 slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-start gap-2">
                    {entry.type === 'progress' || entry.type === 'start' ? (
                      <span className="pulse-gold" style={{ color: 'var(--color-gold)', fontSize: '8px', marginTop: '3px' }}>●</span>
                    ) : entry.type === 'complete' ? (
                      <span style={{ color: 'var(--color-emerald)', fontSize: '8px', marginTop: '3px' }}>●</span>
                    ) : (
                      <span style={{ color: 'var(--color-critical)', fontSize: '8px', marginTop: '3px' }}>●</span>
                    )}
                    <div className="flex-1">
                      <span style={{ color: 'var(--color-text-dim)', marginRight: '6px' }}>
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span style={{ color: 'var(--color-gold)' }}>{entry.agent}</span>
                      <div style={{ color: entry.type === 'complete' ? 'var(--color-emerald)' : entry.type === 'error' ? 'var(--color-critical)' : 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {entry.action}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {running && (
            <div className="py-2">
              <span className="pulse-gold" style={{ color: 'var(--color-gold)' }}>● processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Health Profile (50%) */}
      <div className="w-1/2 flex flex-col overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>HEALTH PROFILE</h3>
        </div>
        <div className="px-6 py-6 flex-1">
          {/* Risk Score */}
          <div className="flex items-center justify-center mb-8">
            {synthesis.overallRiskScore != null ? (
              <RiskRing score={synthesis.overallRiskScore} />
            ) : (
              <div className="skeleton" style={{ width: '140px', height: '140px', borderRadius: '70px' }} />
            )}
          </div>

          {/* Conditions */}
          {conditions.length > 0 && (
            <div className="mb-8">
              <h4 className="agent-name mb-3" style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>CONDITIONS DETECTED</h4>
              {conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2 slide-in" style={{ borderBottom: '1px solid var(--color-border)', animationDelay: `${i * 150}ms` }}>
                  <SeverityDot severity={c.severity} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', flex: 1 }}>{c.name}</span>
                  <div className="flex items-center gap-2" style={{ minWidth: '120px' }}>
                    <div className="flex-1" style={{ height: '2px', background: 'var(--color-border)', position: 'relative', borderRadius: '1px' }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${c.confidence}%`, borderRadius: '1px',
                        background: c.severity === 'critical' ? '#DC2626' : c.severity === 'high' ? 'var(--color-critical)' : c.severity === 'moderate' ? 'var(--color-amber)' : 'var(--color-emerald)',
                        transition: 'width 1s ease-out',
                      }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '32px', textAlign: 'right' }}>
                      {c.confidence}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trends */}
          {trends.length > 0 && (
            <div className="mb-8">
              <h4 className="agent-name mb-3" style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>BIOMARKER TRENDS</h4>
              {trends.map((t, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', flex: 1 }}>{t.biomarker}</span>
                  <Sparkline values={t.values} direction={t.direction} concern={t.concern} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-dim)', minWidth: '60px', textAlign: 'right' }}>
                    {t.values?.join(' → ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Medications & Interactions */}
          {medications.length > 0 && (
            <div className="mb-8">
              <h4 className="agent-name mb-3" style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>MEDICATIONS</h4>
              {medications.map((m, i) => {
                const hasInteraction = drugInteractions.some(d =>
                  d.drugs?.includes(m.name) || d.description?.includes(m.name)
                );
                return (
                  <div key={i} className="flex items-center gap-3 py-2" style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: hasInteraction ? 'rgba(251,191,36,0.04)' : 'transparent',
                  }}>
                    {hasInteraction && <span style={{ fontSize: '10px', color: 'var(--color-amber)' }}>⚠</span>}
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', flex: 1 }}>{m.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {m.dosage} · {m.frequency}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          {done && (
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => navigate('/attest')}
                className="flex-1 py-3 transition-all duration-200"
                style={{
                  background: 'var(--color-gold)', color: '#0A0A0F',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.15em', fontWeight: 600,
                  border: 'none', borderRadius: '2px', cursor: 'pointer',
                }}>
                PROCEED TO ATTESTATION
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Documents (25%) */}
      <div className="w-1/4 flex flex-col">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>DOCUMENTS</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {uploadedFiles.map((file, i) => {
            const ext = extractions.find(e => e.filename === file.name);
            const processing = running && !ext;
            const complete = !!ext && !ext.error;
            return (
              <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '1px', flexShrink: 0,
                  background: complete ? 'var(--color-emerald)' : processing ? 'var(--color-gold)' : 'var(--color-text-dim)',
                  boxShadow: processing ? '0 0 6px var(--color-gold)' : 'none',
                }} className={processing ? 'pulse-gold' : ''} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                {complete && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-emerald)' }}>✓</span>}
              </div>
            );
          })}

          {/* Family History Summary */}
          {familyHistory.members.length > 0 && (
            <div className="mt-6">
              <h4 className="agent-name mb-2" style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>FAMILY HISTORY</h4>
              {familyHistory.members.map((m, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {m.relation}: {m.conditions.join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
