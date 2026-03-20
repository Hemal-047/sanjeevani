import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Nav() {
  const { wallet, walletShort, role } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/') return null;

  const modeLabel = role === 'researcher' ? 'Research Marketplace' : 'Health Data Center';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between"
      style={{ background: 'rgba(10,10,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', padding: '0 24px' }}>
      <div className="flex items-center gap-4" style={{ minWidth: 0 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
            fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--color-text-secondary)',
            transition: 'color 150ms ease', lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          title="Go back"
        >←</button>
        <Link to="/" className="no-underline" style={{ flexShrink: 0 }}>
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
            flexShrink: 0,
          }}>
            {modeLabel}
          </span>
        )}
      </div>

      {wallet && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          flexShrink: 0,
          paddingRight: '4px',
        }}>
          {walletShort}
        </div>
      )}
    </nav>
  );
}
