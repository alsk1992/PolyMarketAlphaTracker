import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { ready, authenticated, user: privyUser, login, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get the connected wallet address (ETH or SOL)
  const getWalletInfo = useCallback(() => {
    if (!privyUser?.wallet) return null;

    // Check linked accounts for wallet info
    const linkedWallet = privyUser.linkedAccounts?.find(
      (account) => account.type === 'wallet'
    );

    if (linkedWallet) {
      return {
        address: linkedWallet.address,
        chainType: linkedWallet.chainType || 'ethereum', // 'ethereum' or 'solana'
      };
    }

    // Fallback to privy user wallet
    return {
      address: privyUser.wallet.address,
      chainType: privyUser.wallet.chainType || 'ethereum',
    };
  }, [privyUser]);

  // Try to restore session on mount or when Privy authenticates
  useEffect(() => {
    if (!ready) return;

    const tryRestoreSession = async () => {
      if (!authenticated) {
        setLoading(false);
        return;
      }

      try {
        // Try to get existing session from backend
        const data = await api.get('/api/auth/me');
        api.setToken(data.token);
        setUser(data);
      } catch {
        // No valid backend session - need to sign in
        // Auto sign-in with Privy token
        await signInWithPrivy();
      } finally {
        setLoading(false);
      }
    };

    tryRestoreSession();
  }, [ready, authenticated]);

  // Sign in using Privy's authentication
  const signInWithPrivy = useCallback(async () => {
    const walletInfo = getWalletInfo();
    if (!walletInfo) {
      throw new Error('No wallet connected');
    }

    setLoading(true);
    setError(null);

    try {
      // For Privy, we use a simpler auth flow since Privy handles the wallet verification
      // We just need to register/login the user with our backend using their wallet address

      const { token, user: userData } = await api.post('/api/auth/privy-login', {
        address: walletInfo.address,
        chainType: walletInfo.chainType,
        privyUserId: privyUser?.id,
      });

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
  }, [getWalletInfo, privyUser]);

  // Open Privy login modal
  const openLogin = useCallback(() => {
    login();
  }, [login]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore logout errors
    }
    api.clearToken();
    setUser(null);
    await privyLogout();
  }, [privyLogout]);

  // When Privy auth state changes, sync with backend
  useEffect(() => {
    if (ready && authenticated && !user && !loading) {
      signInWithPrivy().catch(console.error);
    }
  }, [ready, authenticated, user, loading, signInWithPrivy]);

  // Clear user if logged out from Privy
  useEffect(() => {
    if (ready && !authenticated && user) {
      api.clearToken();
      setUser(null);
    }
  }, [ready, authenticated, user]);

  const walletInfo = getWalletInfo();

  const value = {
    user,
    isAuthenticated: !!user,
    isConnected: authenticated && !!walletInfo,
    address: walletInfo?.address,
    chainType: walletInfo?.chainType,
    loading: !ready || loading,
    error,
    signIn: signInWithPrivy,
    signOut,
    openLogin,
    tier: user?.tier || 'free',
    isDev: user?.isDev || false,
    privyUser,
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
