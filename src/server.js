import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fixturesService } from './services/fixtures.service.js';
import { ablyService } from './services/ably.service.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', async (fixtureId) => {
    console.log(`Client ${socket.id} subscribing to fixture ${fixtureId}`);
    
    try {
      const ablyFeed = await fixturesService.getAblyFeed(fixtureId);
      
      await ablyService.subscribe(
        fixtureId,
        ablyFeed.accessToken,
        ablyFeed.channelName,
        (data) => {
          socket.emit(`fixture:${fixtureId}`, data);
        }
      );

      socket.join(`fixture:${fixtureId}`);
    } catch (error) {
      console.error(`Error subscribing to fixture ${fixtureId}:`, error);
      socket.emit('error', { message: 'Failed to subscribe to fixture feed' });
    }
  });

  socket.on('unsubscribe', async (fixtureId) => {
    console.log(`Client ${socket.id} unsubscribing from fixture ${fixtureId}`);
    socket.leave(`fixture:${fixtureId}`);
    
    // Only unsubscribe from Ably if no other clients are watching this fixture
    const room = io.sockets.adapter.rooms.get(`fixture:${fixtureId}`);
    if (!room || room.size === 0) {
      await ablyService.unsubscribe(fixtureId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
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

// Get last match action for a fixture
app.get('/api/feed/:id/last-action', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    
    if (!ablyService.isSubscribed(fixtureId)) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Feed not found. Please start the feed first.'
      });
    }

    const feedData = ablyService.getFeedData(fixtureId);
    if (!feedData || feedData.length === 0) {
      return res.json({
        status: 'success',
        data: {
          fixtureId: parseInt(fixtureId),
          timestamp: new Date().toISOString(),
          matchStatus: 'Pending',
          lastAction: null
        }
      });
    }

    const lastUpdate = feedData[feedData.length - 1];
    const lastAction = lastUpdate.actions ? 
      Object.entries(lastUpdate.actions)
        .flatMap(([type, actions]) => 
          Array.isArray(actions) ? actions.map(action => ({ ...action, type })) : []
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      : null;

    res.json({
      status: 'success',
      data: {
        fixtureId: parseInt(fixtureId),
        timestamp: lastUpdate.timestamp,
        matchStatus: lastUpdate.matchStatus,
        lastAction: lastAction
      }
    });
  } catch (error) {
    console.error('Error getting last action:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message
    });
  }
});

// View feed data for a fixture
app.post('/api/feed/:id/view', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    
    if (!ablyService.isSubscribed(fixtureId)) {
      return res.status(404).json({ 
        status_code: 1,
        response: 'Feed not found. Please start the feed first.',
        debug: 'post'
      });
    }

    const feedData = ablyService.getFeedData(fixtureId);
    
    if (!feedData || feedData.length === 0) {
      return res.json({
        status_code: 0,
        response: [{
          fixtureId: parseInt(fixtureId),
          timestamp: new Date().toISOString(),
          message: 'No updates available yet',
          actions: {},
          statistics: { possession: { home: 50, away: 50 } },
          teams: {
            home: { sourceName: 'Home Team' },
            away: { sourceName: 'Away Team' }
          }
        }],
        debug: 'post'
      });
    }

    // Get the last item from feedData array
    const lastFeedData = feedData[feedData.length - 1];

    res.json({
      status_code: 0,
      response: [lastFeedData], // Wrap in array to maintain consistent response structure
      debug: 'post'
    });
  } catch (error) {
    console.error('Error viewing feed:', error);
    res.status(500).json({ 
      status_code: 2,
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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});