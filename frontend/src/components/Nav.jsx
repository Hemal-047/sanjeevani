import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Nav() {
  const { wallet, walletShort, role, setRole } = useApp();
  const location = useLocation();

  if (location.pathname === '/') return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
      style={{ background: 'rgba(10,10,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      <Link to="/" className="no-underline">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--color-gold)' }}>
          Sanjeevani
        </span>
      </Link>

      {wallet && (
        <div className="flex items-center gap-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '2px', padding: '2px' }}>
          <button
            onClick={() => setRole('patient')}
            className="px-3 py-1 text-xs transition-all duration-200"
            style={{
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              background: role === 'patient' ? 'rgba(212,165,116,0.15)' : 'transparent',
              color: role === 'patient' ? 'var(--color-gold)' : 'var(--color-text-secondary)',
              border: 'none',
              borderRadius: '1px',
              cursor: 'pointer',
            }}>
            Patient
          </button>
          <button
            onClick={() => setRole('researcher')}
            className="px-3 py-1 text-xs transition-all duration-200"
            style={{
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              background: role === 'researcher' ? 'rgba(212,165,116,0.15)' : 'transparent',
              color: role === 'researcher' ? 'var(--color-gold)' : 'var(--color-text-secondary)',
              border: 'none',
              borderRadius: '1px',
              cursor: 'pointer',
            }}>
            Researcher
          </button>
        </div>
      )}

      {wallet && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {walletShort}
        </div>
      )}
    </nav>
  );
}
