import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Nav() {
  const { wallet, walletShort, role } = useApp();
  const location = useLocation();

  if (location.pathname === '/') return null;

  const modeLabel = role === 'researcher' ? 'Research Marketplace' : 'Health Data Center';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
      style={{ background: 'rgba(10,10,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      <Link to="/" className="no-underline">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--color-gold)' }}>
          Sanjeevani
        </span>
      </Link>

      {wallet && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          color: 'var(--color-gold)',
          background: 'rgba(212,165,116,0.1)',
          border: '1px solid rgba(212,165,116,0.2)',
          borderRadius: '2px',
          padding: '4px 12px',
        }}>
          {modeLabel}
        </span>
      )}

      {wallet && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {walletShort}
        </div>
      )}
    </nav>
  );
}
