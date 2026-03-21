import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const DOC_TYPES = {
  'application/pdf': { color: '#34D399', label: 'PDF' },
  'image/png': { color: '#60A5FA', label: 'IMG' },
  'image/jpeg': { color: '#60A5FA', label: 'IMG' },
  'image/webp': { color: '#60A5FA', label: 'IMG' },
};

const RELATIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Paternal Grandfather', 'Maternal Grandfather', 'Paternal Grandmother', 'Maternal Grandmother'];

const COMMON_CONDITIONS = [
  'Type 2 Diabetes', 'Type 1 Diabetes', 'Hypertension', 'Coronary Artery Disease',
  'Stroke', 'Cancer (Breast)', 'Cancer (Lung)', 'Cancer (Colon)', 'Asthma',
  'COPD', 'Alzheimer\'s Disease', 'Parkinson\'s Disease', 'Hypothyroidism',
  'Rheumatoid Arthritis', 'Lupus', 'Sickle Cell Disease', 'Depression',
];

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-dim)', marginBottom: '12px' }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export default function Upload() {
  const { uploadedFiles, setUploadedFiles, familyHistory, setFamilyHistory } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ relation: 'Father', conditions: [], ageOfOnset: '' });
  const [conditionInput, setConditionInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addFiles = useCallback((fileList) => {
    const newFiles = Array.from(fileList).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, [setUploadedFiles]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(idx) {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function addConditionToMember(condition) {
    if (!newMember.conditions.includes(condition)) {
      setNewMember(prev => ({ ...prev, conditions: [...prev.conditions, condition] }));
    }
    setConditionInput('');
    setShowSuggestions(false);
  }

  function removeConditionFromMember(condition) {
    setNewMember(prev => ({ ...prev, conditions: prev.conditions.filter(c => c !== condition) }));
  }

  function saveMember() {
    if (newMember.conditions.length === 0) return;
    setFamilyHistory(prev => ({
      members: [...prev.members, {
        relation: newMember.relation,
        conditions: [...newMember.conditions],
        ageOfOnset: newMember.ageOfOnset ? parseInt(newMember.ageOfOnset) : null,
      }],
    }));
    setNewMember({ relation: 'Father', conditions: [], ageOfOnset: '' });
    setShowAddMember(false);
  }

  function removeMember(idx) {
    setFamilyHistory(prev => ({ members: prev.members.filter((_, i) => i !== idx) }));
  }

  const filteredSuggestions = COMMON_CONDITIONS.filter(c =>
    c.toLowerCase().includes(conditionInput.toLowerCase()) && !newMember.conditions.includes(c)
  );

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  const hasFiles = uploadedFiles.length > 0;

  return (
    <div className="pt-14 h-screen flex flex-col" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Descriptor line */}
      <div style={{
        padding: '12px 24px 0',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        lineHeight: '1.5',
      }}>
        Four AI agents privately analyze your medical records, discover hidden health patterns, and connect you to clinical trials — all without exposing your data.
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ padding: '16px 24px 0', gap: '4%' }}>
        {/* Left: Upload Zone (58%) */}
        <div style={{ width: '58%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            className={`relative flex flex-col items-center justify-center cursor-pointer transition-all duration-200`}
            style={{
              border: `1px solid ${dragOver ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '2px',
              background: dragOver ? 'rgba(212,165,116,0.03)' : 'transparent',
              transition: 'border-color 0.2s, background 0.2s',
              overflow: 'hidden',
              height: hasFiles ? 'auto' : '300px',
              maxHeight: '350px',
              flexShrink: 0,
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />

            {!hasFiles ? (
              <div className="text-center">
                <div className="flex justify-center"><UploadIcon /></div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  drop health documents here
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '8px' }}>
                  PDF, PNG, JPEG · lab reports, prescriptions, discharge summaries
                </p>
              </div>
            ) : (
              <div className="w-full px-6 py-4 overflow-y-auto" style={{ maxHeight: '100%' }} onClick={e => e.stopPropagation()}>
                {uploadedFiles.map((file, i) => {
                  const docType = DOC_TYPES[file.type] || { color: '#888', label: '?' };
                  return (
                    <div key={i} className="flex items-center gap-3 py-2 slide-in"
                      style={{ borderBottom: '1px solid var(--color-border)', borderLeft: `3px solid ${docType.color}`, paddingLeft: '12px', animationDelay: `${i * 50}ms` }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '1px', background: docType.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>
                        {file.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {formatSize(file.size)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: docType.color }}>
                        {docType.label}
                      </span>
                      <button onClick={() => removeFile(i)} style={{
                        background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer',
                        fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '0 4px',
                      }}>×</button>
                    </div>
                  );
                })}
                <div className="mt-4 text-center">
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)',
                    background: 'none', border: '1px solid var(--color-border)', padding: '4px 12px',
                    borderRadius: '2px', cursor: 'pointer',
                  }}>+ add more</button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Sticky Bar */}
          <div className="mt-4 mb-4 flex items-center gap-4" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '10px 16px',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: hasFiles ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
              {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => hasFiles && navigate('/analyze')}
              disabled={!hasFiles}
              className={`flex-1 py-3 text-center transition-all duration-200${hasFiles ? ' pulse-glow' : ''}`}
              style={{
                background: hasFiles ? 'var(--color-gold)' : 'rgba(255,255,255,0.04)',
                color: hasFiles ? '#0A0A0F' : 'var(--color-text-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                letterSpacing: '0.15em',
                fontWeight: 600,
                border: hasFiles ? 'none' : '1px solid var(--color-border)',
                borderRadius: '2px',
                cursor: hasFiles ? 'pointer' : 'not-allowed',
              }}>
              ANALYZE
            </button>
          </div>
        </div>

        {/* Right: Family History Panel (38%) */}
        <div style={{
          width: '38%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderLeft: '2px solid rgba(212,165,116,0.15)',
          paddingLeft: '24px',
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            marginBottom: '16px',
          }}>
            <h3 className="agent-name" style={{ fontSize: '13px', color: 'var(--color-gold)', marginBottom: '16px' }}>
              FAMILY HISTORY
            </h3>

            {/* Existing members */}
            {familyHistory.members.length === 0 && !showAddMember && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '12px' }}>
                No family members added yet. Adding family history helps discover hereditary risk patterns.
              </p>
            )}

            {familyHistory.members.map((member, i) => (
              <div key={i} className="flex items-start gap-3 py-2 slide-in" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex-1">
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text)' }}>
                    {member.relation}
                    {member.ageOfOnset && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-dim)', marginLeft: '8px' }}>
                        onset: {member.ageOfOnset}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.conditions.map((c, j) => (
                      <span key={j} style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-amber)',
                        background: 'rgba(251,191,36,0.08)', padding: '1px 6px', borderRadius: '1px',
                        border: '1px solid rgba(251,191,36,0.15)',
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => removeMember(i)} style={{
                  background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '14px',
                }}>×</button>
              </div>
            ))}

            {/* Add member form */}
            {showAddMember ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '4px' }}>
                    RELATION
                  </label>
                  <select
                    value={newMember.relation}
                    onChange={e => setNewMember(prev => ({ ...prev, relation: e.target.value }))}
                    className="w-full"
                  >
                    {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="relative">
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '4px' }}>
                    CONDITIONS
                  </label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {newMember.conditions.map((c, j) => (
                      <span key={j} className="flex items-center gap-1" style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-gold)',
                        background: 'var(--color-gold-faint)', padding: '2px 6px', borderRadius: '1px',
                      }}>
                        {c}
                        <button onClick={() => removeConditionFromMember(c)} style={{
                          background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: '12px', padding: 0,
                        }}>×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={conditionInput}
                    onChange={e => { setConditionInput(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && conditionInput.trim()) {
                        e.preventDefault();
                        addConditionToMember(conditionInput.trim());
                      }
                    }}
                    placeholder="Type condition or press Enter to add..."
                    className="w-full"
                  />
                  {showSuggestions && conditionInput && filteredSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 z-10 overflow-y-auto" style={{
                      maxHeight: '120px', background: '#141418', border: '1px solid var(--color-border)',
                      borderRadius: '2px',
                    }}>
                      {filteredSuggestions.map(s => (
                        <button key={s}
                          onMouseDown={() => addConditionToMember(s)}
                          className="w-full text-left px-3 py-1 block"
                          style={{
                            fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                          }}
                          onMouseEnter={e => { e.target.style.background = 'var(--color-surface)'; }}
                          onMouseLeave={e => { e.target.style.background = 'transparent'; }}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '4px' }}>
                    AGE OF ONSET
                  </label>
                  <input
                    type="number"
                    value={newMember.ageOfOnset}
                    onChange={e => setNewMember(prev => ({ ...prev, ageOfOnset: e.target.value }))}
                    placeholder="e.g. 52"
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={saveMember} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-gold)',
                    background: 'var(--color-gold-faint)', border: '1px solid var(--color-gold)',
                    padding: '4px 12px', borderRadius: '2px', cursor: 'pointer',
                  }}>Save</button>
                  <button onClick={() => setShowAddMember(false)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)',
                    background: 'none', border: '1px solid var(--color-border)',
                    padding: '4px 12px', borderRadius: '2px', cursor: 'pointer',
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddMember(true)} className="mt-2 w-full py-2" style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-gold)',
                background: 'none', border: '1px dashed rgba(212,165,116,0.3)', borderRadius: '2px', cursor: 'pointer',
              }}>
                + Add Family Member
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
