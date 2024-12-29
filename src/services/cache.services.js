import { LRUCache } from 'lru-cache';

class CacheService {
  constructor() {
    this.feedCache = new LRUCache({
      max: 500, // Maximum number of items
      ttl: 1000 * 60, // 1 minute TTL
      updateAgeOnGet: true
    });

    this.lastActionCache = new LRUCache({
      max: 500,
      ttl: 1000 * 10, // 10 seconds TTL
      updateAgeOnGet: true
    });
  }

  setFeedData(fixtureId, data) {
    this.feedCache.set(fixtureId, data);
  }

  getFeedData(fixtureId) {
    return this.feedCache.get(fixtureId);
  }

  setLastAction(fixtureId, data) {
    this.lastActionCache.set(fixtureId, {
      timestamp: Date.now(),
      data
    });
  }

  getLastAction(fixtureId) {
    return this.lastActionCache.get(fixtureId);
  }

  clearFixtureData(fixtureId) {
    this.feedCache.delete(fixtureId);
    this.lastActionCache.delete(fixtureId);
  }
}

export const cacheService = new CacheService();