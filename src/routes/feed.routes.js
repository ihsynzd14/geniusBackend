import express from 'express';
import { LastActionService } from '../services/feed/last-action.service.js';
import { EventsService } from '../services/feed/events.service.js';

const router = express.Router();

router.get('/:id/last-action', async (req, res) => {
  try {
    const result = await LastActionService.getLastAction(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error getting last action:', error);
    res.status(error.message.includes('Feed not found') ? 404 : 500).json({ 
      status: 'error',
      message: error.message
    });
  }
});

router.get('/:id/events', (req, res) => {
  try {
    const { events, score } = EventsService.getEvents(req.params.id, req.query.since ?? null);
    res.json({ status: 'success', count: events.length, events, score });
  } catch (error) {
    console.error('[feed/events] Error:', error.message);
    res.status(error.message.includes('Feed not found') ? 404 : 500).json({
      status: 'error',
      message: error.message
    });
  }
});

export { router as feedRoutes };