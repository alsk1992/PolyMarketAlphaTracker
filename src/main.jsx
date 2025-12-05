import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'

import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'cmisw6p5r00s5k00ct100zok3';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: {
          theme: 'dark',
          accentColor: '#00ffff',
          logo: 'https://polymarket.com/favicon.ico',
        },
        embeddedWallets: {
          createOnLogin: 'off',
        },
        // Enable Solana
        supportedChains: [
          { id: 1, name: 'Ethereum', network: 'mainnet' },
          { id: 137, name: 'Polygon', network: 'polygon' },
        ],
        // Solana support
        externalWallets: {
          solana: {
            enabled: true,
          },
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </PrivyProvider>
  </React.StrictMode>,
)
