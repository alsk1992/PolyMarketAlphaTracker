import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon } from 'wagmi/chains';

// Get WalletConnect project ID from env or use a placeholder for development
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'development';

export const config = getDefaultConfig({
  appName: 'Polymarket Alpha Tracker',
  projectId,
  chains: [mainnet, polygon],
  ssr: false,
});

// API base URL
export const API_URL = import.meta.env.VITE_API_URL || 'https://polymarketalphatracker-production.up.railway.app';
