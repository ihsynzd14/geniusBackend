import { fixturesService } from './fixtures.service.js';

class TokenManager {
  constructor() {
    this.fixtureTokens = new Map(); // fixtureId -> token data
    this.tokenUsers = new Map();    // fixtureId -> Set of socket IDs
    this.tokenExpiry = new Map();   // fixtureId -> expiry timestamp
  }

  async getTokenForFixture(fixtureId) {
    try {
      // Create a promise for this fixture if it doesn't exist to prevent race conditions
      if (!this.tokenPromises) {
        this.tokenPromises = new Map();
      }

      // If we're already getting a token for this fixture, return the existing promise
      if (this.tokenPromises.has(fixtureId)) {
        console.log(`Waiting for existing token promise for fixture ${fixtureId}`);
        return await this.tokenPromises.get(fixtureId);
      }

      // Create a new promise for this token request
      const tokenPromise = this._getTokenInternal(fixtureId);
      this.tokenPromises.set(fixtureId, tokenPromise);

      try {
        const result = await tokenPromise;
        return result;
      } finally {
        // Clean up the promise after completion
        this.tokenPromises.delete(fixtureId);
      }
    } catch (error) {
      console.error(`Error getting token for fixture ${fixtureId}:`, error);
      throw error;
    }
  }

  async _getTokenInternal(fixtureId) {
    // Check if we already have a valid token for this fixture
    if (this.fixtureTokens.has(fixtureId)) {
      const tokenData = this.fixtureTokens.get(fixtureId);
      const expiryTime = this.tokenExpiry.get(fixtureId);

      // Check if token is still valid (not expired, with 5min buffer)
      if (expiryTime && expiryTime > Date.now() + 300000) {
        console.log(`Using cached token for fixture ${fixtureId}`);
        return tokenData;
      }
    }

    // Get new token for this fixture
    console.log(`Fetching new token for fixture ${fixtureId}`);
    const newToken = await fixturesService.getAblyFeed(fixtureId);

    // Store token with expiry (assuming 1 hour validity, adjust as needed)
    const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now

    this.fixtureTokens.set(fixtureId, newToken);
    this.tokenExpiry.set(fixtureId, expiryTime);

    // Initialize user tracking if not exists
    if (!this.tokenUsers.has(fixtureId)) {
      this.tokenUsers.set(fixtureId, new Set());
    }

    return newToken;
  }

  addUserToToken(fixtureId, socketId, userId) {
    if (!this.tokenUsers.has(fixtureId)) {
      this.tokenUsers.set(fixtureId, new Set());
    }
    this.tokenUsers.get(fixtureId).add(socketId);
    const userLabel = userId ? `user:${userId}` : 'unauthenticated';
    console.log(`Added ${userLabel} (socket:${socketId}) to fixture ${fixtureId}. Total users: ${this.tokenUsers.get(fixtureId).size}`);
  }

  removeUserFromToken(fixtureId, socketId) {
    const users = this.tokenUsers.get(fixtureId);
    if (users) {
      users.delete(socketId);
      console.log(`Removed user ${socketId} from fixture ${fixtureId}. Remaining users: ${users.size}`);

      // If no more users, clean up token after a delay
      if (users.size === 0) {
        setTimeout(() => {
          const remainingUsers = this.tokenUsers.get(fixtureId);
          if (remainingUsers && remainingUsers.size === 0) {
            this.cleanupFixture(fixtureId);
          }
        }, 30000); // 30 second delay before cleanup
      }
    }
  }

  cleanupFixture(fixtureId) {
    console.log(`Cleaning up fixture ${fixtureId} - no active users`);
    this.fixtureTokens.delete(fixtureId);
    this.tokenExpiry.delete(fixtureId);
    this.tokenUsers.delete(fixtureId);
  }

  getUserCount(fixtureId) {
    const users = this.tokenUsers.get(fixtureId);
    return users ? users.size : 0;
  }

  hasToken(fixtureId) {
    return this.fixtureTokens.has(fixtureId);
  }

  getTokenData(fixtureId) {
    return this.fixtureTokens.get(fixtureId);
  }

  // Get all active fixtures (for monitoring/debugging)
  getActiveFixtures() {
    return Array.from(this.fixtureTokens.keys());
  }

  // Get token usage statistics (for monitoring/debugging)
  getTokenStats() {
    const stats = {};
    for (const [fixtureId, tokenData] of this.fixtureTokens) {
      const userCount = this.getUserCount(fixtureId);
      const expiryTime = this.tokenExpiry.get(fixtureId);
      stats[fixtureId] = {
        userCount,
        expiryTime,
        timeUntilExpiry: expiryTime - Date.now(),
        channelName: tokenData.channelName
      };
    }
    return stats;
  }
}

export const tokenManager = new TokenManager();