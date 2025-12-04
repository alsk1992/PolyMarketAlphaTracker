# Polymarket Alpha Tracker

A whale wallet tracker for Polymarket - track top traders and see their moves in real-time.

![Polymarket Alpha Tracker](https://img.shields.io/badge/Polymarket-Whale%20Tracker-00d4ff)

## Features

- **Live Trade Feed** - See all trades from all tracked wallets in one unified feed, sorted by most recent
- **Unlimited Wallet Tracking** - Add as many whale wallets as you want
- **Detailed Analytics** - Win rate, P&L, position sizes, activity patterns
- **Open Positions** - See what whales are currently holding with entry prices and unrealized P&L
- **Closed Positions** - Full history of wins and losses
- **Trade History** - Every buy/sell with timestamps and sizes
- **Custom Nicknames** - Name your tracked wallets for easy identification
- **Persistent Watchlist** - Your tracked wallets are saved locally

## Live Demo

Visit the live app: [Your Vercel URL]

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/alsk1992/PolyMarketAlphaTracker.git
cd PolyMarketAlphaTracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

## How to Use

### Adding a Wallet to Track

1. Find a whale's wallet address on Polymarket (click their profile to see the address)
2. Paste the address (0x...) in the input field
3. Click the + button
4. Click "Refresh All" or the refresh button to load their data

### Finding Whale Wallets

- Go to any popular market on Polymarket
- Look at the leaderboard or top holders
- Click on interesting profiles and copy their wallet address

### Using the Live Feed

1. Add multiple wallets to your watchlist
2. Click "Refresh All" to load all data
3. Click the **"Live Feed"** button in the sidebar
4. See all trades from all wallets sorted by most recent

### Understanding the Data

- **Win Rate** - Percentage of closed positions that were wins
- **Realized P&L** - Profit/loss from closed positions
- **Unrealized P&L** - Current profit/loss on open positions
- **Open Positions** - Active bets with "WON" badge if outcome already won but not redeemed

## Tech Stack

- React 18
- Vite
- Polymarket Data API (public, no auth required)

## API Endpoints Used

All data comes from Polymarket's public Data API:
- `/positions` - Current open positions
- `/trades` - Trade history
- `/closed-positions` - Resolved positions (wins & losses)
- `/value` - Portfolio value

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Connect your repo to [Vercel](https://vercel.com)
3. Deploy with default settings

### Deploy to Netlify

1. Build the project: `npm run build`
2. Deploy the `dist/` folder to Netlify

## License

MIT

## Disclaimer

This tool is for informational purposes only. Not financial advice. Trade at your own risk.
