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
import { sessionRoutes } from './routes/session.routes.js';
import { detailedFixturesService } from './services/detailed.fixtures.service.js';
import { tokenManager } from './services/token.manager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || [
      "http://51.89.167.87:3001",
      "https://www.psychoff.com",
      "https://psychoff.com",
      "https://radar.psychoff.com"
    ],
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
app.use('/api/sessions', sessionRoutes);
// In-memory cache for last actions
const lastActionsCache = new Map();
const feedDataCache = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  const subscribedFixtures = new Set();
  let userSession = null;

  // Handle session authentication
  socket.on('authenticate', async (data) => {
    try {
      const { userId, sessionId } = data;

      if (!userId || !sessionId) {
        socket.emit('auth_error', { message: 'Missing userId or sessionId' });
        return;
      }

      // Verify session with backend
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/sessions/check/${sessionId}`);
      const sessionData = await response.json();

      if (sessionData.valid) {
        userSession = sessionData.session;
        socket.userId = userId;
        socket.sessionId = sessionId;
        socket.join(`user:${userId}`);

        socket.emit('auth_success', {
          message: 'Session authenticated',
          session: userSession
        });

        console.log(`Socket ${socket.id} authenticated for user ${userId}`);
      } else {
        socket.emit('auth_error', {
          message: 'Invalid or expired session',
          reason: sessionData.reason
        });
      }
    } catch (error) {
      console.error('Session authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  // Handle session invalidation notification
  socket.on('session_invalidated', (data) => {
    if (data.userId === socket.userId && data.sessionId !== socket.sessionId) {
      console.log(`Session ${socket.sessionId} invalidated for user ${socket.userId}`);
      socket.emit('force_logout', {
        message: 'You have been logged in from another device',
        reason: 'session_replaced'
      });
    }
  });

  socket.on('subscribe', async (fixtureId) => {
    try {
      if (subscribedFixtures.has(fixtureId)) {
        console.log(`Socket ${socket.id} already subscribed to fixture ${fixtureId}`);
        return;
      }

      console.log(`Socket ${socket.id} subscribing to fixture ${fixtureId}`);

      // Use token manager to get shared token for this fixture
      const ablyFeed = await tokenManager.getTokenForFixture(fixtureId);

      // Track this user for token management
      tokenManager.addUserToToken(fixtureId, socket.id);

      // Check if Ably is already subscribed to this fixture
      if (!ablyService.isSubscribed(fixtureId)) {
        console.log(`Creating new Ably subscription for fixture ${fixtureId}`);
        await ablyService.subscribe(
          fixtureId,
          ablyFeed.accessToken,
          ablyFeed.channelName,
          (data) => {
            // Broadcast to all sockets in the room
            io.to(`fixture:${fixtureId}`).emit(`fixture:${fixtureId}`, data);
          }
        );
      } else {
        console.log(`Using existing Ably subscription for fixture ${fixtureId}`);

        // Send recent cached data to the new user to catch them up
        const recentData = ablyService.getRecentFeedData(fixtureId, 10);
        if (recentData.length > 0) {
          console.log(`Sending ${recentData.length} recent updates to new user ${socket.id}`);
          // Send cached data immediately to catch up, but with a small delay to ensure socket is ready
          setTimeout(() => {
            recentData.forEach((data, index) => {
              setTimeout(() => {
                socket.emit(`fixture:${fixtureId}`, data);
              }, index * 50); // Stagger messages to prevent overwhelming
            });
          }, 100);
        } else {
          console.log(`No recent data available for fixture ${fixtureId}, user will receive next real-time updates`);
          // Send a confirmation message even if no data is available
          socket.emit(`fixture:${fixtureId}`, {
            raw: {
              matchActions: {},
              homeTeam: null,
              awayTeam: null,
              fixture: { id: fixtureId, status: 'waiting_for_data' }
            },
            _geniusTs: Date.now(),
            _backendTs: Date.now(),
            _systemMessage: 'Waiting for live data stream'
          });
        }
      }

      subscribedFixtures.add(fixtureId);
      socket.join(`fixture:${fixtureId}`);

      console.log(`Socket ${socket.id} successfully subscribed to fixture ${fixtureId}`);

      // Confirm the user is in the room and will receive broadcasts
      const room = io.sockets.adapter.rooms.get(`fixture:${fixtureId}`);
      console.log(`Room fixture:${fixtureId} now has ${room?.size || 0} users`);

      // Send a confirmation message to the user
      socket.emit(`fixture:${fixtureId}:connected`, {
        message: 'Successfully connected to real-time feed',
        timestamp: Date.now(),
        roomSize: room?.size || 0
      });
    } catch (error) {
      console.error(`Error subscribing to fixture ${fixtureId}:`, error);
      socket.emit('error', { message: 'Failed to subscribe to fixture feed' });
    }
  });

  socket.on('unsubscribe', async (fixtureId) => {
    subscribedFixtures.delete(fixtureId);
    socket.leave(`fixture:${fixtureId}`);

    // Remove user from token tracking
    tokenManager.removeUserFromToken(fixtureId, socket.id);

    const room = io.sockets.adapter.rooms.get(`fixture:${fixtureId}`);
    if (!room?.size) {
      await ablyService.unsubscribe(fixtureId);
      cacheService.clearFixtureData(fixtureId);
    }
  });

  socket.on('disconnect', async () => {
    for (const fixtureId of subscribedFixtures) {
      // Remove user from token tracking for each fixture
      tokenManager.removeUserFromToken(fixtureId, socket.id);

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

/*comment from here
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
*/


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

    const ablyFeed = await tokenManager.getTokenForFixture(fixtureId);

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

// Fetch multiple fixtures by their IDs
app.post('/api/v2/fixtures/by-ids', async (req, res) => {
  try {
    const { fixtureIds, ...additionalParams } = req.body;

    // Validate required fields
    if (!fixtureIds) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'fixtureIds is required in request body'
      });
    }

    if (!Array.isArray(fixtureIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'fixtureIds must be an array'
      });
    }

    if (fixtureIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'fixtureIds array cannot be empty'
      });
    }

    // Validate that all IDs are numbers
    const invalidIds = fixtureIds.filter(id => !Number.isInteger(id) && !Number.isInteger(Number(id)));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid fixture IDs: ${invalidIds.join(', ')}. All IDs must be numbers.`
      });
    }

    // Convert to numbers if they're strings
    const numericIds = fixtureIds.map(id => Number(id));

    // Prepare filter for multiple IDs
    const filter = `id[in]:${numericIds.join(',')}`;

    // Prepare parameters for the API call
    const params = {
      filter: filter,
      ...additionalParams
    };

    // Fetch fixtures from the service
    const fixtures = await fixturesV2Service.getFixtures(params);

    res.json({
      ...fixtures,
      requestedFixtures: numericIds.length,
      fixtureIds: numericIds
    });
  } catch (error) {
    console.error('Error fetching fixtures by IDs (V2):', error.message);
    res.status(500).json({
      error: 'Failed to fetch fixtures by IDs',
      message: error.message
    });
  }
});

// Fetch multiple fixtures by their IDs (GET version)
app.get('/api/v2/fixtures', async (req, res) => {
  try {
    const { ids, ...queryParams } = req.query;

    // Validate required fields
    if (!ids) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ids parameter is required'
      });
    }

    // Parse IDs from comma-separated string
    const fixtureIds = ids.split(',').map(id => id.trim());

    if (fixtureIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ids parameter cannot be empty'
      });
    }

    // Validate that all IDs are numbers
    const invalidIds = fixtureIds.filter(id => !Number.isInteger(Number(id)));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid fixture IDs: ${invalidIds.join(', ')}. All IDs must be numbers.`
      });
    }

    // Convert to numbers
    const numericIds = fixtureIds.map(id => Number(id));

    // Prepare filter for multiple IDs
    const filter = `id[in]:${numericIds.join(',')}`;

    // Prepare parameters for the API call
    const params = {
      filter: filter,
      ...queryParams
    };

    // Fetch fixtures from the service
    const fixtures = await fixturesV2Service.getFixtures(params);

    res.json({
      ...fixtures,
      requestedFixtures: numericIds.length,
      fixtureIds: numericIds
    });
  } catch (error) {
    console.error('Error fetching fixtures by IDs (V2):', error.message);
    res.status(500).json({
      error: 'Failed to fetch fixtures by IDs',
      message: error.message
    });
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

// Lightweight fixture name index for client-side search (admin: recent fixtures)
app.get('/api/v2/fixtures/name-index/recent', async (req, res) => {
  try {
    const nameIndex = await fixturesV2Service.getRecentFixtureNameIndex(10);
    res.json(nameIndex);
  } catch (error) {
    console.error('Error fetching recent fixture name index (V2):', error.message);
    res.status(500).json({
      error: 'Failed to fetch fixture name index',
      message: error.message
    });
  }
});

// Lightweight fixture name index for client-side search (by competition IDs)
app.post('/api/v2/fixtures/name-index/by-competitions', async (req, res) => {
  try {
    const { competitionIds } = req.body;

    if (!competitionIds || !Array.isArray(competitionIds) || competitionIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'competitionIds must be a non-empty array'
      });
    }

    const numericIds = competitionIds.map(id => Number(id));
    const nameIndex = await fixturesV2Service.getFixtureNameIndexByCompetitions(numericIds);
    res.json(nameIndex);
  } catch (error) {
    console.error('Error fetching fixture name index by competitions (V2):', error.message);
    res.status(500).json({
      error: 'Failed to fetch fixture name index',
      message: error.message
    });
  }
});

app.get('/api/v2/fixtures/recent', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 25;
    const search = req.query.search;
    const status = req.query.status;

    const fixtures = await fixturesV2Service.getRecentAndCurrentFixtures(10, limit, page, search, status);
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

app.get('/api/v2/competitions', async (req, res) => {
  try {
    const sportId = req.query.sportId || 10; // Default to sport ID 10 (football)
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const params = {
      filter: `sport.id[equals]:${sportId}`,
      page: page,
      pageSize: limit
    };

    // Add additional filters if provided
    if (req.query.search) {
      params.filter += `~name[contains]:${encodeURIComponent(req.query.search)}`;
    }

    if (req.query.sortBy) {
      params.sortBy = req.query.sortBy;
    }

    const competitions = await fixturesV2Service.getCompetitions(params);
    res.json(competitions);
  } catch (error) {
    console.error('Error fetching competitions (V2):', error.message);
    res.status(500).json({
      error: 'Failed to fetch competitions',
      message: error.message
    });
  }
});

app.post('/api/v2/fixtures/by-competitions', async (req, res) => {
  try {
    const { competitionIds, includeDateFilter = true, dateRange, ...additionalParams } = req.body;

    // Extract query parameters (page, limit, search) from URL query string
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 25;
    const search = req.query.search;

    // Validate required fields
    if (!competitionIds) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'competitionIds is required in request body'
      });
    }

    if (!Array.isArray(competitionIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'competitionIds must be an array'
      });
    }

    if (competitionIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'competitionIds array cannot be empty'
      });
    }

    // Validate that all IDs are numbers
    const invalidIds = competitionIds.filter(id => !Number.isInteger(id) && !Number.isInteger(Number(id)));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid competition IDs: ${invalidIds.join(', ')}. All IDs must be numbers.`
      });
    }

    // Convert to numbers if they're strings
    const numericIds = competitionIds.map(id => Number(id));

    // Handle custom date range if provided
    const params = {
      includeDateFilter,
      page,
      limit,
      ...additionalParams
    };

    // Add search if provided
    if (search && search.trim()) {
      params.search = search.trim();
    }

    // If custom date range is provided, override the default date filtering
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      params.includeDateFilter = false; // Disable default date filtering
      const customDateFilter = `startDate[gte]:${dateRange.startDate}~startDate[lte]:${dateRange.endDate}`;
      params.filter = params.filter ? `${params.filter}~${customDateFilter}` : customDateFilter;
    }

    const fixtures = await fixturesV2Service.getFixturesByCompetitions(numericIds, params);

    res.json({
      ...fixtures,
      requestedCompetitions: numericIds.length,
      competitionIds: numericIds,
      dateFilterApplied: includeDateFilter || !!dateRange,
      dateRange: dateRange || (includeDateFilter ? {
        startDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      } : null)
    });
  } catch (error) {
    console.error('Error fetching fixtures by competitions (V2):', error.message);
    res.status(500).json({
      error: 'Failed to fetch fixtures for competitions',
      message: error.message
    });
  }
});

const tryPort = (port) => {
  return new Promise((resolve, reject) => {
    const testServer = createServer();

    testServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use, trying alternative...`);
        testServer.close();
        resolve(false);
      } else {
        reject(err);
      }
    });

    testServer.once('listening', () => {
      testServer.close();
      resolve(true);
    });

    testServer.listen(port);
  });
};

// When the server starts, it will be accessible at IP address 51.89.167.87
// along with the port that's available (either 3000 or 3003)
const startServer = async () => {
  const PRIMARY_PORT = process.env.PORT || 3000;
  const FALLBACK_PORT = 3003;

  let PORT = PRIMARY_PORT;

  // Check if primary port is available
  const isPrimaryPortAvailable = await tryPort(PRIMARY_PORT);

  if (!isPrimaryPortAvailable) {
    console.log(`Trying fallback port ${FALLBACK_PORT}...`);
    const isFallbackPortAvailable = await tryPort(FALLBACK_PORT);

    if (!isFallbackPortAvailable) {
      console.error(`Both ports ${PRIMARY_PORT} and ${FALLBACK_PORT} are in use. Please specify a different port via the PORT environment variable.`);
      process.exit(1);
    }

    PORT = FALLBACK_PORT;
  }

  // To explicitly bind to a specific IP address, uncomment and use this code instead:
  /*
  const SERVER_IP = '51.89.167.87';
  httpServer.listen(PORT, SERVER_IP, () => {
    console.log(`Server running at http://${SERVER_IP}:${PORT}`);
  });
  */

  // Currently using default binding (all interfaces)
  httpServer.listen(PORT, () => {
    console.log(`Server running at http://51.89.167.87:${PORT}`);
  });
};

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});