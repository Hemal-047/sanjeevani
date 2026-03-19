import { useState } from 'react';
import { searchResearcher } from '../services/api';
import { sendTrialInvitation, requestDataPurchase } from '../services/wallet';

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
  const [inviteForm, setInviteForm] = useState({ studyName: '', description: '', compensation: '0.01' });
  const [purchaseForm, setPurchaseForm] = useState({ dataRequested: '', price: '0.01' });
  const [txStatus, setTxStatus] = useState({});

  // Mock attestations for demo (in production, query from contract)
  const mockAttestations = [
    { attestationId: 1, conditionCode: 'R73.03', conditionName: 'Pre-diabetes', severity: 'high', confidence: 90, evidenceSummary: 'Fasting glucose 126, HbA1c 6.4%', userAge: 42 },
    { attestationId: 2, conditionCode: 'E78.5', conditionName: 'Dyslipidemia', severity: 'high', confidence: 95, evidenceSummary: 'LDL 148, HDL 39, Triglycerides 205', userAge: 42 },
    { attestationId: 3, conditionCode: 'E11', conditionName: 'Type 2 Diabetes', severity: 'high', confidence: 95, evidenceSummary: 'HbA1c 7.8%, on metformin + glipizide', userAge: 51 },
    { attestationId: 4, conditionCode: 'I10', conditionName: 'Essential Hypertension', severity: 'moderate', confidence: 88, evidenceSummary: 'BP 145/92, on amlodipine', userAge: 60 },
    { attestationId: 5, conditionCode: 'R73.03', conditionName: 'Pre-diabetes', severity: 'moderate', confidence: 75, evidenceSummary: 'Fasting glucose 108, single reading', userAge: 38 },
  ];

  async function handleSearch() {
    setSearching(true);
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
    setTxStatus(prev => ({ ...prev, [`invite_${attestationId}`]: 'pending' }));
    try {
      await sendTrialInvitation(attestationId, inviteForm.studyName, inviteForm.description, inviteForm.compensation);
      setTxStatus(prev => ({ ...prev, [`invite_${attestationId}`]: 'success' }));
    } catch (err) {
      setTxStatus(prev => ({ ...prev, [`invite_${attestationId}`]: `error: ${err.message}` }));
    }
  }

  async function handlePurchase(attestationId) {
    setTxStatus(prev => ({ ...prev, [`purchase_${attestationId}`]: 'pending' }));
    try {
      await requestDataPurchase(attestationId, purchaseForm.dataRequested, purchaseForm.price);
      setTxStatus(prev => ({ ...prev, [`purchase_${attestationId}`]: 'success' }));
    } catch (err) {
      setTxStatus(prev => ({ ...prev, [`purchase_${attestationId}`]: `error: ${err.message}` }));
    }
  }

  const matches = results?.matches || [];

  return (
    <div className="pt-14 min-h-screen flex" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Left: Search Filters (35%) */}
      <div className="w-[35%] p-6 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
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
      <div className="flex-1 p-6 overflow-y-auto">
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

                  {/* Inline forms */}
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
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#0A0A0F',
                              background: 'var(--color-gold)', border: 'none', padding: '4px 12px',
                              borderRadius: '1px', cursor: 'pointer', marginLeft: 'auto', letterSpacing: '0.05em',
                            }}>
                            SEND
                          </button>
                        </div>
                        {txStatus[`invite_${m.attestationId}`] && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: txStatus[`invite_${m.attestationId}`] === 'success' ? 'var(--color-emerald)' : txStatus[`invite_${m.attestationId}`] === 'pending' ? 'var(--color-gold)' : 'var(--color-critical)' }}>
                            {txStatus[`invite_${m.attestationId}`]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

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
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#0A0A0F',
                              background: 'var(--color-gold)', border: 'none', padding: '4px 12px',
                              borderRadius: '1px', cursor: 'pointer', marginLeft: 'auto', letterSpacing: '0.05em',
                            }}>
                            SEND
                          </button>
                        </div>
                        {txStatus[`purchase_${m.attestationId}`] && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: txStatus[`purchase_${m.attestationId}`] === 'success' ? 'var(--color-emerald)' : txStatus[`purchase_${m.attestationId}`] === 'pending' ? 'var(--color-gold)' : 'var(--color-critical)' }}>
                            {txStatus[`purchase_${m.attestationId}`]}
                          </span>
                        )}
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
