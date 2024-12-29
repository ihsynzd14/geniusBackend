import { ablyService } from '../ably.service.js';

export class LastActionService {
  static getLastActionFromFeed(feedData) {
    if (!feedData?.actions) return null;
    
    return Object.entries(feedData.actions)
      .flatMap(([type, actions]) => 
        Array.isArray(actions) ? actions.map(action => ({ ...action, type })) : []
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  static formatResponse(fixtureId, feedData) {
    const lastAction = this.getLastActionFromFeed(feedData);
    
    return {
      status: 'success',
      data: {
        fixtureId: parseInt(fixtureId),
        timestamp: feedData?.timestamp || new Date().toISOString(),
        matchStatus: feedData?.matchStatus || 'Pending',
        lastAction
      }
    };
  }

  static async getLastAction(fixtureId) {
    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    const feedData = ablyService.getFeedData(fixtureId);
    if (!feedData || feedData.length === 0) {
      return this.formatResponse(fixtureId);
    }

    const lastUpdate = feedData[feedData.length - 1];
    return this.formatResponse(fixtureId, lastUpdate);
  }
}