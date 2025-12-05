// Privy configuration
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

export const privyConfig = {
  // Login methods - ETH wallets, Solana wallets, email
  loginMethods: ['wallet', 'email'],

  // Appearance
  appearance: {
    theme: 'dark',
    accentColor: '#00ffff',
    logo: 'https://polymarket.com/favicon.ico',
    showWalletLoginFirst: true,
  },

  // Wallet configuration
  walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,

  // Supported chains
  supportedChains: [
    { id: 1, name: 'Ethereum' },
    { id: 137, name: 'Polygon' },
  ],

  // Solana configuration
  solanaClusters: [
    { name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com' },
  ],
};

// API base URL
export const API_URL = import.meta.env.VITE_API_URL || 'https://polymarketalphatracker-production.up.railway.app';
