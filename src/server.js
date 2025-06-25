import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fixturesService } from './services/fixtures.service.js';
import { fixturesV2Service } from './services/fixturesV2.service.js';
import { ablyService } from './services/ably.service.js';
import { cacheService } from './services/cache.services.js';
import { RouteHandlerService } from './services/route-handler.service.js';
import { feedRoutes } from './routes/feed.routes.js';
import { fixtureApiRoutes } from './routes/fixtureApi.routes.js';
import { detailedFixturesService } from './services/detailed.fixtures.service.js'

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  allowUpgrades: false,
  pingInterval: 25000,
  pingTimeout: 10000
});

app.use(cors());
app.use(express.json());

// Mount feed routes
app.use('/api/feed', feedRoutes);
app.use('/api/fixtures', fixtureApiRoutes);
// In-memory cache for last actions
const lastActionsCache = new Map();
const feedDataCache = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  const subscribedFixtures = new Set();

  socket.on('subscribe', async (fixtureId) => {
    try {
      if (subscribedFixtures.has(fixtureId)) return;

      const ablyFeed = await fixturesService.getAblyFeed(fixtureId);
      
      await ablyService.subscribe(
        fixtureId,
        ablyFeed.accessToken,
        ablyFeed.channelName,
        (data) => {
          socket.emit(`fixture:${fixtureId}`, data);
        }
      );

      subscribedFixtures.add(fixtureId);
      socket.join(`fixture:${fixtureId}`);
    } catch (error) {
      console.error(`Error subscribing to fixture ${fixtureId}:`, error);
      socket.emit('error', { message: 'Failed to subscribe to fixture feed' });
    }
  });

  socket.on('unsubscribe', async (fixtureId) => {
    subscribedFixtures.delete(fixtureId);
    socket.leave(`fixture:${fixtureId}`);
    
    const room = io.sockets.adapter.rooms.get(`fixture:${fixtureId}`);
    if (!room?.size) {
      await ablyService.unsubscribe(fixtureId);
      cacheService.clearFixtureData(fixtureId);
    }
  });

  socket.on('disconnect', async () => {
    for (const fixtureId of subscribedFixtures) {
      const room = io.sockets.adapter.rooms.get(`fixture:${fixtureId}`);
      if (!room?.size) {
        await ablyService.unsubscribe(fixtureId);
        cacheService.clearFixtureData(fixtureId);
      }
    }
    subscribedFixtures.clear();
  });
});

app.get('/api/fixtures/live/enhanced', async (req, res) => {
  try {
    const fixtures = await detailedFixturesService.getEnhancedLiveFixtures();
    res.json(fixtures);
  } catch (error) {
    console.error('Error fetching enhanced live fixtures:', error);
    res.status(500).json({ 
      error: 'Failed to fetch enhanced live fixtures',
      details: error.message 
    });
  }
});

// Get all live fixtures
app.get('/api/fixtures/live', async (req, res) => {
  try {
    const fixtures = await fixturesService.getLiveEvents();
    res.json(fixtures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific fixture
app.get('/api/fixtures/:id', async (req, res) => {
  try {
    const fixture = await fixturesService.getFixtures(req.params.id);
    res.json(fixture);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Routes with optimized handlers
app.get('/api/feed/:id/last-action', async (req, res) => {
  try {
    const result = await RouteHandlerService.getLastAction(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(404).json({ 
      status: 'error',
      message: error.message
    });
  }
});

app.post('/api/feed/:id/view', async (req, res) => {
  try {
    const result = await RouteHandlerService.getFeedView(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      status_code: 1,
      response: error.message,
      debug: 'post'
    });
  }
});

// Start feed for a fixture
app.post('/api/feed/start/:id', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    
    if (ablyService.isSubscribed(fixtureId)) {
      return res.json({ message: 'Feed already active', fixtureId });
    }

    const ablyFeed = await fixturesService.getAblyFeed(fixtureId);
    
    await ablyService.subscribe(
      fixtureId,
      ablyFeed.accessToken,
      ablyFeed.channelName,
      (data) => {
        io.to(`fixture:${fixtureId}`).emit(`fixture:${fixtureId}`, data);
      }
    );

    res.json({ message: 'Feed started', fixtureId });
  } catch (error) {
    console.error('Error starting feed:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to start feed. Please check your Ably credentials and fixture ID.'
    });
  }
});

// Stop feed for a fixture
app.post('/api/feed/stop/:id', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    await ablyService.unsubscribe(fixtureId);
    io.to(`fixture:${fixtureId}`).emit(`fixture:${fixtureId}:stopped`);
    res.json({ message: 'Feed stopped', fixtureId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop all feeds
app.post('/api/feed/stop-all', async (req, res) => {
  try {
    await ablyService.unsubscribeAll();
    io.emit('all-feeds-stopped');
    res.json({ message: 'All feeds stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// V2 API Routes
app.get('/api/v2/fixtures/live', async (req, res) => {
  try {
    const fixtures = await fixturesV2Service.getLiveFixtures();
    res.json(fixtures);
  } catch (error) {
    console.error('Error fetching live fixtures (V2):', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch live fixtures',
      message: error.message 
    });
  }
});

app.get('/api/v2/fixtures/recent', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 25;
    const search = req.query.search;
    
    const fixtures = await fixturesV2Service.getRecentAndCurrentFixtures(10, limit, page, search);
    res.json(fixtures);
  } catch (error) {
    console.error('Error fetching recent fixtures (V2):', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch recent fixtures',
      message: error.message 
    });
  }
});

app.get('/api/v2/fixtures/:id', async (req, res) => {
  try {
    const fixture = await fixturesV2Service.getFixtureById(req.params.id);
    res.json(fixture);
  } catch (error) {
    console.error(`Error fetching fixture ${req.params.id} (V2):`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch fixture details',
      message: error.message 
    });
  }
});

app.get('/api/v2/fixtures/:id/statistics', async (req, res) => {
  try {
    const statistics = await fixturesV2Service.getStatistics(req.params.id);
    res.json(statistics);
  } catch (error) {
    console.error(`Error fetching fixture statistics ${req.params.id} (V2):`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch fixture statistics',
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});