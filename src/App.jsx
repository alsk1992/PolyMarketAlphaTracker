import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useWatchlist } from './hooks/useWatchlist';
import { UpgradeModal, MigrationModal } from './components/UpgradeModal';
import { PricingPage } from './components/PricingPage';

const formatUSD = (amount) => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) return `${amount < 0 ? '-' : ''}$${(absAmount / 1000000).toFixed(2)}M`;
  if (absAmount >= 1000) return `${amount < 0 ? '-' : ''}$${(absAmount / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const truncateAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown';

// Icons
const WhaleIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10c0-3 2-6 7-6s7 3 7 6c0 4-3 8-7 10-4-2-7-6-7-10z" />
    <circle cx="8" cy="9" r="1" fill="currentColor" />
    <path d="M17 6c2 0 4 1 4 3s-1 3-2 4" />
  </svg>
);

const BellIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const RefreshIcon = ({ spinning }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
    <path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 4v4h-4" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const Toast = ({ message, type, onClose }) => (
  <div style={{
    position: 'fixed', bottom: '24px', right: '24px', padding: '16px 24px',
    background: type === 'success' ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.95), rgba(0, 200, 100, 0.95))' : type === 'error' ? 'linear-gradient(135deg, rgba(255, 107, 107, 0.95), rgba(200, 80, 80, 0.95))' : 'linear-gradient(135deg, rgba(0, 212, 255, 0.95), rgba(0, 150, 200, 0.95))',
    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', color: '#fff', fontWeight: '500',
    display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, animation: 'slideUp 0.3s ease-out', maxWidth: '400px',
  }}>
    <BellIcon /><span style={{ flex: 1 }}>{message}</span>
    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', color: '#fff', padding: '4px 8px', cursor: 'pointer' }}>✕</button>
  </div>
);

const POLYMARKET_API = 'https://data-api.polymarket.com';
const BACKEND_API = 'https://polymarketalphatracker-production.up.railway.app';

// Analyze activity patterns from trades
function analyzeActivityPatterns(trades) {
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  trades.forEach(trade => {
    if (trade.timestamp) {
      const date = new Date(trade.timestamp * 1000);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    }
  });

  const maxHourCount = Math.max(...hourCounts, 1);
  const maxDayCount = Math.max(...dayCounts, 1);

  return {
    byHour: hourCounts.map((count, hour) => ({ hour, count, pct: (count / maxHourCount) * 100 })),
    byDay: dayCounts.map((count, day) => ({ day: dayNames[day], count, pct: (count / maxDayCount) * 100 })),
    peakHour: hourCounts.indexOf(Math.max(...hourCounts)),
    peakDay: dayNames[dayCounts.indexOf(Math.max(...dayCounts))],
  };
}

// Analyze position sizing patterns
function analyzePositionPatterns(positions, closedPositions) {
  const allPositions = [...positions, ...closedPositions];
  const sizeRanges = [
    { label: '<$100', min: 0, max: 100, count: 0 },
    { label: '$100-$1K', min: 100, max: 1000, count: 0 },
    { label: '$1K-$10K', min: 1000, max: 10000, count: 0 },
    { label: '$10K-$100K', min: 10000, max: 100000, count: 0 },
    { label: '>$100K', min: 100000, max: Infinity, count: 0 },
  ];

  allPositions.forEach(pos => {
    const size = Math.abs(pos.initialValue || 0);
    const range = sizeRanges.find(r => size >= r.min && size < r.max);
    if (range) range.count++;
  });

  const maxCount = Math.max(...sizeRanges.map(r => r.count), 1);
  return sizeRanges.map(r => ({ ...r, pct: (r.count / maxCount) * 100 }));
}

// Fetch trader data from our backend (handles rate limits & fetches ALL data)
async function fetchTraderData(address) {
  try {
    const res = await fetch(`${BACKEND_API}/api/trader/${address}`);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${res.status}`);
    }

    const data = await res.json();

    // Add activity patterns analysis (done client-side for now)
    const activityPatterns = analyzeActivityPatterns(data.trades || []);
    const positionPatterns = analyzePositionPatterns(data.positions || [], data.closedPositions || []);

    return {
      ...data,
      activityPatterns,
      positionPatterns,
      error: null,
    };
  } catch (err) {
    console.error('Failed to fetch trader data:', err);
    return { found: false, error: err.message || 'Failed to fetch data' };
  }
}

export default function PolymarketWalletTracker() {
  // Auth
  const { isAuthenticated, isConnected, user, signIn, openLogin, tier, chainType } = useAuth();

  // Watchlist from hook (server-synced when authenticated)
  const {
    watchlist,
    canAdd,
    limit,
    used,
    hasPendingMigration,
    addWallet: addWalletToList,
    removeWallet: removeWalletFromList,
    updateWallet: updateWalletNickname,
    migrateFromLocalStorage,
    skipMigration,
  } = useWatchlist();

  const [selectedWallet, setSelectedWallet] = useState(null);
  const [walletData, setWalletData] = useState({});
  const [newAddress, setNewAddress] = useState('');
  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [pnlPeriod, setPnlPeriod] = useState('all');
  const [positionSort, setPositionSort] = useState('recent');
  const [lastTradeTimestamps, setLastTradeTimestamps] = useState({});
  const [newTrades, setNewTrades] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showPricingPage, setShowPricingPage] = useState(false);

  // Show migration modal when there's pending migration
  useEffect(() => {
    if (isAuthenticated && hasPendingMigration) {
      setShowMigrationModal(true);
    }
  }, [isAuthenticated, hasPendingMigration]);

  // Select first wallet when watchlist loads
  useEffect(() => {
    if (watchlist.length > 0 && !selectedWallet) {
      setSelectedWallet(watchlist[0].address);
    }
  }, [watchlist, selectedWallet]);

  // isBackground = true means silent refresh (no loading spinner)
  const fetchUserData = useCallback(async (address, isBackground = false) => {
    // Only show loading spinner for initial loads, not background refreshes
    if (!isBackground) {
      setLoading(prev => ({ ...prev, [address]: true }));
    }
    setError(prev => ({ ...prev, [address]: null }));

    try {
      const result = await fetchTraderData(address);

      if (!result.found && result.error) {
        throw new Error(result.error);
      }

      const data = {
        address,
        pseudonym: result.pseudonym,
        stats: {
          totalPnl: result.totalPnl || 0,
          pnl1d: result.pnl1d || 0,
          pnl1w: result.pnl1w || 0,
          pnl1m: result.pnl1m || 0,
          winRate: result.winRate || 0,
          totalVolume: result.totalVolume || 0,
          currentValue: result.currentValue || 0,
          wins: result.wins || 0,
          losses: result.losses || 0,
          totalPositions: result.totalPositions || 0,
          avgPositionSize: result.avgPositionSize || 0,
          largestTrade: result.largestTrade || 0,
          avgTradeSize: result.avgTradeSize || 0,
          totalTrades: result.totalTrades || 0,
          openPositionCount: result.openPositionCount || 0,
          closedPositionCount: result.closedPositionCount || 0,
        },
        notableBets: result.notableBets || [],
        trades: result.trades || [],
        positions: result.positions || [],
        closedPositions: result.closedPositions || [],
        activityPatterns: result.activityPatterns || null,
        positionPatterns: result.positionPatterns || [],
        lastUpdated: Date.now(),
      };

      // Check for new trades
      const prevData = walletData[address];
      const prevLatestTimestamp = lastTradeTimestamps[address] || 0;
      const newLatestTimestamp = data.trades[0]?.timestamp || 0;

      if (prevData && newLatestTimestamp > prevLatestTimestamp) {
        // Find new trades
        const newTradesList = data.trades.filter(t => t.timestamp > prevLatestTimestamp);
        if (newTradesList.length > 0) {
          const wallet = watchlist.find(w => w.address === address);
          const walletName = wallet?.nickname || data.pseudonym || truncateAddress(address);

          // Add to new trades list for highlighting
          setNewTrades(prev => [
            ...newTradesList.map(t => ({ ...t, walletAddress: address, walletName, isNew: true })),
            ...prev
          ].slice(0, 50)); // Keep last 50 new trades

          // Show notification
          const trade = newTradesList[0];
          setToast({
            message: `🔔 ${walletName} ${trade.side} ${formatUSD(trade.usdValue || 0)} on ${trade.title?.slice(0, 30)}...`,
            type: 'info'
          });
          setTimeout(() => setToast(null), 5000);

          // Play sound (optional)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2ciHlxaW1tfIeQkI2Id3Nyd3+FgoKAf35+fX19fX19');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch (e) {}
        }
      }

      // Update last trade timestamp
      setLastTradeTimestamps(prev => ({ ...prev, [address]: newLatestTimestamp }));

      setWalletData(prev => ({ ...prev, [address]: data }));

    } catch (err) {
      console.error('Failed to fetch:', err);
      // Only show error for non-background fetches
      if (!isBackground) {
        setError(prev => ({ ...prev, [address]: err.message || 'Failed to load trader data' }));
        setToast({ message: `Failed to load: ${err.message}`, type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    } finally {
      if (!isBackground) {
        setLoading(prev => ({ ...prev, [address]: false }));
      }
    }
  }, []);

  // Manual refresh (shows loading spinner)
  const refreshAll = useCallback(() => {
    watchlist.forEach(w => fetchUserData(w.address, false));
  }, [watchlist, fetchUserData]);

  // Background refresh (silent, no loading spinner, just subtle indicator)
  const refreshAllBackground = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all(watchlist.map(w => fetchUserData(w.address, true)));
    setIsRefreshing(false);
  }, [watchlist, fetchUserData]);

  // Initial fetch when watchlist loads from localStorage
  useEffect(() => {
    if (watchlist.length === 0) return;

    // Fetch data for any wallet that doesn't have data yet
    watchlist.forEach(w => {
      if (!walletData[w.address] && !loading[w.address]) {
        fetchUserData(w.address, false); // Initial load shows spinner
      }
    });
  }, [watchlist]); // Only run when watchlist changes

  // Auto-refresh every 30 seconds when enabled (background/silent)
  useEffect(() => {
    if (!autoRefresh || watchlist.length === 0) return;

    const interval = setInterval(() => {
      refreshAllBackground(); // Silent background refresh
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, watchlist, refreshAllBackground]);

  const addWallet = async () => {
    const address = newAddress.trim().toLowerCase();
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      setToast({ message: 'Enter a valid Ethereum address (0x...)', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (watchlist.some(w => w.address?.toLowerCase() === address)) {
      setToast({ message: 'Wallet already tracked', type: 'info' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      await addWalletToList(address);
      setNewAddress('');
      setSelectedWallet(address);
      fetchUserData(address);
    } catch (err) {
      if (err.limitReached || err.error === 'LIMIT_REACHED') {
        setShowUpgradeModal(true);
      } else {
        setToast({ message: err.message || 'Failed to add wallet', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    }
  };

  const removeWallet = async (address) => {
    try {
      await removeWalletFromList(address);
      if (selectedWallet === address) {
        const remaining = watchlist.filter(w => w.address !== address);
        setSelectedWallet(remaining[0]?.address || null);
      }
    } catch (err) {
      setToast({ message: 'Failed to remove wallet', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const updateNickname = async (address, nickname) => {
    try {
      await updateWalletNickname(address, nickname);
    } catch (err) {
      console.error('Failed to update nickname:', err);
    }
  };

  const selectedData = selectedWallet ? walletData[selectedWallet] : null;
  const isAnyLoading = Object.values(loading).some(Boolean);
  const selectedError = selectedWallet ? error[selectedWallet] : null;
  const selectedLoading = selectedWallet ? loading[selectedWallet] : false;

  // Aggregate all trades from all wallets for the home feed
  const allTrades = React.useMemo(() => {
    const trades = [];
    Object.entries(walletData).forEach(([address, data]) => {
      if (data?.trades) {
        const wallet = watchlist.find(w => w.address === address);
        const walletName = wallet?.nickname || data.pseudonym || truncateAddress(address);
        data.trades.forEach(trade => {
          trades.push({
            ...trade,
            walletAddress: address,
            walletName,
          });
        });
      }
    });
    // Sort by timestamp, most recent first
    return trades.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [walletData, watchlist]);

  // Show pricing page if open
  if (showPricingPage) {
    return <PricingPage onClose={() => setShowPricingPage(false)} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #080b12 0%, #0c1018 50%, #0a0f1a 100%)', color: '#e8eef7', fontFamily: "'JetBrains Mono', 'SF Mono', monospace", display: 'flex' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.3); } 50% { box-shadow: 0 0 40px rgba(0, 255, 136, 0.6); } }
        .wallet-item { transition: all 0.2s ease; cursor: pointer; }
        .wallet-item:hover { background: rgba(0, 212, 255, 0.08) !important; }
        .wallet-item.selected { background: rgba(0, 212, 255, 0.15) !important; border-left: 3px solid #00d4ff !important; }
        .stat-card { transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
        .million-club { animation: glow 2s ease-in-out infinite; }
        input:focus { outline: none; border-color: #00d4ff !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(0, 212, 255, 0.3); border-radius: 3px; }
      `}</style>

      {/* Modals */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => setShowPricingPage(true)}
        currentCount={used}
        limit={limit}
      />
      <MigrationModal
        isOpen={showMigrationModal}
        onMigrate={async () => {
          await migrateFromLocalStorage();
          setShowMigrationModal(false);
          setToast({ message: 'Watchlist imported successfully!', type: 'success' });
          setTimeout(() => setToast(null), 3000);
        }}
        onSkip={() => {
          skipMigration();
          setShowMigrationModal(false);
        }}
        localCount={hasPendingMigration ? 'your' : 0}
      />

      {/* Sidebar */}
      <div style={{ width: '340px', borderRight: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', background: 'rgba(0, 0, 0, 0.2)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0, 212, 255, 0.4)' }}>
                <WhaleIcon size={26} />
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: '700', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>Whale Tracker</h1>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>POLYMARKET</p>
              </div>
            </div>
            {/* Tier badge */}
            {isAuthenticated && (
              <span style={{
                padding: '4px 8px',
                background: tier === 'dev' ? 'rgba(147, 51, 234, 0.2)' : tier === 'paid' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${tier === 'dev' ? 'rgba(147, 51, 234, 0.4)' : tier === 'paid' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 255, 255, 0.2)'}`,
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '600',
                color: tier === 'dev' ? '#a78bfa' : tier === 'paid' ? '#00ff88' : '#888',
                textTransform: 'uppercase',
                cursor: tier === 'free' ? 'pointer' : 'default',
              }}
              onClick={() => tier === 'free' && setShowPricingPage(true)}
              title={tier === 'free' ? 'Click to upgrade' : ''}
              >
                {tier}
              </span>
            )}
          </div>

          {/* Connect Button */}
          <div style={{ marginBottom: '16px' }}>
            {!isConnected ? (
              <button
                onClick={openLogin}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.3), rgba(79, 70, 229, 0.3))',
                  border: '1px solid rgba(147, 51, 234, 0.4)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="8" width="18" height="12" rx="2" />
                  <path d="M7 8V6a5 5 0 0 1 10 0v2" />
                </svg>
                Connect Wallet
              </button>
            ) : !isAuthenticated ? (
              <button
                onClick={signIn}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Sign In to Sync
              </button>
            ) : (
              <>
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(0, 255, 136, 0.1)',
                  border: '1px solid rgba(0, 255, 136, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88' }} />
                    <span style={{ fontSize: '12px', color: '#00ff88' }}>
                      {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {used}/{limit === Infinity ? '∞' : limit} wallets
                  </span>
                </div>
                {tier === 'free' && (
                  <button
                    onClick={() => setShowPricingPage(true)}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '10px',
                      background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(0, 200, 200, 0.1))',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '8px',
                      color: '#00ffff',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Upgrade to Pro
                  </button>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addWallet()} placeholder="0x... wallet address" style={{ flex: 1, padding: '12px 14px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', color: '#fff', fontSize: '12px', fontFamily: 'inherit' }} />
            <button onClick={addWallet} style={{ padding: '12px 14px', background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}><PlusIcon /></button>
          </div>
        </div>

        {/* Home Feed Button */}
        <div style={{ padding: '12px' }}>
          <button
            onClick={() => setSelectedWallet(null)}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: selectedWallet === null ? 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)' : 'rgba(0, 212, 255, 0.1)',
              border: selectedWallet === null ? 'none' : '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '10px',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: selectedWallet === null ? '0 4px 20px rgba(0, 212, 255, 0.4)' : 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Live Feed
            {allTrades.length > 0 && <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{allTrades.length}</span>}
          </button>
        </div>

        <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>WATCHLIST ({watchlist.length})</span>
            {autoRefresh && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: isRefreshing ? '#00d4ff' : '#00ff88' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isRefreshing ? '#00d4ff' : '#00ff88',
                  animation: isRefreshing ? 'pulse 0.5s infinite' : 'pulse 2s infinite'
                }} />
                {isRefreshing ? 'SYNCING' : 'LIVE'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                padding: '6px 10px',
                background: autoRefresh ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${autoRefresh ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                color: autoRefresh ? '#00ff88' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: 'inherit',
              }}
            >
              {autoRefresh ? '⏸ Auto' : '▶ Auto'}
            </button>
            <button onClick={refreshAll} disabled={isAnyLoading} style={{ padding: '6px 10px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '6px', color: '#00d4ff', cursor: isAnyLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'inherit' }}>
              <RefreshIcon spinning={isAnyLoading} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {watchlist.map(wallet => {
            const data = walletData[wallet.address];
            const isSelected = selectedWallet === wallet.address;
            const isLoading = loading[wallet.address];
            const hasError = error[wallet.address];
            
            return (
              <div key={wallet.address} className={`wallet-item ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedWallet(wallet.address)} style={{ padding: '16px', borderRadius: '12px', marginBottom: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderLeft: '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input type="text" value={wallet.nickname} onChange={(e) => updateNickname(wallet.address, e.target.value)} onClick={(e) => e.stopPropagation()} placeholder={data?.pseudonym || "Add nickname..."} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: '600', padding: 0, width: '180px', fontFamily: "'Space Grotesk', sans-serif" }} />
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{truncateAddress(wallet.address)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeWallet(wallet.address); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px' }}><TrashIcon /></button>
                </div>
                
                {isLoading ? (
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                    <div style={{ width: '12px', height: '12px', border: '2px solid rgba(0, 212, 255, 0.2)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Searching...
                  </div>
                ) : hasError ? (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#ff6b6b' }}>⚠️ Click to retry</div>
                ) : data ? (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>WIN RATE</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: data.stats.winRate >= 50 ? '#00ff88' : '#ff6b6b' }}>{data.stats.winRate}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>TOTAL P&L</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: data.stats.totalPnl >= 0 ? '#00ff88' : '#ff6b6b' }}>{data.stats.totalPnl >= 0 ? '+' : ''}{formatUSD(data.stats.totalPnl)}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Click "Load Data" to fetch stats</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '48px', height: '48px', border: '3px solid rgba(0, 212, 255, 0.2)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)' }}>Searching Polymarket for trader data...</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>This may take a moment</p>
          </div>
        ) : selectedError ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ color: '#ff6b6b', marginBottom: '8px' }}>Failed to load trader data</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>{selectedError}</p>
            <button onClick={() => fetchUserData(selectedWallet)} style={{ padding: '12px 24px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#00d4ff', cursor: 'pointer', fontFamily: 'inherit' }}>Try Again</button>
          </div>
        ) : selectedData ? (
          <>
            {/* Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.05) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>{watchlist.find(w => w.address === selectedWallet)?.nickname || selectedData.pseudonym || 'Trader'}</h2>
                    {selectedData.stats.totalPnl >= 1000000 && (
                      <span className="million-club" style={{ padding: '4px 12px', background: 'linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: '#000' }}>💎 $1M+ CLUB</span>
                    )}
                    {selectedData.stats.winRate >= 60 && (
                      <span style={{ padding: '4px 10px', background: 'rgba(0, 255, 136, 0.2)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '20px', fontSize: '10px', fontWeight: '600', color: '#00ff88' }}>🔥 HIGH WIN RATE</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{selectedWallet}</span>
                    <a href={`https://polymarket.com/profile/${selectedWallet}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00d4ff', textDecoration: 'none', fontSize: '12px' }}>View on Polymarket <ExternalLinkIcon /></a>
                  </div>
                </div>
                <button onClick={() => fetchUserData(selectedWallet)} disabled={selectedLoading} style={{ padding: '10px 16px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#00d4ff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <RefreshIcon spinning={selectedLoading} /> Refresh
                </button>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '24px' }}>
                {[
                  { label: 'TOTAL P&L', value: `${selectedData.stats.totalPnl >= 0 ? '+' : ''}${formatUSD(selectedData.stats.totalPnl)}`, color: selectedData.stats.totalPnl >= 0 ? '#00ff88' : '#ff6b6b', highlight: selectedData.stats.totalPnl >= 1000000 },
                  { label: 'WIN RATE', value: `${selectedData.stats.winRate}%`, color: selectedData.stats.winRate >= 50 ? '#00ff88' : '#ff6b6b' },
                  { label: 'CURRENT VALUE', value: formatUSD(selectedData.stats.currentValue), color: '#00d4ff' },
                  { label: 'TOTAL VOLUME', value: formatUSD(selectedData.stats.totalVolume), color: '#fff' },
                  { label: 'WINS / LOSSES', value: `${selectedData.stats.wins} / ${selectedData.stats.losses}`, color: '#fff' },
                  { label: 'POSITIONS', value: selectedData.stats.totalPositions, color: '#fff' },
                  { label: 'TOTAL TRADES', value: selectedData.stats.totalTrades, color: '#fff' },
                  { label: 'AVG POSITION', value: formatUSD(selectedData.stats.avgPositionSize), color: '#a78bfa' },
                  { label: 'AVG TRADE SIZE', value: formatUSD(selectedData.stats.avgTradeSize), color: '#a78bfa' },
                  { label: 'LARGEST TRADE', value: formatUSD(selectedData.stats.largestTrade), color: '#fbbf24' },
                ].map((stat, i) => (
                  <div key={i} className={`stat-card ${stat.highlight ? 'million-club' : ''}`} style={{ padding: '16px', background: stat.highlight ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 170, 0, 0.1) 100%)' : 'rgba(255, 255, 255, 0.03)', border: `1px solid ${stat.highlight ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`, borderRadius: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>{stat.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color, marginTop: '4px' }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'positions', label: `Open (${selectedData.stats.openPositionCount})` },
                { id: 'closed', label: `Closed (${selectedData.stats.closedPositionCount})` },
                { id: 'trades', label: `Trades (${selectedData.trades?.length || 0})` },
                { id: 'analytics', label: 'Analytics' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '12px 20px',
                    background: activeTab === tab.id ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent',
                    color: activeTab === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* P&L Summary with Time Period Tabs - Like Polymarket */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div style={{ padding: '24px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>PORTFOLIO VALUE</div>
                      <div style={{ fontSize: '32px', fontWeight: '700', color: '#00d4ff' }}>
                        {formatUSD(selectedData.stats.currentValue)}
                      </div>
                    </div>
                    <div style={{ padding: '24px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>PROFIT/LOSS</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {['1d', '1w', '1m', 'all'].map(period => (
                            <button
                              key={period}
                              onClick={() => setPnlPeriod(period)}
                              style={{
                                padding: '4px 8px',
                                background: pnlPeriod === period ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                                border: pnlPeriod === period ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                color: pnlPeriod === period ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                                fontSize: '10px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textTransform: 'uppercase',
                              }}
                            >
                              {period}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '700', color: (pnlPeriod === '1d' ? selectedData.stats.pnl1d : pnlPeriod === '1w' ? selectedData.stats.pnl1w : pnlPeriod === '1m' ? selectedData.stats.pnl1m : selectedData.stats.totalPnl) >= 0 ? '#00ff88' : '#ff6b6b' }}>
                        {(() => {
                          const pnl = pnlPeriod === '1d' ? selectedData.stats.pnl1d : pnlPeriod === '1w' ? selectedData.stats.pnl1w : pnlPeriod === '1m' ? selectedData.stats.pnl1m : selectedData.stats.totalPnl;
                          return `${pnl >= 0 ? '+' : ''}${formatUSD(pnl)}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Active Markets */}
                  {selectedData.notableBets && selectedData.notableBets.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', textTransform: 'uppercase' }}>Active Markets</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {selectedData.notableBets.map((bet, i) => (
                          <span key={i} style={{ padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{bet}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Trades Preview */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', margin: 0 }}>Recent Trades</h3>
                      <button onClick={() => setActiveTab('trades')} style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: '12px', cursor: 'pointer' }}>View All →</button>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      {selectedData.trades?.slice(0, 5).map((trade, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>{trade.title || 'Unknown'}</div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{trade.timestamp ? formatTime(trade.timestamp) : '-'}</div>
                          </div>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: trade.side === 'BUY' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 107, 107, 0.15)', color: trade.side === 'BUY' ? '#00ff88' : '#ff6b6b', marginRight: '12px' }}>{trade.side}</span>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{formatUSD(trade.usdValue || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Open Positions Tab */}
              {activeTab === 'positions' && (
                <div>
                  {/* Sort Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{selectedData.positions?.length || 0} positions</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { id: 'recent', label: 'Recent' },
                        { id: 'size', label: 'Size' },
                        { id: 'pnl', label: 'P&L' },
                      ].map(sort => (
                        <button
                          key={sort.id}
                          onClick={() => setPositionSort(sort.id)}
                          style={{
                            padding: '4px 10px',
                            background: positionSort === sort.id ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                            border: positionSort === sort.id ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: positionSort === sort.id ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                            fontSize: '10px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {sort.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    {selectedData.positions?.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Market</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Entry</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Current</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Size</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Value</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Unrealized P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...selectedData.positions].sort((a, b) => {
                            if (positionSort === 'recent') return (b.lastTradeTimestamp || 0) - (a.lastTradeTimestamp || 0);
                            if (positionSort === 'size') return Math.abs(b.initialValue || 0) - Math.abs(a.initialValue || 0);
                            if (positionSort === 'pnl') return (b.unrealizedPnl || 0) - (a.unrealizedPnl || 0);
                            return 0;
                          }).map((pos, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.title || 'Unknown'}</div>
                                  {pos.currentPrice === 1 && <span style={{ padding: '2px 6px', background: 'rgba(0, 255, 136, 0.15)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '4px', fontSize: '9px', fontWeight: '600', color: '#00ff88', whiteSpace: 'nowrap' }}>WON</span>}
                                  {pos.currentPrice === 0 && <span style={{ padding: '2px 6px', background: 'rgba(255, 107, 107, 0.15)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '4px', fontSize: '9px', fontWeight: '600', color: '#ff6b6b', whiteSpace: 'nowrap' }}>LOST</span>}
                                </div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '8px' }}>
                                  <span>{pos.outcome || ''}</span>
                                  {pos.lastTradeTimestamp > 0 && <span>• {formatTime(pos.lastTradeTimestamp)}</span>}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{pos.entryPrice ? `${(pos.entryPrice * 100).toFixed(1)}¢` : '-'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{pos.currentPrice ? `${(pos.currentPrice * 100).toFixed(1)}¢` : '-'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fff' }}>{formatUSD(pos.initialValue)}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#00d4ff', fontWeight: '500' }}>{formatUSD(pos.currentValue)}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                <div style={{ color: pos.unrealizedPnl >= 0 ? '#00ff88' : '#ff6b6b', fontWeight: '600' }}>
                                  {pos.unrealizedPnl >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPnl)}
                                </div>
                                <div style={{ fontSize: '10px', color: pos.pnlPercent >= 0 ? '#00ff88' : '#ff6b6b' }}>
                                  {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No open positions</div>
                    )}
                  </div>
                </div>
              )}

              {/* Closed Positions Tab */}
              {activeTab === 'closed' && (
                <div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    {selectedData.closedPositions?.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Result</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Market</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Total Bet</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Amount Won</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedData.closedPositions.map((pos, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: pos.won ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 107, 107, 0.15)', color: pos.won ? '#00ff88' : '#ff6b6b' }}>
                                  {pos.won ? 'WON' : 'LOST'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', maxWidth: '350px' }}>
                                <div style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.title || 'Unknown'}</div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{pos.outcome || ''}</div>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{formatUSD(pos.totalBought || pos.initialValue || 0)}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                {pos.won ? (
                                  <>
                                    <div style={{ color: '#00ff88', fontWeight: '600', fontSize: '14px' }}>
                                      {formatUSD(pos.amountWon || 0)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#00ff88' }}>
                                      +{formatUSD(pos.realizedPnl)} profit
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ color: '#ff6b6b', fontWeight: '600', fontSize: '14px' }}>
                                      $0
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#ff6b6b' }}>
                                      -{formatUSD(Math.abs(pos.totalBought))} lost
                                    </div>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No closed positions found</div>
                    )}
                  </div>
                </div>
              )}

              {/* Trades Tab */}
              {activeTab === 'trades' && (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  {selectedData.trades?.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Time</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Market</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Side</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Size</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedData.trades.map((trade, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>{trade.timestamp ? formatTime(trade.timestamp) : '-'}</td>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.8)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {trade.title || trade.market || 'Unknown'}
                              {trade.outcome && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>({trade.outcome})</span>}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: trade.side === 'BUY' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 107, 107, 0.15)', color: trade.side === 'BUY' ? '#00ff88' : '#ff6b6b' }}>{trade.side || '-'}</span>
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#fff', fontWeight: '500' }}>{formatUSD(trade.usdValue || 0)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{trade.price ? `${(trade.price * 100).toFixed(1)}¢` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No trades found</div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Position Size Distribution */}
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textTransform: 'uppercase' }}>Position Size Distribution</h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '20px' }}>
                      {selectedData.positionPatterns?.map((range, i) => (
                        <div key={i} style={{ marginBottom: i < selectedData.positionPatterns.length - 1 ? '12px' : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{range.label}</span>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{range.count} positions</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${range.pct}%`, background: 'linear-gradient(90deg, #00d4ff, #0099cc)', borderRadius: '4px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity by Day of Week */}
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textTransform: 'uppercase' }}>
                      Activity by Day <span style={{ color: '#00d4ff', fontWeight: '400' }}>(Peak: {selectedData.activityPatterns?.peakDay})</span>
                    </h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '120px', gap: '8px' }}>
                        {selectedData.activityPatterns?.byDay.map((day, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', position: 'relative', height: '100px', display: 'flex', alignItems: 'flex-end' }}>
                              <div style={{ width: '100%', height: `${day.pct}%`, background: day.pct === 100 ? 'linear-gradient(180deg, #00ff88, #00cc6a)' : 'linear-gradient(180deg, #00d4ff, #0099cc)', borderRadius: '4px', transition: 'height 0.3s' }} />
                            </div>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{day.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Activity by Hour */}
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textTransform: 'uppercase' }}>
                      Activity by Hour (UTC) <span style={{ color: '#00d4ff', fontWeight: '400' }}>(Peak: {selectedData.activityPatterns?.peakHour}:00)</span>
                    </h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '80px', gap: '2px' }}>
                        {selectedData.activityPatterns?.byHour.map((hour, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={`${hour.hour}:00 - ${hour.count} trades`}>
                            <div style={{ width: '100%', height: `${Math.max(hour.pct, 5)}%`, background: hour.pct === 100 ? '#00ff88' : hour.pct > 50 ? '#00d4ff' : 'rgba(0, 212, 255, 0.4)', borderRadius: '2px', transition: 'height 0.3s' }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>0:00</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>6:00</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>12:00</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>18:00</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>23:00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : selectedWallet ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <WhaleIcon size={64} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: '600', marginTop: '24px', color: 'rgba(255, 255, 255, 0.6)' }}>Ready to Track</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>{truncateAddress(selectedWallet)}</p>
            <button onClick={() => fetchUserData(selectedWallet)} style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 20px rgba(0, 212, 255, 0.4)' }}>Load Trader Data</button>
          </div>
        ) : (
          /* Home Feed - All trades from all wallets */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.05) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '700', fontFamily: "'Space Grotesk', sans-serif", margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Live Trade Feed
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.5)', margin: '8px 0 0 0', fontSize: '13px' }}>
                    All trades from {Object.keys(walletData).length} tracked wallet{Object.keys(walletData).length !== 1 ? 's' : ''} • {allTrades.length} total trades
                  </p>
                </div>
                <button onClick={refreshAll} disabled={isAnyLoading} style={{ padding: '10px 16px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#00d4ff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <RefreshIcon spinning={isAnyLoading} /> Refresh All
                </button>
              </div>
            </div>

            {/* Trade Feed */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
              {allTrades.length > 0 ? (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  {allTrades.map((trade, i) => (
                    <div
                      key={`${trade.walletAddress}-${trade.timestamp}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        borderBottom: i < allTrades.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        {/* Wallet avatar */}
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: `linear-gradient(135deg, hsl(${trade.walletAddress.charCodeAt(2) * 5 % 360}, 70%, 50%), hsl(${trade.walletAddress.charCodeAt(3) * 5 % 360}, 70%, 40%))`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '14px',
                          color: '#fff',
                        }}>
                          {trade.walletName.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>{trade.walletName}</span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600',
                              background: trade.side === 'BUY' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                              color: trade.side === 'BUY' ? '#00ff88' : '#ff6b6b'
                            }}>
                              {trade.side}
                            </span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                              {trade.timestamp ? formatTime(trade.timestamp) : '-'}
                            </span>
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                            {trade.title || 'Unknown Market'}
                            {trade.outcome && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '6px' }}>• {trade.outcome}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', fontSize: '16px', color: '#fff' }}>{formatUSD(trade.usdValue || 0)}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>@ {trade.price ? `${(trade.price * 100).toFixed(1)}¢` : '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.4)' }}>
                  <WhaleIcon size={64} />
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: '600', marginTop: '24px', color: 'rgba(255, 255, 255, 0.5)' }}>No trades yet</h3>
                  <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>Add wallets to your watchlist and click "Refresh All" to load their trades</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
