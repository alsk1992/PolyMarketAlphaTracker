import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function PricingPage({ onClose }) {
  const { isAuthenticated, tier, user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [paymentMethod, setPaymentMethod] = useState('crypto');

  const plans = {
    monthly: { price: 19, period: 'month', savings: null },
    yearly: { price: 149, period: 'year', savings: '35% off' },
    lifetime: { price: 299, period: 'once', savings: 'Best value' },
  };

  const features = {
    free: [
      { text: '3 wallets max', included: true },
      { text: 'Basic stats', included: true },
      { text: '30s refresh rate', included: true },
      { text: 'Advanced analytics', included: false },
      { text: 'Real-time alerts', included: false },
      { text: 'Export data', included: false },
      { text: 'API access', included: false },
    ],
    pro: [
      { text: 'Unlimited wallets', included: true },
      { text: 'Full stats & history', included: true },
      { text: '10s refresh rate', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Real-time alerts', included: true },
      { text: 'Export to CSV', included: true },
      { text: 'API access', included: true },
    ],
  };

  const handlePayment = () => {
    if (paymentMethod === 'crypto') {
      // For now, show contact info
      alert(`To pay with crypto, send $${plans[selectedPlan].price} USDC to:\n\n0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab1C\n\nThen DM @ALSK181 on Telegram with your wallet address to activate.`);
    } else {
      // Stripe - coming soon
      alert('Card payments coming soon! For now, pay with crypto or contact @ALSK181 on Telegram.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #080b12 0%, #0c1018 50%, #0a0f1a 100%)',
      zIndex: 1000,
      overflowY: 'auto',
      padding: '40px 20px',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          color: '#fff',
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        ✕ Close
      </button>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: '700',
            fontFamily: "'Space Grotesk', sans-serif",
            color: '#fff',
            marginBottom: '16px',
          }}>
            Upgrade to <span style={{ color: '#00ffff' }}>Pro</span>
          </h1>
          <p style={{ color: '#888', fontSize: '18px', maxWidth: '500px', margin: '0 auto' }}>
            Track unlimited wallets, get real-time alerts, and access advanced analytics.
          </p>
        </div>

        {/* Current tier badge */}
        {isAuthenticated && (
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{
              padding: '8px 16px',
              background: tier === 'pro' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${tier === 'pro' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: '20px',
              color: tier === 'pro' ? '#00ff88' : '#888',
              fontSize: '14px',
            }}>
              Current plan: <strong>{tier.toUpperCase()}</strong>
            </span>
          </div>
        )}

        {/* Plan toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '40px',
        }}>
          {Object.entries(plans).map(([key, plan]) => (
            <button
              key={key}
              onClick={() => setSelectedPlan(key)}
              style={{
                padding: '12px 24px',
                background: selectedPlan === key
                  ? 'linear-gradient(135deg, #00ffff, #00cccc)'
                  : 'rgba(255,255,255,0.05)',
                border: selectedPlan === key ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: selectedPlan === key ? '#000' : '#fff',
                fontSize: '14px',
                fontWeight: selectedPlan === key ? '600' : '400',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              {plan.savings && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  background: '#ff6b6b',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '600',
                }}>
                  {plan.savings}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pricing cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '48px',
        }}>
          {/* Free tier */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '32px',
          }}>
            <h3 style={{ color: '#888', fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase' }}>
              Free
            </h3>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '48px', fontWeight: '700', color: '#fff' }}>$0</span>
              <span style={{ color: '#666', marginLeft: '8px' }}>/forever</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {features.free.map((feature, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: feature.included ? '#ccc' : '#555',
                }}>
                  <span style={{ color: feature.included ? '#00ff88' : '#ff6b6b' }}>
                    {feature.included ? '✓' : '✕'}
                  </span>
                  {feature.text}
                </li>
              ))}
            </ul>
            <button
              disabled
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#666',
                fontSize: '15px',
                cursor: 'not-allowed',
              }}
            >
              Current Plan
            </button>
          </div>

          {/* Pro tier */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 200, 200, 0.05))',
            border: '2px solid rgba(0, 255, 255, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #00ffff, #00cccc)',
              color: '#000',
              padding: '4px 16px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600',
            }}>
              RECOMMENDED
            </div>
            <h3 style={{ color: '#00ffff', fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase' }}>
              Pro
            </h3>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '48px', fontWeight: '700', color: '#fff' }}>
                ${plans[selectedPlan].price}
              </span>
              <span style={{ color: '#666', marginLeft: '8px' }}>
                /{plans[selectedPlan].period}
              </span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {features.pro.map((feature, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(0, 255, 255, 0.1)',
                  color: '#ccc',
                }}>
                  <span style={{ color: '#00ff88' }}>✓</span>
                  {feature.text}
                </li>
              ))}
            </ul>

            {/* Payment method toggle */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '24px',
              marginBottom: '16px',
            }}>
              <button
                onClick={() => setPaymentMethod('crypto')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: paymentMethod === 'crypto' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${paymentMethod === 'crypto' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  color: paymentMethod === 'crypto' ? '#00ffff' : '#888',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Crypto
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: paymentMethod === 'card' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${paymentMethod === 'card' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  color: paymentMethod === 'card' ? '#00ffff' : '#888',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Card
              </button>
            </div>

            <button
              onClick={handlePayment}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #00ffff, #00cccc)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {paymentMethod === 'crypto' ? 'Pay with Crypto' : 'Pay with Card'}
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#fff',
            textAlign: 'center',
            marginBottom: '32px',
          }}>
            Frequently Asked Questions
          </h2>
          <div style={{
            display: 'grid',
            gap: '16px',
            maxWidth: '700px',
            margin: '0 auto',
          }}>
            {[
              {
                q: 'What payment methods do you accept?',
                a: 'We accept USDC, USDT, ETH on Ethereum/Polygon. Card payments coming soon.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, you can cancel your subscription at any time. You\'ll keep access until the end of your billing period.',
              },
              {
                q: 'What happens to my data if I downgrade?',
                a: 'Your data is preserved. You\'ll just be limited to viewing 3 wallets on the free plan.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'Yes, we offer a 7-day money-back guarantee if you\'re not satisfied.',
              },
            ].map((faq, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '20px',
              }}>
                <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '15px' }}>{faq.q}</h4>
                <p style={{ color: '#888', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div style={{
          textAlign: 'center',
          padding: '32px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <h3 style={{ color: '#fff', marginBottom: '12px' }}>Need help?</h3>
          <p style={{ color: '#888', marginBottom: '16px' }}>
            Contact us on Telegram for questions about pricing, features, or custom plans.
          </p>
          <a
            href="https://t.me/ALSK181"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'rgba(0, 136, 204, 0.2)',
              border: '1px solid rgba(0, 136, 204, 0.4)',
              borderRadius: '8px',
              color: '#00aaff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
            </svg>
            @ALSK181
          </a>
        </div>
      </div>
    </div>
  );
}
