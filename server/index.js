const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { SiweMessage } = require('siwe');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const DEV_WALLETS = (process.env.DEV_WALLETS || '').split(',').filter(Boolean).map(w => w.toLowerCase());
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Tier limits
const TIER_LIMITS = {
  free: 3,
  paid: Infinity,
  dev: Infinity,
};

// CORS for frontend
app.use(cors({
  origin: [
    FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'https://poly-sooty.vercel.app',
    /\.vercel\.app$/,  // Allow all vercel.app subdomains
  ],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

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

// ============================================
// AUTH MIDDLEWARE
// ============================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth - attaches user if token present, but doesn't require it
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Invalid token, continue without user
    }
  }
  next();
}

// ============================================
// AUTH ENDPOINTS
// ============================================

// Generate nonce for SIWE
app.post('/api/auth/nonce', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Clean up old nonces for this address
    await prisma.authNonce.deleteMany({
      where: {
        OR: [
          { walletAddress: address.toLowerCase() },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    // Create new nonce
    await prisma.authNonce.create({
      data: {
        walletAddress: address.toLowerCase(),
        nonce,
        expiresAt,
      },
    });

    res.json({ nonce });
  } catch (err) {
    console.error('Error generating nonce:', err);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// Verify SIWE signature and return JWT
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { message, signature } = req.body;

    if (!message || !signature) {
      return res.status(400).json({ error: 'Missing message or signature' });
    }

    // Parse and verify SIWE message
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (!fields.success) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const address = fields.data.address.toLowerCase();

    // Verify nonce
    const nonceRecord = await prisma.authNonce.findFirst({
      where: {
        walletAddress: address,
        nonce: fields.data.nonce,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!nonceRecord) {
      return res.status(401).json({ error: 'Invalid or expired nonce' });
    }

    // Mark nonce as used
    await prisma.authNonce.update({
      where: { id: nonceRecord.id },
      data: { used: true },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: address },
    });

    const isDevWallet = DEV_WALLETS.includes(address);

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: address,
          tier: isDevWallet ? 'dev' : 'free',
          isDev: isDevWallet,
        },
      });
    } else if (isDevWallet && user.tier !== 'dev') {
      // Upgrade to dev if wallet is in dev list
      user = await prisma.user.update({
        where: { id: user.id },
        data: { tier: 'dev', isDev: true },
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, walletAddress: user.walletAddress, tier: user.tier },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      token: accessToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        tier: user.tier,
        isDev: user.isDev,
      },
    });
  } catch (err) {
    console.error('Error verifying signature:', err);
    res.status(500).json({ error: 'Failed to verify signature' });
  }
});

// Refresh access token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, walletAddress: user.walletAddress, tier: user.tier },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      token: accessToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        tier: user.tier,
        isDev: user.isDev,
      },
    });
  } catch (err) {
    console.error('Error refreshing token:', err);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

// Privy login - simplified auth since Privy verifies wallet ownership
app.post('/api/auth/privy-login', async (req, res) => {
  try {
    const { address, chainType } = req.body;

    console.log('Privy login attempt:', { address, chainType });

    if (!address) {
      return res.status(400).json({ error: 'Missing address' });
    }

    // Normalize address - SOL addresses are base58, ETH are hex
    const normalizedAddress = chainType === 'solana'
      ? address  // SOL addresses are case-sensitive
      : address.toLowerCase();

    // Check if dev wallet (support both ETH and SOL dev wallets)
    const isDevWallet = DEV_WALLETS.includes(normalizedAddress.toLowerCase());

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          tier: isDevWallet ? 'dev' : 'free',
          isDev: isDevWallet,
        },
      });
    } else if (isDevWallet && user.tier !== 'dev') {
      // Upgrade to dev if needed
      user = await prisma.user.update({
        where: { id: user.id },
        data: { tier: 'dev', isDev: true },
      });
    }

    // Generate tokens (store chainType in JWT for frontend use)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        walletAddress: user.walletAddress,
        tier: user.tier,
        chainType: chainType || 'ethereum',
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      token: accessToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        tier: user.tier,
        isDev: user.isDev,
        chainType: chainType || 'ethereum',
      },
    });
  } catch (err) {
    console.error('Error with Privy login:', err);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { watchlists: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      tier: user.tier,
      isDev: user.isDev,
      watchlistCount: user.watchlists.length,
      watchlistLimit: TIER_LIMITS[user.tier],
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ============================================
// WATCHLIST ENDPOINTS
// ============================================

// Get user's watchlist
app.get('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const watchlist = await prisma.watchlistItem.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });

    const limit = TIER_LIMITS[req.user.tier];

    res.json({
      watchlist: watchlist.map(item => ({
        id: item.id,
        address: item.walletAddress,
        nickname: item.nickname,
        createdAt: item.createdAt,
      })),
      limit,
      used: watchlist.length,
      canAdd: watchlist.length < limit,
    });
  } catch (err) {
    console.error('Error fetching watchlist:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add to watchlist
app.post('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const { walletAddress, nickname } = req.body;

    if (!walletAddress || !walletAddress.startsWith('0x')) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Check limit
    const currentCount = await prisma.watchlistItem.count({
      where: { userId: req.user.userId },
    });

    const limit = TIER_LIMITS[req.user.tier];

    if (currentCount >= limit) {
      return res.status(403).json({
        error: 'LIMIT_REACHED',
        message: `Free tier is limited to ${limit} wallets. Upgrade to track more.`,
        limit,
        used: currentCount,
      });
    }

    // Check if already exists
    const existing = await prisma.watchlistItem.findFirst({
      where: {
        userId: req.user.userId,
        walletAddress: walletAddress.toLowerCase(),
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Wallet already in watchlist' });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        userId: req.user.userId,
        walletAddress: walletAddress.toLowerCase(),
        nickname: nickname || null,
      },
    });

    res.json({
      id: item.id,
      address: item.walletAddress,
      nickname: item.nickname,
      createdAt: item.createdAt,
    });
  } catch (err) {
    console.error('Error adding to watchlist:', err);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Update watchlist item
app.patch('/api/watchlist/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname } = req.body;

    const item = await prisma.watchlistItem.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    const updated = await prisma.watchlistItem.update({
      where: { id },
      data: { nickname },
    });

    res.json({
      id: updated.id,
      address: updated.walletAddress,
      nickname: updated.nickname,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    console.error('Error updating watchlist:', err);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// Remove from watchlist
app.delete('/api/watchlist/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.watchlistItem.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    await prisma.watchlistItem.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing from watchlist:', err);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Import watchlist from localStorage
app.post('/api/watchlist/import', authMiddleware, async (req, res) => {
  try {
    const { wallets } = req.body;

    if (!Array.isArray(wallets)) {
      return res.status(400).json({ error: 'Invalid wallets array' });
    }

    const currentCount = await prisma.watchlistItem.count({
      where: { userId: req.user.userId },
    });

    const limit = TIER_LIMITS[req.user.tier];
    const available = Math.max(0, limit - currentCount);

    const imported = [];
    const skipped = [];

    for (const wallet of wallets) {
      const address = wallet.address?.toLowerCase();
      if (!address || !address.startsWith('0x')) {
        skipped.push({ address, reason: 'invalid' });
        continue;
      }

      // Check if already exists
      const existing = await prisma.watchlistItem.findFirst({
        where: { userId: req.user.userId, walletAddress: address },
      });

      if (existing) {
        skipped.push({ address, reason: 'duplicate' });
        continue;
      }

      if (imported.length >= available) {
        skipped.push({ address, reason: 'limit' });
        continue;
      }

      const item = await prisma.watchlistItem.create({
        data: {
          userId: req.user.userId,
          walletAddress: address,
          nickname: wallet.nickname || null,
        },
      });

      imported.push({
        id: item.id,
        address: item.walletAddress,
        nickname: item.nickname,
      });
    }

    res.json({
      imported,
      skipped,
      importedCount: imported.length,
      skippedCount: skipped.length,
      limitReached: skipped.some(s => s.reason === 'limit'),
    });
  } catch (err) {
    console.error('Error importing watchlist:', err);
    res.status(500).json({ error: 'Failed to import watchlist' });
  }
});

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

app.get('/api/subscription', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { watchlists: true },
    });

    res.json({
      tier: user.tier,
      isDev: user.isDev,
      watchlistLimit: TIER_LIMITS[user.tier],
      watchlistUsed: user.watchlists.length,
    });
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ============================================
// POLYMARKET DATA ENDPOINTS
// ============================================

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

      await delay(150);
    } catch (err) {
      console.error(`Error fetching closed positions:`, err.message);
      break;
    }
  }

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

    const closedPositionsRaw = await fetchAllClosedPositions(address);

    const positionLastTrade = {};
    trades.forEach(trade => {
      const condId = trade.conditionId;
      const ts = trade.timestamp || 0;
      if (!positionLastTrade[condId] || ts > positionLastTrade[condId]) {
        positionLastTrade[condId] = ts;
      }
    });

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

// ============================================
// BACKGROUND PRE-FETCHING
// ============================================

// Fetch trader data (reusable function)
async function fetchAndCacheTrader(address) {
  const cacheKey = `trader-${address}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[Prefetch] Cache hit for ${address.slice(0, 8)}...`);
    return cached;
  }

  try {
    console.log(`[Prefetch] Fetching ${address.slice(0, 8)}...`);

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

    const closedPositionsRaw = await fetchAllClosedPositions(address);

    // Process data (same as endpoint)
    const positionLastTrade = {};
    trades.forEach(trade => {
      const condId = trade.conditionId;
      const ts = trade.timestamp || 0;
      if (!positionLastTrade[condId] || ts > positionLastTrade[condId]) {
        positionLastTrade[condId] = ts;
      }
    });

    let totalPnl = 0, wins = 0, losses = 0, totalVolume = 0;
    const marketTitles = new Set();
    const openPositions = [];

    positions.forEach(pos => {
      const size = pos.size || 0;
      const initialValue = pos.initialValue || 0;
      const cashPnl = pos.cashPnl || 0;
      const pnlPercent = initialValue > 0 ? (cashPnl / initialValue) * 100 : 0;
      totalVolume += Math.abs(pos.totalBought || initialValue || 0);

      if (size > 0.01) {
        totalPnl += cashPnl;
        if (pos.title) marketTitles.add(pos.title);
        openPositions.push({
          ...pos, initialValue, currentValue: pos.currentValue || 0,
          unrealizedPnl: cashPnl, pnlPercent,
          entryPrice: pos.avgPrice || 0, currentPrice: pos.curPrice || 0,
          lastTradeTimestamp: positionLastTrade[pos.conditionId] || 0,
        });
      }
    });

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
        title: pos.title || 'Unknown Market', outcome: pos.outcome || '',
        conditionId: pos.conditionId, totalBought,
        amountWon: won ? (totalBought + realizedPnl) : 0,
        realizedPnl, pnlPercent: totalBought > 0 ? (realizedPnl / totalBought) * 100 : 0,
        won, lost, timestamp: pos.timestamp, avgPrice: pos.avgPrice,
      });
    });

    const now = Math.floor(Date.now() / 1000);
    let pnl1d = 0, pnl1w = 0, pnl1m = 0;
    closedPositions.forEach(pos => {
      const posTime = pos.timestamp || 0;
      const pnl = pos.realizedPnl || 0;
      if (posTime >= now - 86400) pnl1d += pnl;
      if (posTime >= now - 604800) pnl1w += pnl;
      if (posTime >= now - 2592000) pnl1m += pnl;
    });

    const unrealizedPnl = openPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    const tradesWithUsd = trades.map(t => ({ ...t, usdValue: (t.size || 0) * (t.price || 0) }));
    tradesWithUsd.forEach(t => totalVolume += Math.abs(t.usdValue || 0));

    const sortedTrades = [...tradesWithUsd].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const totalPositionCount = openPositions.length + closedPositions.length;
    const winRate = closedPositions.length > 0 ? ((wins / closedPositions.length) * 100) : 0;

    const result = {
      found: totalPositionCount > 0 || trades.length > 0,
      pseudonym: positions[0]?.pseudonym || trades[0]?.pseudonym || null,
      totalPnl, pnl1d: pnl1d + unrealizedPnl, pnl1w: pnl1w + unrealizedPnl, pnl1m: pnl1m + unrealizedPnl,
      winRate: parseFloat(winRate.toFixed(1)), totalVolume,
      currentValue: Array.isArray(valueData) ? (valueData[0]?.value || 0) : (valueData?.value || 0),
      wins, losses, totalPositions: totalPositionCount,
      notableBets: [...marketTitles].slice(0, 5),
      trades: sortedTrades, positions: openPositions, closedPositions,
      avgPositionSize: totalPositionCount > 0 ? totalVolume / totalPositionCount : 0,
      largestTrade: tradesWithUsd.length > 0 ? Math.max(...tradesWithUsd.map(t => Math.abs(t.usdValue || 0))) : 0,
      avgTradeSize: tradesWithUsd.length > 0 ? tradesWithUsd.reduce((sum, t) => sum + Math.abs(t.usdValue || 0), 0) / tradesWithUsd.length : 0,
      totalTrades: trades.length,
      openPositionCount: openPositions.length,
      closedPositionCount: closedPositions.length,
    };

    // Cache for 5 minutes for prefetched data
    setCache(cacheKey, result, 5 * 60 * 1000);
    console.log(`[Prefetch] Cached ${address.slice(0, 8)}... (${closedPositions.length} closed positions)`);
    return result;
  } catch (err) {
    console.error(`[Prefetch] Error for ${address}:`, err.message);
    return null;
  }
}

// Pre-fetch all wallets from database on startup
async function prefetchAllWallets() {
  console.log('[Prefetch] Starting background data fetch...');

  try {
    // Get all unique watched wallets from database
    const watchlistItems = await prisma.watchlistItem.findMany({
      select: { walletAddress: true },
      distinct: ['walletAddress'],
    });

    const addresses = watchlistItems.map(w => w.walletAddress);
    console.log(`[Prefetch] Found ${addresses.length} unique wallets to prefetch`);

    // Fetch sequentially to avoid rate limits
    for (const address of addresses) {
      await fetchAndCacheTrader(address);
      await delay(500); // Small delay between wallets
    }

    console.log(`[Prefetch] Completed! ${addresses.length} wallets cached`);
  } catch (err) {
    console.error('[Prefetch] Error:', err.message);
  }
}

// Background refresh every 5 minutes
async function startBackgroundRefresh() {
  // Initial prefetch after 5 seconds (let server start first)
  setTimeout(() => prefetchAllWallets(), 5000);

  // Refresh every 5 minutes
  setInterval(() => prefetchAllWallets(), 5 * 60 * 1000);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Polymarket Tracker API running on port ${PORT}`);
  startBackgroundRefresh();
});
