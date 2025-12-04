import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// localStorage key for anonymous watchlist
const LOCAL_STORAGE_KEY = 'polymarket-watchlist';

export function useWatchlist() {
  const { isAuthenticated, user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(3);
  const [canAdd, setCanAdd] = useState(true);
  const [hasPendingMigration, setHasPendingMigration] = useState(false);

  // Load watchlist - from server if authenticated, localStorage if not
  const loadWatchlist = useCallback(async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const data = await api.get('/api/watchlist');
        setWatchlist(data.watchlist);
        setLimit(data.limit);
        setCanAdd(data.canAdd);
        setError(null);

        // Check if there's localStorage data to migrate
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Has local data that could be migrated
              const localAddresses = parsed.map(w => w.address?.toLowerCase());
              const serverAddresses = data.watchlist.map(w => w.address?.toLowerCase());
              const newAddresses = localAddresses.filter(a => !serverAddresses.includes(a));
              if (newAddresses.length > 0) {
                setHasPendingMigration(true);
              }
            }
          } catch {
            // Invalid localStorage data
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to load watchlist');
      } finally {
        setLoading(false);
      }
    } else {
      // Load from localStorage
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setWatchlist(parsed);
          }
        }
      } catch {
        // Invalid localStorage data
      }
      setLimit(Infinity); // No limit for anonymous users (for now)
      setCanAdd(true);
    }
  }, [isAuthenticated]);

  // Load on mount and when auth changes
  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // Add wallet to watchlist
  const addWallet = useCallback(async (address, nickname = null) => {
    if (!address?.startsWith('0x')) {
      throw new Error('Invalid wallet address');
    }

    if (isAuthenticated) {
      try {
        const item = await api.post('/api/watchlist', {
          walletAddress: address,
          nickname,
        });
        setWatchlist(prev => [item, ...prev]);
        setCanAdd(watchlist.length + 1 < limit);
        return item;
      } catch (err) {
        if (err.error === 'LIMIT_REACHED') {
          setCanAdd(false);
          throw { ...err, limitReached: true };
        }
        throw err;
      }
    } else {
      // Add to localStorage
      const newItem = { address: address.toLowerCase(), nickname };
      const updated = [newItem, ...watchlist.filter(w => w.address?.toLowerCase() !== address.toLowerCase())];
      setWatchlist(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return newItem;
    }
  }, [isAuthenticated, watchlist, limit]);

  // Remove wallet from watchlist
  const removeWallet = useCallback(async (idOrAddress) => {
    if (isAuthenticated) {
      // Find the item to get the ID
      const item = watchlist.find(w => w.id === idOrAddress || w.address === idOrAddress);
      if (!item?.id) {
        throw new Error('Wallet not found');
      }
      await api.delete(`/api/watchlist/${item.id}`);
      setWatchlist(prev => prev.filter(w => w.id !== item.id));
      setCanAdd(true);
    } else {
      const updated = watchlist.filter(w => w.address !== idOrAddress);
      setWatchlist(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  }, [isAuthenticated, watchlist]);

  // Update wallet nickname
  const updateWallet = useCallback(async (idOrAddress, nickname) => {
    if (isAuthenticated) {
      const item = watchlist.find(w => w.id === idOrAddress || w.address === idOrAddress);
      if (!item?.id) {
        throw new Error('Wallet not found');
      }
      const updated = await api.patch(`/api/watchlist/${item.id}`, { nickname });
      setWatchlist(prev => prev.map(w => w.id === item.id ? updated : w));
      return updated;
    } else {
      const updated = watchlist.map(w =>
        w.address === idOrAddress ? { ...w, nickname } : w
      );
      setWatchlist(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  }, [isAuthenticated, watchlist]);

  // Migrate localStorage data to server
  const migrateFromLocalStorage = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to migrate');
    }

    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!localData) return { imported: [], skipped: [] };

    try {
      const parsed = JSON.parse(localData);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { imported: [], skipped: [] };
      }

      const result = await api.post('/api/watchlist/import', { wallets: parsed });

      // Clear localStorage after successful import
      if (result.importedCount > 0) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

      // Reload watchlist
      await loadWatchlist();
      setHasPendingMigration(false);

      return result;
    } catch (err) {
      throw err;
    }
  }, [isAuthenticated, loadWatchlist]);

  // Skip migration (clear the flag)
  const skipMigration = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setHasPendingMigration(false);
  }, []);

  return {
    watchlist,
    loading,
    error,
    limit,
    canAdd,
    used: watchlist.length,
    hasPendingMigration,
    addWallet,
    removeWallet,
    updateWallet,
    migrateFromLocalStorage,
    skipMigration,
    reload: loadWatchlist,
  };
}
