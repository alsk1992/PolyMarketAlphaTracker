const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS for frontend
app.use(cors());
app.use(express.json());

const POLYMARKET_API = 'https://data-api.polymarket.com';

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl });
}

// Rate limiting helper - delay between requests
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch all closed positions with proper pagination
async function fetchAllClosedPositions(address) {
  const cacheKey = `closed-${address}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let allClosed = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    try {
      const res = await fetch(`${POLYMARKET_API}/closed-positions?user=${address}&limit=${limit}&offset=${offset}`);

      if (!res.ok) {
        if (res.status === 429) {
          // Rate limited - wait and retry
          console.log(`Rate limited at offset ${offset}, waiting...`);
          await delay(2000);
          continue;
        }
        break;
      }

      const data = await res.json();
      if (!data || data.length === 0) break;

      allClosed = [...allClosed, ...data];
      offset += data.length;

      console.log(`Fetched ${allClosed.length} closed positions for ${address.slice(0, 8)}...`);

      if (data.length < limit) break;

      // Delay between requests to avoid rate limiting
      await delay(150);
    } catch (err) {
      console.error(`Error fetching closed positions:`, err.message);
      break;
    }
  }

  // Cache for 5 minutes (closed positions don't change often)
  setCache(cacheKey, allClosed, 5 * 60 * 1000);
  return allClosed;
}

// Fetch trader data endpoint
app.get('/api/trader/:address', async (req, res) => {
  const { address } = req.params;

  if (!address || !address.startsWith('0x')) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const cacheKey = `trader-${address}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${address.slice(0, 8)}...`);
    return res.json(cached);
  }

  try {
    console.log(`Fetching data for ${address.slice(0, 8)}...`);

    // Fetch positions, trades, and value in parallel
    const [positionsRes, tradesRes, valueRes] = await Promise.all([
      fetch(`${POLYMARKET_API}/positions?user=${address}&limit=1000&sizeThreshold=-1`),
      fetch(`${POLYMARKET_API}/trades?user=${address}&limit=2000`),
      fetch(`${POLYMARKET_API}/value?user=${address}`),
    ]);

    if (!positionsRes.ok || !tradesRes.ok || !valueRes.ok) {
      throw new Error('Failed to fetch from Polymarket API');
    }

    const [positions, trades, valueData] = await Promise.all([
      positionsRes.json(),
      tradesRes.json(),
      valueRes.json(),
    ]);

    // Fetch ALL closed positions (this is the heavy one)
    const closedPositionsRaw = await fetchAllClosedPositions(address);

    // Build position -> last trade timestamp map
    const positionLastTrade = {};
    trades.forEach(trade => {
      const condId = trade.conditionId;
      const ts = trade.timestamp || 0;
      if (!positionLastTrade[condId] || ts > positionLastTrade[condId]) {
        positionLastTrade[condId] = ts;
      }
    });

    // Process positions
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let totalVolume = 0;
    const marketTitles = new Set();
    const openPositions = [];

    positions.forEach(pos => {
      const size = pos.size || 0;
      const initialValue = pos.initialValue || 0;
      const currentValue = pos.currentValue || 0;
      const cashPnl = pos.cashPnl || 0;
      const pnlPercent = initialValue > 0 ? (cashPnl / initialValue) * 100 : 0;

      totalVolume += Math.abs(pos.totalBought || initialValue || 0);

      if (size > 0.01) {
        totalPnl += cashPnl;
        if (pos.title) marketTitles.add(pos.title);
        openPositions.push({
          ...pos,
          initialValue,
          currentValue,
          unrealizedPnl: cashPnl,
          pnlPercent,
          entryPrice: pos.avgPrice || 0,
          currentPrice: pos.curPrice || 0,
          lastTradeTimestamp: positionLastTrade[pos.conditionId] || 0,
        });
      }
    });

    // Process closed positions
    const closedPositions = [];
    const seenConditions = new Set();

    closedPositionsRaw.forEach(pos => {
      if (seenConditions.has(pos.conditionId)) return;
      seenConditions.add(pos.conditionId);

      const curPrice = pos.curPrice || 0;
      const totalBought = pos.totalBought || 0;
      const realizedPnl = pos.realizedPnl || 0;

      const won = curPrice === 1;
      const lost = curPrice === 0;

      if (won) wins++;
      else if (lost) losses++;

      totalPnl += realizedPnl;
      totalVolume += totalBought;

      closedPositions.push({
        title: pos.title || 'Unknown Market',
        outcome: pos.outcome || '',
        conditionId: pos.conditionId,
        totalBought,
        amountWon: won ? (totalBought + realizedPnl) : 0,
        realizedPnl,
        pnlPercent: totalBought > 0 ? (realizedPnl / totalBought) * 100 : 0,
        won,
        lost,
        timestamp: pos.timestamp,
        avgPrice: pos.avgPrice,
      });
    });

    // Calculate period P&L
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (1 * 24 * 60 * 60);
    const oneWeekAgo = now - (7 * 24 * 60 * 60);
    const oneMonthAgo = now - (30 * 24 * 60 * 60);

    let pnl1d = 0, pnl1w = 0, pnl1m = 0;
    closedPositions.forEach(pos => {
      const posTime = pos.timestamp || 0;
      const pnl = pos.realizedPnl || 0;
      if (posTime >= oneDayAgo) pnl1d += pnl;
      if (posTime >= oneWeekAgo) pnl1w += pnl;
      if (posTime >= oneMonthAgo) pnl1m += pnl;
    });

    const unrealizedPnl = openPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);

    // Calculate trade stats
    const tradesWithUsd = trades.map(trade => ({
      ...trade,
      usdValue: (trade.size || 0) * (trade.price || 0),
    }));
    tradesWithUsd.forEach(trade => {
      totalVolume += Math.abs(trade.usdValue || 0);
    });

    const sortedTrades = [...tradesWithUsd].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const totalPositionCount = openPositions.length + closedPositions.length;
    const winRate = closedPositions.length > 0 ? ((wins / closedPositions.length) * 100) : 0;
    const currentValue = Array.isArray(valueData) ? (valueData[0]?.value || 0) : (valueData?.value || 0);
    const pseudonym = positions[0]?.pseudonym || trades[0]?.pseudonym || null;
    const avgPositionSize = totalPositionCount > 0 ? totalVolume / totalPositionCount : 0;
    const largestTrade = tradesWithUsd.length > 0 ? Math.max(...tradesWithUsd.map(t => Math.abs(t.usdValue || 0))) : 0;
    const avgTradeSize = tradesWithUsd.length > 0 ? tradesWithUsd.reduce((sum, t) => sum + Math.abs(t.usdValue || 0), 0) / tradesWithUsd.length : 0;

    const result = {
      found: totalPositionCount > 0 || trades.length > 0,
      pseudonym,
      totalPnl,
      pnl1d: pnl1d + unrealizedPnl,
      pnl1w: pnl1w + unrealizedPnl,
      pnl1m: pnl1m + unrealizedPnl,
      winRate: parseFloat(winRate.toFixed(1)),
      totalVolume,
      currentValue,
      wins,
      losses,
      totalPositions: totalPositionCount,
      notableBets: [...marketTitles].slice(0, 5),
      trades: sortedTrades,
      positions: openPositions,
      closedPositions,
      avgPositionSize,
      largestTrade,
      avgTradeSize,
      totalTrades: trades.length,
      openPositionCount: openPositions.length,
      closedPositionCount: closedPositions.length,
    };

    // Cache for 1 minute
    setCache(cacheKey, result);

    res.json(result);
  } catch (err) {
    console.error(`Error fetching trader ${address}:`, err);
    res.status(500).json({ error: err.message || 'Failed to fetch trader data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cached: cache.size });
});

app.listen(PORT, () => {
  console.log(`🚀 Polymarket Tracker API running on port ${PORT}`);
});
