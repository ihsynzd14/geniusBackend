// optimized-fixtures.service.js
import { LRUCache } from 'lru-cache';
import { fixturesService } from './fixtures.service.js';
import { fixtureApiService } from './fixture-api.service.js';

class DetailedFixturesService {
  constructor() {
    // Cache for fixture details with 5 minute TTL
    this.fixtureDetailsCache = new LRUCache({
      max: 1000, // Maximum number of items
      ttl: 1000 * 60 * 5, // 5 minutes TTL
    });
  }

  async getEnhancedLiveFixtures() {
    try {
      // Get all live fixtures
      const liveFixtures = await fixturesService.getLiveEvents();
      
      // Use Promise.all to fetch all fixture details concurrently
      const enhancedFixtures = await Promise.all(
        liveFixtures.map(async (fixture) => {
          const fixtureId = fixture.fixtureId;
          
          // Try to get from cache first
          let fixtureDetails = this.fixtureDetailsCache.get(fixtureId);
          
          if (!fixtureDetails) {
            // If not in cache, fetch and cache it
            const response = await fixtureApiService.getFixtureDetails(fixtureId);
            fixtureDetails = response?._embedded?.fixtures[0];
            if (fixtureDetails) {
              this.fixtureDetailsCache.set(fixtureId, fixtureDetails);
            }
          }

          // Return only the necessary fields
          return {
            fixtureId,
            status: fixture.status,
            origin: fixture.origin,
            startDateUtc: fixture.startDateUtc,
            name: fixtureDetails?.name || 'Unknown',
            competitionName: fixtureDetails?.competitionName || 'Unknown'
          };
        })
      );

      return enhancedFixtures;
    } catch (error) {
      console.error('Error in getEnhancedLiveFixtures:', error);
      throw error;
    }
  }
}

export const detailedFixturesService = new DetailedFixturesService();