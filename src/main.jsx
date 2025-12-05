import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'

import { PRIVY_APP_ID, privyConfig } from './lib/privy'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: {
          theme: 'dark',
          accentColor: '#00ffff',
          showWalletLoginFirst: true,
        },
        walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
        embeddedWallets: {
          createOnLogin: 'off',
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </PrivyProvider>
  </React.StrictMode>,
)
