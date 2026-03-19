import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { analyzeComprehensive, prepareAttestations } from '../services/api';

function RiskRing({ score, size = 160, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  const color = score >= 70 ? 'var(--color-critical)' : score >= 40 ? 'var(--color-amber)' : 'var(--color-emerald)';

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedOffset(circumference - (score / 100) * circumference);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
      </svg>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color, lineHeight: 1 }}>
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
  const w = 80;
  const h = 30;
  const points = nums.map((v, i) => `${(i / (nums.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  const color = concern ? 'var(--color-critical)' : 'var(--color-emerald)';

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        {nums.map((v, i) => (
          <circle key={i} cx={(i / (nums.length - 1)) * w} cy={h - ((v - min) / range) * (h - 4) - 2} r="2.5" fill={color} />
        ))}
      </svg>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color, fontWeight: 600 }}>
        {direction === 'rising' ? '↑' : direction === 'falling' ? '↓' : '→'}
      </span>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const config = {
    low: { color: 'var(--color-emerald)', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
    moderate: { color: 'var(--color-amber)', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
    high: { color: 'var(--color-critical)', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
    critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.2)' },
  };
  const c = config[severity] || config.moderate;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em',
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: '2px 8px', borderRadius: '1px', textTransform: 'uppercase',
    }}>
      {severity}
    </span>
  );
}

function SkeletonBlock({ width, height, style = {} }) {
  return <div className="skeleton" style={{ width, height, borderRadius: '2px', ...style }} />;
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
  const [phase, setPhase] = useState('idle'); // idle, drishti, bodhi, mudra, complete
  const logRef = useRef(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agentLog]);

  useEffect(() => {
    if (uploadedFiles.length === 0) return;
    if (hasRun.current) return;
    hasRun.current = true;
    runAnalysis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAnalysis() {
    setRunning(true);
    setPhase('drishti');

    addLogEntry({ agent: 'DRISHTI', action: 'Initializing document intelligence...', type: 'start' });

    // Log each file once
    for (let i = 0; i < uploadedFiles.length; i++) {
      await new Promise(r => setTimeout(r, 200));
      addLogEntry({ agent: 'DRISHTI', action: `Reading ${uploadedFiles[i].name}...`, type: 'progress' });
    }

    try {
      const fh = familyHistory.members.length > 0 ? familyHistory : null;
      const result = await analyzeComprehensive(uploadedFiles, fh);

      if (result.success || result.extractions) {
        const exts = result.extractions || [];
        setExtractions(exts);

        addLogEntry({
          agent: 'DRISHTI',
          action: `Extracted data from ${exts.length} document${exts.length !== 1 ? 's' : ''}`,
          type: 'complete',
        });

        // Bodhi analysis
        if (result.analysis) {
          setPhase('bodhi');
          const analysis = result.analysis;

          // Log reasoning chain steps with delays
          if (analysis.reasoningChain) {
            for (let i = 0; i < analysis.reasoningChain.length; i++) {
              await new Promise(r => setTimeout(r, 300));
              const step = analysis.reasoningChain[i];
              addLogEntry({
                agent: 'BODHI',
                action: `${step.title}: ${step.summary}`,
                type: i === analysis.reasoningChain.length - 1 ? 'complete' : 'progress',
              });
            }
          }

          setBodhiAnalysis(analysis);

          // Prepare Mudra attestations
          if (analysis.synthesis) {
            setPhase('mudra');
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
          }
        }
      } else {
        addLogEntry({ agent: 'SYSTEM', action: 'Analysis failed — check uploaded files', type: 'error' });
      }
    } catch (err) {
      addLogEntry({ agent: 'SYSTEM', action: `Error: ${err.message}`, type: 'error' });
    }

    setPhase('complete');
    setDone(true);
    setRunning(false);
  }

  const synthesis = bodhiAnalysis?.synthesis || {};
  const conditions = synthesis.conditions || [];
  const trends = synthesis.trends || [];
  const drugInteractions = synthesis.drugInteractions || [];
  const medications = extractions.flatMap(e => e.medications || []);
  const hasScore = synthesis.overallRiskScore != null;
  const hasConditions = conditions.length > 0;
  const hasTrends = trends.length > 0;
  const hasMeds = medications.length > 0;

  return (
    <div className="pt-14 h-screen" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 1fr',
        gap: '0',
        height: 'calc(100vh - 56px)',
      }}>
        {/* LEFT: Agent Log (25%) */}
        <div className="flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>AGENT LOG</h3>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            {agentLog.map((entry, i) => {
              const prevAgent = i > 0 ? agentLog[i - 1].agent : null;
              const showSeparator = prevAgent && prevAgent !== entry.agent;
              const isActive = running && i === agentLog.length - 1 && entry.type !== 'complete';
              return (
                <div key={i}>
                  {showSeparator && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1" style={{ height: '1px', background: 'var(--color-border)' }} />
                      <span style={{ color: 'var(--color-gold)', fontSize: '10px', letterSpacing: '0.15em' }}>{entry.agent}</span>
                      <div className="flex-1" style={{ height: '1px', background: 'var(--color-border)' }} />
                    </div>
                  )}
                  <div className="py-1 slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-start gap-2">
                      {entry.type === 'complete' ? (
                        <span style={{ color: 'var(--color-emerald)', fontSize: '8px', marginTop: '3px' }}>●</span>
                      ) : entry.type === 'error' ? (
                        <span style={{ color: 'var(--color-critical)', fontSize: '8px', marginTop: '3px' }}>●</span>
                      ) : (
                        <span className={isActive ? 'pulse-gold' : ''} style={{ color: 'var(--color-gold)', fontSize: '8px', marginTop: '3px' }}>●</span>
                      )}
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <span style={{ color: 'var(--color-text-dim)', marginRight: '6px' }}>
                          {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ color: 'var(--color-gold)' }}>{entry.agent}</span>
                        <div style={{ color: entry.type === 'complete' ? 'var(--color-emerald)' : entry.type === 'error' ? 'var(--color-critical)' : 'var(--color-text-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
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
        <div className="flex flex-col overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
          <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>HEALTH PROFILE</h3>
          </div>
          <div className="px-6 py-6 flex-1">
            {/* Risk Score */}
            <div className="flex items-center justify-center mb-8">
              {hasScore ? (
                <div className="slide-up" style={{ animationDelay: '0ms' }}>
                  <RiskRing score={synthesis.overallRiskScore} />
                  <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '8px', letterSpacing: '0.1em' }}>
                    RISK SCORE
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <SkeletonBlock width="160px" height="160px" style={{ borderRadius: '80px' }} />
                  <SkeletonBlock width="80px" height="12px" />
                </div>
              )}
            </div>

            {/* Conditions */}
            {hasConditions ? (
              <div className="mb-8 slide-up" style={{ animationDelay: '200ms' }}>
                <h4 className="agent-name mb-3" style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>CONDITIONS DETECTED</h4>
                {conditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 slide-up"
                    style={{ borderBottom: '1px solid var(--color-border)', animationDelay: `${300 + i * 150}ms` }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>{c.name}</span>
                    <div className="flex items-center gap-3" style={{ minWidth: '180px' }}>
                      <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', position: 'relative', borderRadius: '2px' }}>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, height: '100%',
                          width: `${c.confidence}%`, borderRadius: '2px',
                          background: c.severity === 'critical' ? '#DC2626' : c.severity === 'high' ? 'var(--color-critical)' : c.severity === 'moderate' ? 'var(--color-amber)' : 'var(--color-emerald)',
                          transition: 'width 1s ease-out',
                        }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '32px', textAlign: 'right' }}>
                        {c.confidence}%
                      </span>
                      <SeverityBadge severity={c.severity} />
                    </div>
                  </div>
                ))}
              </div>
            ) : !done && (
              <div className="mb-8">
                <SkeletonBlock width="140px" height="12px" style={{ marginBottom: '16px' }} />
                {[1, 2, 3].map(i => (
                  <SkeletonBlock key={i} width="100%" height="40px" style={{ marginBottom: '8px' }} />
                ))}
              </div>
            )}

            {/* Trends */}
            {hasTrends ? (
              <div className="mb-8 slide-up" style={{ animationDelay: '600ms' }}>
                <h4 className="agent-name mb-3" style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>BIOMARKER TRENDS</h4>
                {trends.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 slide-up" style={{ borderBottom: '1px solid var(--color-border)', animationDelay: `${700 + i * 100}ms` }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>{t.biomarker}</span>
                    <Sparkline values={t.values} direction={t.direction} concern={t.concern} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', minWidth: '70px', textAlign: 'right' }}>
                      {t.values?.join(' → ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : !done && (
              <div className="mb-8">
                <SkeletonBlock width="120px" height="12px" style={{ marginBottom: '16px' }} />
                {[1, 2].map(i => (
                  <SkeletonBlock key={i} width="100%" height="36px" style={{ marginBottom: '8px' }} />
                ))}
              </div>
            )}

            {/* Medications & Interactions */}
            {hasMeds && (
              <div className="mb-8 slide-up" style={{ animationDelay: '900ms' }}>
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

            {/* Proceed Button — only after analysis complete */}
            {done && (
              <button
                onClick={() => navigate('/attest')}
                className="w-full py-4 mt-4 transition-all duration-200 slide-up"
                style={{
                  animationDelay: '1100ms',
                  background: 'var(--color-gold)', color: '#0A0A0F',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.15em', fontWeight: 600,
                  border: 'none', borderRadius: '2px', cursor: 'pointer',
                }}>
                PROCEED TO ATTESTATION
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Documents (25%) */}
        <div className="flex flex-col">
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
    </div>
  );
}
