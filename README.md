# Polymarket Alpha Tracker

<img src="https://github.com/alsk1992.png" width="100" align="right" />

[![Telegram](https://img.shields.io/badge/Telegram-@ALSK181-blue?logo=telegram)](https://t.me/ALSK181)

Track the smartest money on Polymarket. Copy trade whales. Get alpha.

![Polymarket Alpha Tracker](https://img.shields.io/badge/Polymarket-Alpha%20Tracker-00d4ff)
![Live](https://img.shields.io/badge/Status-Live-00ff88)

## What is this?

A real-time whale tracking dashboard for Polymarket. Find profitable traders, track their moves, and see what positions they're taking - all in real-time.

Stop guessing. Start following the money.

## Features

- **Real-Time Trade Feed** - Watch whale trades as they happen with 30-second auto-refresh
- **Complete P&L Tracking** - 1D, 1W, 1M, and ALL-TIME profit/loss breakdowns
- **Accurate Win Rates** - Fetches complete trade history, not just recent trades
- **Live Notifications** - Get alerted when tracked wallets make moves
- **Open Positions** - See exactly what whales are holding right now
- **Closed Positions** - Full win/loss history with P&L
- **Activity Analytics** - Trading patterns by hour and day of week
- **Position Sizing** - See how big they bet
- **Silent Background Sync** - Data updates without interrupting your view
- **Unlimited Wallets** - Track as many whales as you want
- **Persistent Watchlist** - Your tracked wallets saved locally

## Live Demo

**[Launch App](https://poly-sooty.vercel.app)**

## Quick Start

```bash
git clone https://github.com/alsk1992/PolyMarketAlphaTracker.git
cd PolyMarketAlphaTracker
npm install
npm run dev
```

Open http://localhost:5173

## Finding Alpha

### How to Find Whale Wallets

1. Go to any active market on Polymarket
2. Check the leaderboard or top holders
3. Click on profiles with high win rates or big positions
4. Copy their wallet address (0x...)
5. Paste into the tracker

### Pro Tips

- Look for wallets with 60%+ win rates
- Check activity patterns - some whales are most active at specific times
- Watch for large position sizes on markets you're interested in
- Use the Live Feed to catch moves in real-time

## Tech

- React 18 + Vite
- Polymarket Data API (no auth required)
- Auto-refresh with background sync
- Zero backend - runs entirely in your browser

## API Endpoints

All data fetched directly from Polymarket's public API:
- `/positions` - Open positions with cashPnl
- `/trades` - Trade history
- `/closed-positions` - Resolved positions with realizedPnl
- `/value` - Portfolio value

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alsk1992/PolyMarketAlphaTracker)

Or manually:
```bash
npm run build
# Deploy the dist/ folder anywhere
```

## Disclaimer

This is a tool for tracking publicly available on-chain data. Not financial advice. DYOR. Trade at your own risk.

## License

MIT
