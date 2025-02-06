import { cacheService } from './cache.services.js';
import { ablyService } from './ably.service.js';

class RouteHandlerService {
  static async getLastAction(fixtureId) {
    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    return { 
      data: ablyService.getRawFeed(fixtureId),
      _ts: Date.now() 
    };
  }

  static async getFeedView(fixtureId) {
    const cachedData = cacheService.getFeedData(fixtureId);
    if (cachedData) {
      return {
        status_code: 0,
        response: [cachedData],
        debug: 'post'
      };
    }

    const feedData = ablyService.getFeedData(fixtureId);
    if (!feedData?.length) {
      return {
        status_code: 0,
        response: [{
          fixtureId: parseInt(fixtureId),
          timestamp: new Date().toISOString(),
          message: 'No updates available yet'
        }],
        debug: 'post'
      };
    }

    const lastUpdate = feedData[feedData.length - 1];
    cacheService.setFeedData(fixtureId, lastUpdate);

    return {
      status_code: 0,
      response: [lastUpdate],
      debug: 'post'
    };
  }
}

export { RouteHandlerService };