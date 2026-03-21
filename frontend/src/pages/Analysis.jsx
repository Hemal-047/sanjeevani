import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { analyzeComprehensive, prepareAttestations, fetchHealthWatchPrediction, getAgentsStatus } from '../services/api';

/* ── Biomarker grouping ── */
const BIOMARKER_GROUPS = {
  'Glucose & Diabetes': ['Fasting Glucose', 'HbA1c', 'Fasting Blood Sugar', 'Glucose', 'Insulin', 'HOMA-IR', 'Post-Prandial Glucose', 'Random Blood Sugar', 'C-Peptide', 'FBS', 'PPBS', 'Blood Sugar'],
  'Lipids': ['Total Cholesterol', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides', 'VLDL', 'LDL', 'HDL', 'Cholesterol', 'Non-HDL Cholesterol', 'Lp(a)', 'ApoB'],
  'Liver': ['ALT', 'AST', 'ALP', 'Bilirubin', 'GGT', 'Albumin', 'Total Protein', 'Direct Bilirubin', 'Indirect Bilirubin', 'SGPT', 'SGOT', 'Globulin'],
  'Kidney': ['Creatinine', 'BUN', 'Uric Acid', 'eGFR', 'Blood Urea', 'Urea', 'Microalbumin'],
  'Thyroid': ['TSH', 'T3', 'T4', 'Free T3', 'Free T4'],
  'Blood Count': ['Hemoglobin', 'WBC', 'RBC', 'Platelets', 'Hematocrit', 'MCV', 'MCH', 'MCHC', 'ESR'],
};

function groupTrends(trends) {
  const grouped = {};
  const ungrouped = [];
  for (const t of trends) {
    let placed = false;
    for (const [group, markers] of Object.entries(BIOMARKER_GROUPS)) {
      if (markers.some(m => t.biomarker?.toLowerCase().includes(m.toLowerCase()))) {
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(t);
        placed = true;
        break;
      }
    }
    if (!placed) ungrouped.push(t);
  }
  if (ungrouped.length > 0) grouped['Other'] = ungrouped;
  return grouped;
}

/* ── Risk Ring (loaded state) ── */
function RiskRing({ score, size = 160, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  const [displayScore, setDisplayScore] = useState(0);
  const color = score >= 70 ? 'var(--color-critical)' : score >= 40 ? 'var(--color-amber)' : 'var(--color-emerald)';

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedOffset(circumference - (score / 100) * circumference);
    }, 100);
    // Animate score counter
    const duration = 1500;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke="#1a1a2e" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={animatedOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
        </svg>
        <span style={{ fontFamily: "'Instrument Serif', 'Georgia', serif", fontSize: '56px', color, lineHeight: 1 }}>
          {displayScore}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '6px', letterSpacing: '0.15em' }}>
        RISK SCORE
      </p>
    </div>
  );
}

/* ── Empty Risk Ring (loading state) ── */
function EmptyRiskRing({ size = 160, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke="#1a1a2e" strokeWidth={stroke} className="pulse-gold" style={{ opacity: 0.5 }} />
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--color-text-dim)', lineHeight: 1 }}>
          —
        </span>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '6px', letterSpacing: '0.15em' }}>
        RISK SCORE
      </p>
    </div>
  );
}

/* ── Sparkline ── */
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
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" className="sparkline-path" />
      {nums.map((v, i) => (
        <circle key={i} cx={(i / (nums.length - 1)) * w} cy={h - ((v - min) / range) * (h - 4) - 2} r="2.5" fill={color} style={{ opacity: 0, animation: `slideUp 300ms ease-out ${300 + i * 150}ms forwards` }} />
      ))}
    </svg>
  );
}

/* ── Direction Arrow ── */
function DirectionArrow({ direction, concern }) {
  if (direction === 'rising') {
    const color = concern ? 'var(--color-critical)' : 'var(--color-emerald)';
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color, fontWeight: 700 }}>↑</span>;
  }
  if (direction === 'falling') {
    const color = concern ? 'var(--color-critical)' : 'var(--color-emerald)';
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color, fontWeight: 700 }}>↓</span>;
  }
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-text-dim)', fontWeight: 700 }}>→</span>;
}

/* ── Severity helpers ── */
function severityColor(severity) {
  const map = { low: 'var(--color-emerald)', moderate: 'var(--color-amber)', high: 'var(--color-critical)', critical: '#DC2626' };
  return map[severity] || 'var(--color-amber)';
}

function SeverityBadge({ severity }) {
  const c = severityColor(severity);
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em',
      color: c, background: `${c}15`, border: `1px solid ${c}30`,
      padding: '2px 8px', borderRadius: '1px', textTransform: 'uppercase',
    }}>
      {severity}
    </span>
  );
}

/* ── Loading skeleton lines ── */
function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '60%', margin: '0 auto' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton" style={{
          height: '12px', borderRadius: '6px',
          width: `${70 - i * 8}%`,
        }} />
      ))}
    </div>
  );
}

/* ── Collapsible Group ── */
function BiomarkerGroup({ title, trends: groupTrends }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ marginBottom: '12px' }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-gold)', letterSpacing: '0.1em' }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)' }}>
          ({groupTrends.length})
        </span>
      </button>
      {expanded && groupTrends.map((t, i) => (
        <div key={i} className="flex items-center gap-3 slide-up" style={{
          padding: '8px 0 8px 16px',
          borderBottom: '1px solid var(--color-border)',
          animationDelay: `${i * 60}ms`,
        }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', flex: 1, minWidth: 0 }}>{t.biomarker}</span>
          {t.values && t.values.length >= 2 && (
            <Sparkline values={t.values} direction={t.direction} concern={t.concern} />
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '50px', textAlign: 'right' }}>
            {t.values ? t.values[t.values.length - 1] : '—'}
          </span>
          <DirectionArrow direction={t.direction} concern={t.concern} />
        </div>
      ))}
    </div>
  );
}

/* ── BODHI Health Watch (Real Venice-powered prediction) ── */
function BodhiHealthWatch({ synthesis }) {
  const [watchActive, setWatchActive] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function toggleWatch() {
    if (watchActive) {
      setWatchActive(false);
      setPrediction(null);
      return;
    }
    setWatchActive(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHealthWatchPrediction(synthesis);
      if (res.success && res.data) {
        setPrediction({ ...res.data, timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
      } else {
        setError(res.data?.message || 'Prediction failed');
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const urgencyColor = prediction?.urgency === 'critical' ? '#DC2626'
    : prediction?.urgency === 'high' ? 'var(--color-critical)'
    : prediction?.urgency === 'moderate' ? 'var(--color-amber)'
    : 'var(--color-emerald)';

  return (
    <div className="slide-up" style={{
      marginBottom: '32px', animationDelay: '1100ms',
      background: 'var(--color-surface)',
      border: `1px solid ${watchActive ? 'var(--color-gold)' : 'var(--color-border)'}`,
      borderRadius: '2px', padding: '16px',
    }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h4 className="agent-name" style={{ fontSize: '10px', color: 'var(--color-gold)', margin: 0 }}>BODHI HEALTH WATCH</h4>
          {watchActive && !loading && (
            <span className="pulse-gold" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-gold)', display: 'inline-block' }} />
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)', letterSpacing: '0.1em' }}>
            {loading ? 'QUERYING VENICE AI...' : 'AUTONOMOUS MONITORING'}
          </span>
        </div>
        <div className={`toggle-track ${watchActive ? 'active' : ''}`} onClick={toggleWatch} style={{ cursor: loading ? 'wait' : 'pointer' }}>
          <div className="toggle-thumb" />
        </div>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-dim)', margin: 0, lineHeight: '1.5' }}>
        {!watchActive ? 'Enable to let BODHI generate a real predictive health alert using Venice AI.'
          : loading ? 'Bodhi is analyzing your health trends and generating a 3-6 month projection...'
          : `Prediction generated at ${prediction?.timestamp || 'N/A'}`}
      </p>

      {loading && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '12px', borderRadius: '6px', width: `${80 - i * 12}%` }} />)}
        </div>
      )}

      {error && (
        <div className="slide-up" style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-critical)' }}>{error}</span>
        </div>
      )}

      {prediction && !prediction.error && (
        <div className="slide-up" style={{ marginTop: '12px' }}>
          {/* Urgency badge */}
          <div className="flex items-center gap-2 mb-2">
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: urgencyColor, background: `${urgencyColor}15`, border: `1px solid ${urgencyColor}30`,
              padding: '2px 8px', borderRadius: '1px',
            }}>
              {prediction.urgency} urgency
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)' }}>
              {prediction.timeframe || '3-6 months'}
            </span>
          </div>

          {/* Main prediction */}
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 12px', lineHeight: '1.6' }}>
            {prediction.prediction}
          </p>

          {/* Projected biomarkers */}
          {prediction.projectedBiomarkers && prediction.projectedBiomarkers.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)', letterSpacing: '0.1em' }}>PROJECTED BIOMARKERS</span>
              {prediction.projectedBiomarkers.map((b, i) => (
                <div key={i} className="flex items-center gap-2" style={{ padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text)', flex: 1 }}>{b.biomarker}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{b.currentValue}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: b.concern ? 'var(--color-critical)' : 'var(--color-text-dim)' }}>→</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: b.concern ? 'var(--color-critical)' : 'var(--color-emerald)', fontWeight: 600 }}>{b.projectedValue}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommended actions */}
          {prediction.recommendedActions && prediction.recommendedActions.length > 0 && (
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)', letterSpacing: '0.1em' }}>RECOMMENDED ACTIONS</span>
              {prediction.recommendedActions.map((a, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', padding: '3px 0 3px 12px', borderLeft: '2px solid var(--color-gold-dim)' }}>
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Agent Status Bar ── */
function AgentStatusBar({ running, done }) {
  const [agents, setAgents] = useState([
    { name: 'DRISHTI', status: 'idle' },
    { name: 'BODHI', status: 'idle' },
    { name: 'MUDRA', status: 'idle' },
    { name: 'SETU', status: 'idle' },
  ]);
  const pollRef = useRef(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await getAgentsStatus();
        if (res.success && res.agents) {
          setAgents(res.agents.map(a => ({
            name: a.name,
            status: a.status,
            detail: a.currentFile || (a.currentStep ? `step ${a.currentStep}/5` : null),
          })));
        }
      } catch { /* silent */ }
    }

    // Poll faster during analysis, slower after
    const interval = running ? 2000 : done ? 10000 : 5000;
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, interval);
    return () => clearInterval(pollRef.current);
  }, [running, done]);

  function dotColor(status) {
    if (status === 'idle') return 'var(--color-text-dim)';
    if (status === 'processing' || status === 'analyzing' || status === 'predicting' || status === 'scanning' || status === 'matching') return 'var(--color-gold)';
    if (status === 'watching' || status === 'monitoring' || status === 'ready') return 'var(--color-emerald)';
    if (status === 'error') return 'var(--color-critical)';
    return 'var(--color-text-dim)';
  }

  function statusText(agent) {
    if (agent.status === 'idle') return 'idle';
    if (agent.detail) return `${agent.status} ${agent.detail}`;
    return agent.status;
  }

  return (
    <div className="flex items-center gap-4" style={{
      padding: '8px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.01)',
    }}>
      {agents.map(a => {
        const color = dotColor(a.status);
        const isActive = a.status !== 'idle';
        return (
          <div key={a.name} className="flex items-center gap-2">
            <span className={isActive && a.status !== 'ready' && a.status !== 'watching' && a.status !== 'monitoring' ? 'pulse-gold' : ''} style={{
              width: '5px', height: '5px', borderRadius: '50%', background: color,
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: isActive ? 'var(--color-text)' : 'var(--color-text-dim)', letterSpacing: '0.05em' }}>
              {a.name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--color-text-dim)' }}>
              {statusText(a)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export default function Analysis() {
  const {
    uploadedFiles, familyHistory, extractions, setExtractions,
    bodhiAnalysis, setBodhiAnalysis, mudraResult, setMudraResult,
    agentLog, addLogEntry,
  } = useApp();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
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
    addLogEntry({ agent: 'DRISHTI', action: 'Initializing document intelligence...', type: 'start' });

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
        addLogEntry({ agent: 'DRISHTI', action: `Extracted data from ${exts.length} document${exts.length !== 1 ? 's' : ''}`, type: 'complete' });

        if (result.analysis) {
          const analysis = result.analysis;
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

          if (analysis.synthesis) {
            addLogEntry({ agent: 'MUDRA', action: 'Preparing onchain attestations...', type: 'start' });
            try {
              const mudra = await prepareAttestations(analysis);
              if (mudra.success && mudra.data) {
                setMudraResult(mudra.data);
                addLogEntry({ agent: 'MUDRA', action: `${mudra.data.approvedCount} attestations ready for publishing`, type: 'complete' });
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

    setDone(true);
    setRunning(false);
  }

  const synthesis = bodhiAnalysis?.synthesis || {};
  const conditions = synthesis.conditions || [];
  const trends = synthesis.trends || [];
  const drugInteractions = synthesis.drugInteractions || [];
  const medications = extractions.flatMap(e => e.medications || []);
  const hasScore = synthesis.overallRiskScore != null;
  const groupedTrends = groupTrends(trends);

  return (
    <div className="pt-14 h-screen" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 1fr',
        height: 'calc(100vh - 56px)',
      }}>

        {/* ── LEFT: Agent Log ── */}
        <div className="flex flex-col" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>AGENT LOG</h3>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto" style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            {agentLog.filter(e => e.type !== 'error' || e.agent !== 'SYSTEM').map((entry, i, filteredLog) => {
              const prevAgent = i > 0 ? filteredLog[i - 1].agent : null;
              const showSeparator = prevAgent && prevAgent !== entry.agent;
              const isActive = running && i === agentLog.length - 1 && entry.type !== 'complete';
              return (
                <div key={i}>
                  {showSeparator && (
                    <div className="flex items-center gap-2" style={{ margin: '16px 0' }}>
                      <div className="flex-1" style={{ height: '1px', background: 'var(--color-border)' }} />
                      <span style={{ color: 'var(--color-gold)', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 600 }}>{entry.agent}</span>
                      <div className="flex-1" style={{ height: '1px', background: 'var(--color-border)' }} />
                    </div>
                  )}
                  <div className="slide-up" style={{ padding: '4px 0', animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-start gap-2">
                      {entry.type === 'complete' ? (
                        <span style={{ color: 'var(--color-emerald)', fontSize: '8px', marginTop: '4px' }}>●</span>
                      ) : entry.type === 'error' ? (
                        <span style={{ color: 'var(--color-critical)', fontSize: '8px', marginTop: '4px' }}>●</span>
                      ) : (
                        <span className={isActive ? 'pulse-gold' : ''} style={{ color: 'var(--color-gold)', fontSize: '8px', marginTop: '4px' }}>●</span>
                      )}
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <span style={{ color: 'var(--color-text-dim)', marginRight: '6px' }}>
                          {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ color: '#E2B67F', fontWeight: 600 }}>{entry.agent}</span>
                        <div style={{
                          color: entry.type === 'complete' ? 'var(--color-emerald)' : entry.type === 'error' ? 'var(--color-critical)' : 'var(--color-text-secondary)',
                          marginTop: '2px', wordBreak: 'break-word',
                        }}>
                          {entry.action}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {running && (
              <div style={{ padding: '8px 0' }}>
                <span className="pulse-gold" style={{ color: 'var(--color-gold)' }}>● processing...</span>
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Health Profile ── */}
        <div className="flex flex-col" style={{ borderRight: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>HEALTH PROFILE</h3>
          </div>
          <AgentStatusBar running={running} done={done} />
          <div style={{ padding: '24px', paddingBottom: mudraResult ? '100px' : '24px', flex: 1, overflowY: 'auto' }}>

            {/* Risk Score */}
            <div className="flex items-center justify-center" style={{ marginBottom: '32px' }}>
              {hasScore ? (
                <div className="slide-up"><RiskRing score={synthesis.overallRiskScore} /></div>
              ) : (
                <EmptyRiskRing />
              )}
            </div>

            {/* Loading skeleton */}
            {!hasScore && !done && <LoadingSkeleton />}

            {/* Conditions */}
            {conditions.length > 0 && (
              <div className="slide-up" style={{ marginBottom: '32px', animationDelay: '200ms' }}>
                <h4 className="agent-name" style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '12px' }}>CONDITIONS DETECTED</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {conditions.map((c, i) => (
                    <div key={i} className="slide-up hover-brighten" style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 12px',
                      borderBottom: '1px solid var(--color-border)',
                      borderLeft: `3px solid ${severityColor(c.severity)}`,
                      background: 'rgba(255,255,255,0.02)',
                      animationDelay: `${300 + i * 150}ms`,
                    }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>{c.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', position: 'relative', borderRadius: '3px' }}>
                          <div style={{
                            position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: '3px',
                            width: `${c.confidence}%`,
                            background: severityColor(c.severity),
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
              </div>
            )}

            {/* Biomarker Trends — grouped */}
            {Object.keys(groupedTrends).length > 0 && (
              <div className="slide-up" style={{ marginBottom: '32px', animationDelay: '600ms' }}>
                <h4 className="agent-name" style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '12px' }}>BIOMARKER TRENDS</h4>
                {Object.entries(groupedTrends).map(([group, items]) => (
                  <BiomarkerGroup key={group} title={group} trends={items} />
                ))}
              </div>
            )}

            {/* Medications */}
            {medications.length > 0 && (
              <div className="slide-up" style={{ marginBottom: '32px', animationDelay: '900ms' }}>
                <h4 className="agent-name" style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '12px' }}>MEDICATIONS</h4>
                {medications.map((m, i) => {
                  const hasInteraction = drugInteractions.some(d =>
                    d.drugs?.includes(m.name) || d.description?.includes(m.name)
                  );
                  return (
                    <div key={i} className="flex items-center gap-3" style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--color-border)',
                      borderLeft: hasInteraction ? '3px solid var(--color-amber)' : '3px solid transparent',
                      background: hasInteraction ? 'rgba(251,191,36,0.03)' : 'transparent',
                    }}>
                      {hasInteraction && <span style={{ fontSize: '12px', color: 'var(--color-amber)' }}>⚠</span>}
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', flex: 1 }}>{m.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {m.dosage} · {m.frequency}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BODHI Health Watch — Real Venice-powered Prediction */}
            {done && hasScore && <BodhiHealthWatch synthesis={synthesis} />}

            {/* Drishti Auto-Sync — Roadmap Hint */}
            {done && hasScore && (
              <div className="slide-up" style={{
                marginTop: '16px',
                border: '1px dashed var(--color-border)',
                borderRadius: '2px',
                padding: '14px 16px',
                opacity: 0.55,
              }}>
                <h4 style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
                  color: 'var(--color-text-dim)', margin: '0 0 8px 0',
                }}>
                  DRISHTI AUTO-SYNC — Coming Soon
                </h4>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: '11px', lineHeight: '1.6',
                  color: 'var(--color-text-dim)', margin: 0,
                }}>
                  Connect health data sources (ABDM, Apple Health, Google Health Connect, EHR systems) for continuous autonomous monitoring.
                  Drishti fetches new documents automatically. Bodhi re-analyzes on every change. Mudra updates attestations. Zero human intervention required.
                </p>
              </div>
            )}
          </div>

          {/* Sticky Proceed Button — only after Mudra completes */}
          {mudraResult && (
            <div style={{
              position: 'sticky', bottom: 0,
              background: '#0A0A0F',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '16px 24px',
            }}>
              <div style={{
                position: 'absolute', top: '-24px', left: 0, right: 0, height: '24px',
                background: 'linear-gradient(to bottom, transparent, #0A0A0F)',
                pointerEvents: 'none',
              }} />
              <button
                onClick={() => navigate('/attest')}
                className="w-full py-4 transition-all duration-200 slide-up"
                style={{
                  background: 'var(--color-gold)', color: '#0A0A0F',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.15em', fontWeight: 600,
                  border: 'none', borderRadius: '2px', cursor: 'pointer',
                }}>
                PROCEED TO ATTESTATION
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Documents + Family History ── */}
        <div className="flex flex-col" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>DOCUMENTS ANALYZED</h3>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: '8px 16px' }}>
            {uploadedFiles.map((file, i) => {
              const ext = extractions.find(e => e.filename === file.name) || extractions[i];
              const complete = done || (!!ext && !ext.error);
              const processing = running && !complete;
              return (
                <div key={i} className="flex items-center gap-2" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  {complete ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                      <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-emerald)" strokeWidth="1.5" />
                      <path d="M4 7l2 2 4-4" fill="none" stroke="var(--color-emerald)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '1px', flexShrink: 0,
                      background: processing ? 'var(--color-gold)' : 'var(--color-text-dim)',
                      boxShadow: processing ? '0 0 6px var(--color-gold)' : 'none',
                    }} className={processing ? 'pulse-gold' : ''} />
                  )}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                </div>
              );
            })}

            {/* Family History */}
            {familyHistory.members.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h4 className="agent-name" style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '8px' }}>FAMILY HISTORY</h4>
                {familyHistory.members.map((m, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text)' }}>{m.relation}</span>: {m.conditions.join(', ')}
                    {m.ageOfOnset && <span style={{ color: 'var(--color-text-dim)' }}> (onset: {m.ageOfOnset})</span>}
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
