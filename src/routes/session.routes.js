import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Create Supabase admin client
const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Create or update user session
router.post('/create', async (req, res) => {
  try {
    const { userId, sessionId, deviceInfo } = req.body;

    if (!userId || !sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId and sessionId are required'
      });
    }

    const supabaseAdmin = createSupabaseAdmin();

    // First, invalidate all existing sessions for this user
    await supabaseAdmin
      .from('user_sessions')
      .update({
        is_active: false,
        last_active: new Date().toISOString(),
        invalidated_by: sessionId
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Create new session
    const { data: session, error } = await supabaseAdmin
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        device_info: deviceInfo || {},
        is_active: true,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({
        error: 'Failed to create session',
        details: error.message
      });
    }

    console.log(`Session created for user ${userId}, invalidated previous sessions`);

    res.json({
      success: true,
      session,
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Invalidate a specific session
router.post('/invalidate', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId is required'
      });
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('user_sessions')
      .update({
        is_active: false,
        last_active: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error invalidating session:', error);
      return res.status(500).json({
        error: 'Failed to invalidate session',
        details: error.message
      });
    }

    console.log(`Session ${sessionId} invalidated`);

    res.json({
      success: true,
      message: 'Session invalidated successfully'
    });

  } catch (error) {
    console.error('Session invalidation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Check if session is valid
router.get('/check/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId is required'
      });
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: session, error } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .single();

    if (error || !session) {
      return res.json({
        valid: false,
        reason: error?.message || 'Session not found or inactive'
      });
    }

    // Update last activity
    await supabaseAdmin
      .from('user_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('id', session.id);

    res.json({
      valid: true,
      session
    });

  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get user sessions (admin only)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required'
      });
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data: sessions, error } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sessions:', error);
      return res.status(500).json({
        error: 'Failed to fetch sessions',
        details: error.message
      });
    }

    res.json({
      sessions: sessions || []
    });

  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Cleanup old sessions
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;

    const supabaseAdmin = createSupabaseAdmin();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .lt('last_active', cutoffDate.toISOString())
      .eq('is_active', false);

    if (error) {
      console.error('Error cleaning up sessions:', error);
      return res.status(500).json({
        error: 'Failed to cleanup sessions',
        details: error.message
      });
    }

    console.log(`Cleaned up sessions older than ${olderThanDays} days`);

    res.json({
      success: true,
      message: `Cleaned up sessions older than ${olderThanDays} days`
    });

  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

export { router as sessionRoutes };