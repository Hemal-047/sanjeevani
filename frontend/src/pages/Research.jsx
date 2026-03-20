import { useState, useEffect, useRef } from 'react';
import { searchResearcher, triggerAutoMatch } from '../services/api';
import { sendTrialInvitation, requestDataPurchase, switchToBaseSepolia, txLink } from '../services/wallet';

const CONDITION_OPTIONS = [
  'Type 2 Diabetes', 'Pre-diabetes', 'Hypertension', 'Dyslipidemia',
  'Coronary Artery Disease', 'Metabolic Syndrome', 'Chronic Kidney Disease',
  'COPD', 'Asthma', 'Depression', 'Alzheimer\'s Disease', 'Cancer',
];

export default function Research() {
  const [criteria, setCriteria] = useState({
    conditions: [],
    severityMin: 2,
    confidenceMin: 70,
    ageRange: [18, 80],
    additionalRequirements: '',
  });
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [expandedType, setExpandedType] = useState(null);
  const [inviteForm, setInviteForm] = useState({ studyName: '', description: '', compensation: '0.001' });
  const [purchaseForm, setPurchaseForm] = useState({ dataRequested: '', price: '0.001' });
  const [txStatus, setTxStatus] = useState({});
  const [autoMatchEnabled, setAutoMatchEnabled] = useState(false);
  const [autoMatchResults, setAutoMatchResults] = useState([]);
  const [autoMatchLastRun, setAutoMatchLastRun] = useState(null);
  const [autoMatchSearching, setAutoMatchSearching] = useState(false);
  const autoMatchInterval = useRef(null);

  // Mock attestations for demo (supplements onchain data)
  const mockAttestations = [
    { attestationId: 1, conditionCode: 'R73.03', conditionName: 'Pre-diabetes', severity: 'high', confidence: 90, evidenceSummary: 'Fasting glucose 126, HbA1c 6.4%', userAge: 42 },
    { attestationId: 2, conditionCode: 'E78.5', conditionName: 'Dyslipidemia', severity: 'high', confidence: 95, evidenceSummary: 'LDL 148, HDL 39, Triglycerides 205', userAge: 42 },
    { attestationId: 3, conditionCode: 'E11', conditionName: 'Type 2 Diabetes', severity: 'high', confidence: 95, evidenceSummary: 'HbA1c 7.8%, on metformin + glipizide', userAge: 51 },
    { attestationId: 4, conditionCode: 'I10', conditionName: 'Essential Hypertension', severity: 'moderate', confidence: 88, evidenceSummary: 'BP 145/92, on amlodipine', userAge: 60 },
    { attestationId: 5, conditionCode: 'R73.03', conditionName: 'Pre-diabetes', severity: 'moderate', confidence: 75, evidenceSummary: 'Fasting glucose 108, single reading', userAge: 38 },
  ];

  // Auto-match polling
  useEffect(() => {
    if (!autoMatchEnabled) {
      if (autoMatchInterval.current) clearInterval(autoMatchInterval.current);
      return;
    }
    async function runAutoMatch() {
      if (criteria.conditions.length === 0) return;
      setAutoMatchSearching(true);
      try {
        const res = await triggerAutoMatch(criteria, mockAttestations);
        setAutoMatchResults(res.matches || []);
        setAutoMatchLastRun(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch { /* silent */ }
      setAutoMatchSearching(false);
    }
    runAutoMatch();
    autoMatchInterval.current = setInterval(runAutoMatch, 30000);
    return () => clearInterval(autoMatchInterval.current);
  }, [autoMatchEnabled, criteria.conditions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAutoMatch() {
    if (autoMatchEnabled) {
      setAutoMatchEnabled(false);
      setAutoMatchResults([]);
      setAutoMatchLastRun(null);
      triggerAutoMatch(null, null, false).catch(() => {});
    } else {
      setAutoMatchEnabled(true);
    }
  }

  async function handleSearch() {
    setSearching(true);
    setResults(null);
    try {
      const res = await searchResearcher(criteria, mockAttestations);
      setResults(res.data || res);
    } catch (err) {
      console.error(err);
    }
    setSearching(false);
  }

  function toggleCondition(c) {
    setCriteria(prev => ({
      ...prev,
      conditions: prev.conditions.includes(c) ? prev.conditions.filter(x => x !== c) : [...prev.conditions, c],
    }));
  }

  async function handleInvite(attestationId) {
    const key = `invite_${attestationId}`;
    setTxStatus(prev => ({ ...prev, [key]: { status: 'pending', message: 'Confirm in wallet...' } }));
    try {
      await switchToBaseSepolia();
      const result = await sendTrialInvitation(attestationId, inviteForm.studyName, inviteForm.description, inviteForm.compensation);
      setTxStatus(prev => ({
        ...prev,
        [key]: { status: 'success', message: 'Invitation sent!', hash: result.tx.hash },
      }));
    } catch (err) {
      setTxStatus(prev => ({
        ...prev,
        [key]: { status: 'error', message: err.message },
      }));
    }
  }

  async function handlePurchase(attestationId) {
    const key = `purchase_${attestationId}`;
    setTxStatus(prev => ({ ...prev, [key]: { status: 'pending', message: 'Confirm in wallet...' } }));
    try {
      await switchToBaseSepolia();
      const result = await requestDataPurchase(attestationId, purchaseForm.dataRequested, purchaseForm.price);
      setTxStatus(prev => ({
        ...prev,
        [key]: { status: 'success', message: 'Purchase request sent!', hash: result.tx.hash },
      }));
    } catch (err) {
      setTxStatus(prev => ({
        ...prev,
        [key]: { status: 'error', message: err.message },
      }));
    }
  }

  function TxStatusDisplay({ txKey }) {
    const s = txStatus[txKey];
    if (!s) return null;
    const color = s.status === 'success' ? 'var(--color-emerald)' : s.status === 'pending' ? 'var(--color-gold)' : 'var(--color-critical)';
    return (
      <div style={{ marginTop: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color }}>
          {s.status === 'pending' && '⏳ '}{s.status === 'success' && '✓ '}{s.status === 'error' && '✗ '}
          {s.message}
        </span>
        {s.hash && (
          <a href={txLink(s.hash)} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-emerald)', marginLeft: '8px', textDecoration: 'none' }}>
            {s.hash.slice(0, 16)}...
          </a>
        )}
      </div>
    );
  }

  const matches = results?.matches || [];

  return (
    <div className="pt-14 flex" style={{ maxWidth: '1440px', margin: '0 auto', height: '100vh' }}>
      {/* Left: Search Filters (35%) */}
      <div className="p-6 overflow-y-auto" style={{ width: '35%', height: 'calc(100vh - 56px)', borderRight: '1px solid var(--color-border)', paddingTop: '24px' }}>
        <h3 className="agent-name mb-6" style={{ fontSize: '12px', color: 'var(--color-gold)' }}>
          SETU — PATIENT SEARCH
        </h3>

        {/* Conditions */}
        <div className="mb-6">
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '8px', letterSpacing: '0.1em' }}>
            CONDITIONS
          </label>
          <div className="flex flex-wrap gap-1">
            {CONDITION_OPTIONS.map(c => (
              <button key={c}
                onClick={() => toggleCondition(c)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  padding: '3px 8px', borderRadius: '1px', cursor: 'pointer',
                  background: criteria.conditions.includes(c) ? 'var(--color-gold-faint)' : 'var(--color-surface)',
                  color: criteria.conditions.includes(c) ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                  border: `1px solid ${criteria.conditions.includes(c) ? 'var(--color-gold)' : 'var(--color-border)'}`,
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence Slider */}
        <div className="mb-6">
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '8px', letterSpacing: '0.1em' }}>
            MIN CONFIDENCE: <span style={{ color: 'var(--color-gold)' }}>{criteria.confidenceMin}%</span>
          </label>
          <input type="range" min="50" max="100" value={criteria.confidenceMin}
            onChange={e => setCriteria(prev => ({ ...prev, confidenceMin: parseInt(e.target.value) }))} />
        </div>

        {/* Severity */}
        <div className="mb-6">
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '8px', letterSpacing: '0.1em' }}>
            MIN SEVERITY
          </label>
          <div className="flex gap-2">
            {[{ label: 'Low', val: 1 }, { label: 'Moderate', val: 2 }, { label: 'High', val: 3 }, { label: 'Critical', val: 4 }].map(s => (
              <button key={s.val}
                onClick={() => setCriteria(prev => ({ ...prev, severityMin: s.val }))}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  padding: '3px 8px', borderRadius: '1px', cursor: 'pointer',
                  background: criteria.severityMin === s.val ? 'var(--color-gold-faint)' : 'var(--color-surface)',
                  color: criteria.severityMin === s.val ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                  border: `1px solid ${criteria.severityMin === s.val ? 'var(--color-gold)' : 'var(--color-border)'}`,
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Age Range */}
        <div className="mb-6">
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '8px', letterSpacing: '0.1em' }}>
            AGE RANGE
          </label>
          <div className="flex items-center gap-2">
            <input type="number" value={criteria.ageRange[0]} min="0" max="120" className="w-16"
              onChange={e => setCriteria(prev => ({ ...prev, ageRange: [parseInt(e.target.value), prev.ageRange[1]] }))} />
            <span style={{ color: 'var(--color-text-dim)' }}>—</span>
            <input type="number" value={criteria.ageRange[1]} min="0" max="120" className="w-16"
              onChange={e => setCriteria(prev => ({ ...prev, ageRange: [prev.ageRange[0], parseInt(e.target.value)] }))} />
          </div>
        </div>

        {/* Additional Requirements */}
        <div className="mb-6">
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '8px', letterSpacing: '0.1em' }}>
            ADDITIONAL REQUIREMENTS
          </label>
          <textarea
            value={criteria.additionalRequirements}
            onChange={e => setCriteria(prev => ({ ...prev, additionalRequirements: e.target.value }))}
            rows={3}
            className="w-full"
            placeholder="e.g. progressive glycemic deterioration, comorbid dyslipidemia..."
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={criteria.conditions.length === 0 || searching}
          className="w-full py-3 transition-all duration-200"
          style={{
            background: criteria.conditions.length > 0 && !searching ? 'var(--color-gold)' : 'var(--color-surface)',
            color: criteria.conditions.length > 0 && !searching ? '#0A0A0F' : 'var(--color-text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.15em', fontWeight: 600,
            border: 'none', borderRadius: '2px',
            cursor: criteria.conditions.length > 0 && !searching ? 'pointer' : 'not-allowed',
          }}>
          {searching ? 'SEARCHING...' : 'SEARCH'}
        </button>
      </div>

      {/* Right: Results (65%) */}
      <div className="p-6 overflow-y-auto" style={{ width: '65%', height: 'calc(100vh - 56px)', paddingTop: '24px' }}>
        {/* SETU Auto-Match Section */}
        <div className="mb-6 slide-in" style={{
          background: 'var(--color-surface)', border: `1px solid ${autoMatchEnabled ? 'var(--color-gold)' : 'var(--color-border)'}`,
          borderRadius: '2px', padding: '16px',
        }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-gold)', margin: 0 }}>SETU AUTO-MATCH</h3>
              {autoMatchEnabled && (
                <span className="pulse-gold" style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-gold)',
                  display: 'inline-block',
                }} />
              )}
              {autoMatchEnabled && autoMatchLastRun && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)' }}>
                  last scan: {autoMatchLastRun}
                </span>
              )}
            </div>
            <div className={`toggle-track ${autoMatchEnabled ? 'active' : ''}`} onClick={toggleAutoMatch} style={{ cursor: 'pointer' }}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-dim)', margin: 0, lineHeight: '1.5' }}>
            {autoMatchEnabled
              ? `Autonomous search active — scanning every 30s with current criteria. ${autoMatchResults.length} match${autoMatchResults.length !== 1 ? 'es' : ''} found.`
              : 'Enable to let SETU autonomously scan for matching patients using your current criteria.'}
          </p>
          {autoMatchEnabled && autoMatchSearching && (
            <div style={{ marginTop: '8px' }}>
              <span className="pulse-gold" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-gold)' }}>
                scanning...
              </span>
            </div>
          )}
          {autoMatchEnabled && autoMatchResults.length > 0 && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
              {autoMatchResults.slice(0, 3).map((m, i) => {
                const attestation = mockAttestations.find(a => a.attestationId === m.attestationId);
                return (
                  <div key={i} className="flex items-center gap-3" style={{ padding: '4px 0' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text)', flex: 1 }}>
                      {attestation?.conditionName || `#${m.attestationId}`}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-gold)' }}>
                      {m.matchScore}
                    </span>
                  </div>
                );
              })}
              {autoMatchResults.length > 3 && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '4px' }}>
                  +{autoMatchResults.length - 3} more
                </p>
              )}
            </div>
          )}
        </div>

        {!results ? (
          <div className="flex items-center justify-center h-full">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-dim)' }}>
              Configure search criteria and run a search
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="agent-name" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                MATCHED PATIENTS
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-dim)' }}>
                {results.totalMatches || matches.length} match{(results.totalMatches || matches.length) !== 1 ? 'es' : ''}
              </span>
            </div>

            {results.searchSummary && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                {results.searchSummary}
              </p>
            )}

            {matches.map((m, i) => {
              const attestation = mockAttestations.find(a => a.attestationId === m.attestationId);
              const isExpanded = expandedRow === i;

              return (
                <div key={i} className="mb-2 slide-in" style={{
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: '2px', animationDelay: `${i * 80}ms`,
                }}>
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                            {attestation?.conditionName || `Attestation #${m.attestationId}`}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', border: '1px solid var(--color-border)', borderRadius: '1px' }}>
                            #{m.attestationId}
                          </span>
                        </div>
                        {m.matchReasons && (
                          <div className="mt-1">
                            {m.matchReasons.map((r, ri) => (
                              <span key={ri} style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-dim)', display: 'block' }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Confidence bar */}
                      <div className="flex items-center gap-2" style={{ minWidth: '80px' }}>
                        <div style={{ flex: 1, height: '2px', background: 'var(--color-border)', position: 'relative' }}>
                          <div style={{
                            position: 'absolute', top: 0, left: 0, height: '100%',
                            width: `${attestation?.confidence || 0}%`,
                            background: 'var(--color-emerald)', borderRadius: '1px',
                          }} />
                        </div>
                      </div>

                      {/* Match score */}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-gold)', fontWeight: 600, minWidth: '36px', textAlign: 'right' }}>
                        {m.matchScore}
                      </span>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setExpandedRow(isExpanded && expandedType === 'invite' ? null : i); setExpandedType('invite'); }}
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-gold)',
                            background: 'none', border: '1px solid var(--color-gold)', padding: '2px 8px',
                            borderRadius: '1px', cursor: 'pointer', letterSpacing: '0.05em',
                          }}>
                          INVITE
                        </button>
                        <button
                          onClick={() => { setExpandedRow(isExpanded && expandedType === 'purchase' ? null : i); setExpandedType('purchase'); }}
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)',
                            background: 'none', border: '1px solid var(--color-border)', padding: '2px 8px',
                            borderRadius: '1px', cursor: 'pointer', letterSpacing: '0.05em',
                          }}>
                          DATA
                        </button>
                      </div>
                    </div>

                    {/* Gaps */}
                    {m.gaps && m.gaps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.gaps.map((g, gi) => (
                          <span key={gi} style={{
                            fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-amber)',
                            background: 'rgba(251,191,36,0.06)', padding: '1px 6px',
                            border: '1px solid rgba(251,191,36,0.12)', borderRadius: '1px',
                          }}>gap: {g}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline invite form */}
                  {isExpanded && expandedType === 'invite' && (
                    <div className="px-4 pb-3 pt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <div className="space-y-2">
                        <input type="text" placeholder="Study name" value={inviteForm.studyName}
                          onChange={e => setInviteForm(prev => ({ ...prev, studyName: e.target.value }))}
                          className="w-full" />
                        <input type="text" placeholder="Brief description" value={inviteForm.description}
                          onChange={e => setInviteForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full" />
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="ETH" value={inviteForm.compensation}
                            onChange={e => setInviteForm(prev => ({ ...prev, compensation: e.target.value }))}
                            className="w-24" />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)' }}>ETH compensation</span>
                          <button
                            onClick={() => handleInvite(m.attestationId)}
                            disabled={txStatus[`invite_${m.attestationId}`]?.status === 'pending'}
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#0A0A0F',
                              background: 'var(--color-gold)', border: 'none', padding: '4px 12px',
                              borderRadius: '1px', cursor: 'pointer', marginLeft: 'auto', letterSpacing: '0.05em',
                              opacity: txStatus[`invite_${m.attestationId}`]?.status === 'pending' ? 0.5 : 1,
                            }}>
                            {txStatus[`invite_${m.attestationId}`]?.status === 'pending' ? 'SENDING...' : 'SEND'}
                          </button>
                        </div>
                        <TxStatusDisplay txKey={`invite_${m.attestationId}`} />
                      </div>
                    </div>
                  )}

                  {/* Inline purchase form */}
                  {isExpanded && expandedType === 'purchase' && (
                    <div className="px-4 pb-3 pt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <div className="space-y-2">
                        <input type="text" placeholder="What data do you need?" value={purchaseForm.dataRequested}
                          onChange={e => setPurchaseForm(prev => ({ ...prev, dataRequested: e.target.value }))}
                          className="w-full" />
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="ETH" value={purchaseForm.price}
                            onChange={e => setPurchaseForm(prev => ({ ...prev, price: e.target.value }))}
                            className="w-24" />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)' }}>ETH offered</span>
                          <button
                            onClick={() => handlePurchase(m.attestationId)}
                            disabled={txStatus[`purchase_${m.attestationId}`]?.status === 'pending'}
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#0A0A0F',
                              background: 'var(--color-gold)', border: 'none', padding: '4px 12px',
                              borderRadius: '1px', cursor: 'pointer', marginLeft: 'auto', letterSpacing: '0.05em',
                              opacity: txStatus[`purchase_${m.attestationId}`]?.status === 'pending' ? 0.5 : 1,
                            }}>
                            {txStatus[`purchase_${m.attestationId}`]?.status === 'pending' ? 'SENDING...' : 'SEND'}
                          </button>
                        </div>
                        <TxStatusDisplay txKey={`purchase_${m.attestationId}`} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
