import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { SiweMessage } from 'siwe';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Try to restore session on mount
  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const data = await api.get('/api/auth/me');
        api.setToken(data.token);
        setUser(data);
      } catch {
        // No valid session
      } finally {
        setLoading(false);
      }
    };

    // Try refresh if we might have a session
    tryRefresh();
  }, []);

  // Sign in with Ethereum
  const signIn = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get nonce from server
      const { nonce } = await api.post('/api/auth/nonce', { address });

      // 2. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Polymarket Alpha Tracker',
        uri: window.location.origin,
        version: '1',
        chainId: chain?.id || 1,
        nonce,
      });

      const messageString = message.prepareMessage();

      // 3. Sign message with wallet
      const signature = await signMessageAsync({ message: messageString });

      // 4. Verify with backend
      const { token, user: userData } = await api.post('/api/auth/verify', {
        message: messageString,
        signature,
      });

      // 5. Store token and user
      api.setToken(token);
      setUser(userData);

      return userData;
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, chain, signMessageAsync]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore logout errors
    }
    api.clearToken();
    setUser(null);
    disconnect();
  }, [disconnect]);

  // Check if user needs to sign in after connecting wallet
  useEffect(() => {
    if (isConnected && !user && !loading) {
      // Wallet connected but not signed in - could auto-prompt or show UI
    }
  }, [isConnected, user, loading]);

  // Clear user if wallet disconnected
  useEffect(() => {
    if (!isConnected && user) {
      api.clearToken();
      setUser(null);
    }
  }, [isConnected, user]);

  const value = {
    user,
    isAuthenticated: !!user,
    isConnected,
    address,
    loading,
    error,
    signIn,
    signOut,
    tier: user?.tier || 'free',
    isDev: user?.isDev || false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
