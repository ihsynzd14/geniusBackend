import express from 'express';
import { LastActionService } from '../services/feed/last-action.service.js';

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

export { router as feedRoutes };