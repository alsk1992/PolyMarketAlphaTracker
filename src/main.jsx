import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'

import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'

const PRIVY_APP_ID = 'cmisw6p5r00s5k00ct100zok3';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#00ffff',
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </PrivyProvider>
  </React.StrictMode>,
)
