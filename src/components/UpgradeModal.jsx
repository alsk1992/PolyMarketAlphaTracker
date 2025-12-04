import { useState } from 'react';

export function UpgradeModal({ isOpen, onClose, currentCount, limit }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(0, 255, 255, 0.2)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '440px',
        width: '90%',
        position: 'relative',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          &times;
        </button>

        {/* Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00ffff20, #00ffff10)',
          border: '2px solid #00ffff40',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '28px',
        }}>
          🔒
        </div>

        {/* Title */}
        <h2 style={{
          color: '#fff',
          fontSize: '24px',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: '12px',
        }}>
          Wallet Limit Reached
        </h2>

        {/* Description */}
        <p style={{
          color: '#aaa',
          textAlign: 'center',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}>
          You're tracking <span style={{ color: '#00ffff' }}>{currentCount}/{limit}</span> wallets on the free tier.
          Upgrade to track unlimited wallets and unlock advanced features.
        </p>

        {/* Features */}
        <div style={{
          background: 'rgba(0, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ color: '#fff', fontWeight: 500, marginBottom: '12px' }}>
            Pro Features:
          </div>
          {[
            'Unlimited wallet tracking',
            'Real-time alerts & notifications',
            'Advanced analytics & patterns',
            'Export data to CSV',
            'API access',
          ].map((feature, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ccc',
              fontSize: '14px',
              marginBottom: '8px',
            }}>
              <span style={{ color: '#00ffff' }}>✓</span>
              {feature}
            </div>
          ))}
        </div>

        {/* Price */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
        }}>
          <span style={{ color: '#888', fontSize: '14px' }}>Starting at</span>
          <div style={{
            color: '#fff',
            fontSize: '32px',
            fontWeight: 700,
          }}>
            $9.99<span style={{ fontSize: '16px', color: '#888' }}>/month</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: '8px',
              color: '#888',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Maybe Later
          </button>
          <button
            onClick={() => {
              // TODO: Implement payment flow
              alert('Payment coming soon! Contact @ALSK181 on Telegram for early access.');
            }}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #00ffff, #00cccc)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Upgrade Now
          </button>
        </div>

        {/* Contact */}
        <div style={{
          textAlign: 'center',
          marginTop: '16px',
          color: '#666',
          fontSize: '13px',
        }}>
          Questions? <a href="https://t.me/ALSK181" target="_blank" rel="noopener noreferrer" style={{ color: '#00ffff' }}>Contact us on Telegram</a>
        </div>
      </div>
    </div>
  );
}

export function MigrationModal({ isOpen, onMigrate, onSkip, localCount }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleMigrate = async () => {
    setLoading(true);
    try {
      await onMigrate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(0, 255, 255, 0.2)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '440px',
        width: '90%',
      }}>
        {/* Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00ffff20, #00ffff10)',
          border: '2px solid #00ffff40',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '28px',
        }}>
          📥
        </div>

        {/* Title */}
        <h2 style={{
          color: '#fff',
          fontSize: '24px',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: '12px',
        }}>
          Import Your Watchlist
        </h2>

        {/* Description */}
        <p style={{
          color: '#aaa',
          textAlign: 'center',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}>
          We found <span style={{ color: '#00ffff' }}>{localCount} wallet{localCount !== 1 ? 's' : ''}</span> saved in your browser.
          Would you like to import them to your account?
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onSkip}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: '8px',
              color: '#888',
              fontSize: '15px',
              cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Skip
          </button>
          <button
            onClick={handleMigrate}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #00ffff, #00cccc)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Importing...' : 'Import All'}
          </button>
        </div>
      </div>
    </div>
  );
}
