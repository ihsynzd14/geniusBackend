import { cacheService } from './cache.services.js';
import { ablyService } from './ably.service.js';

class RouteHandlerService {
  static dangerStateUiMap = new Map([
    ['HomeAttack', 'Attack'],
    ['AwayAttack', 'Attack'],
    ['HomeDangerousAttack', 'Dangerous Attack'],
    ['AwayDangerousAttack', 'Dangerous Attack'],
    ['HomeSafe', 'Safe'],
    ['AwaySafe', 'Safe'],
    ['HomePenalty', 'Penalty Given'],
    ['AwayPenalty', 'Penalty Given'],
    ['Safe', 'Safe'],
    ['HomeGoal', 'Goal'],
    ['AwayGoal', 'Goal'],
    ['HomeFreeKick', 'Free Kick - Safe'],
    ['AwayFreeKick', 'Free Kick - Safe'],
    ['HomeAttackingFreeKick', 'Free Kick - Attack'],
    ['AwayAttackingFreeKick', 'Free Kick - Attack'],
    ['HomeDangerousFreeKick', 'Free Kick - Dangerous'],
    ['AwayDangerousFreeKick', 'Free Kick - Dangerous']
  ]);

  static throwInUiMap = new Map([
    ['HomeAttack', 'Throw In - Attack'],
    ['AwayAttack', 'Throw In - Attack'],
    ['HomeDangerousAttack', 'Throw In - Dangerous Attack'],
    ['AwayDangerousAttack', 'Throw In - Dangerous Attack'],
    ['HomeSafe', 'Throw In - Safe'],
    ['AwaySafe', 'Throw In - Safe'],
    ['Safe', 'Throw In - Safe']
  ]);

  static shotUiMap = new Map([
    ['blockedShots', 'Shot Blocked'],
    ['shotsOnTarget', 'Shot On Target'],
    ['shotsOffTarget', 'Shot Off Target'],
    ['shotsOffWoodwork', 'Shot Hit Woodwork']
  ]);

  static getDangerStateUiName(dangerState) {
    return this.dangerStateUiMap.get(dangerState) || dangerState;
  }

  static getThrowInUiName(dangerState) {
    return this.throwInUiMap.get(dangerState) || `Throw In - ${dangerState}`;
  }

  static getShotUiName(type) {
    return this.shotUiMap.get(type) || type;
  }

  static async getLastAction(fixtureId) {
    const cachedData = cacheService.getLastAction(fixtureId);
    if (cachedData && Date.now() - cachedData.timestamp < 100) {
      return {
        status: 'success',
        data: cachedData.data
      };
    }

    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    const feedData = ablyService.getFeedData(fixtureId);
    if (!feedData?.length) {
      return {
        status: 'success',
        data: {
          fixtureId: parseInt(fixtureId),
          timestamp: new Date().toISOString(),
          matchStatus: 'Pending',
          lastAction: null
        }
      };
    }

    const lastUpdate = feedData[feedData.length - 1];
    cacheService.setLastAction(fixtureId, lastUpdate);

    return {
      status: 'success',
      data: lastUpdate
    };
  }

  static processDangerStateChanges(changes) {
    if (!changes?.length) return changes;
    
    const len = changes.length;
    for (let i = 0; i < len; i++) {
      changes[i].uiName = this.getDangerStateUiName(changes[i].dangerState);
    }
    return changes;
  }

  static processThrowIns(throwIns) {
    if (!throwIns?.length) return throwIns;
    
    const len = throwIns.length;
    for (let i = 0; i < len; i++) {
      throwIns[i].uiName = this.getThrowInUiName(throwIns[i].dangerState);
    }
    return throwIns;
  }

  static processShots(shots, type) {
    if (!shots?.length) return shots;
    
    const len = shots.length;
    for (let i = 0; i < len; i++) {
      shots[i].uiName = this.getShotUiName(type);
    }
    return shots;
  }

  static processCorners(corners) {
    if (!corners?.length) return corners;
    
    const len = corners.length;
    for (let i = 0; i < len; i++) {
      corners[i].uiName = 'Corner Awarded';
    }
    return corners;
  }

  static async getFeedView(fixtureId) {
    const cachedData = cacheService.getFeedData(fixtureId);
    if (cachedData) {
      if (cachedData.actions?.dangerStateChanges?.length) {
        cachedData.actions.dangerStateChanges = this.processDangerStateChanges(cachedData.actions.dangerStateChanges);
      }
      if (cachedData.actions?.throwIns?.length) {
        cachedData.actions.throwIns = this.processThrowIns(cachedData.actions.throwIns);
      }
      if (cachedData.actions?.blockedShots?.length) {
        cachedData.actions.blockedShots = this.processShots(cachedData.actions.blockedShots, 'blockedShots');
      }
      if (cachedData.actions?.shotsOnTarget?.length) {
        cachedData.actions.shotsOnTarget = this.processShots(cachedData.actions.shotsOnTarget, 'shotsOnTarget');
      }
      if (cachedData.actions?.shotsOffTarget?.length) {
        cachedData.actions.shotsOffTarget = this.processShots(cachedData.actions.shotsOffTarget, 'shotsOffTarget');
      }
      if (cachedData.actions?.shotsOffWoodwork?.length) {
        cachedData.actions.shotsOffWoodwork = this.processShots(cachedData.actions.shotsOffWoodwork, 'shotsOffWoodwork');
      }
      if (cachedData.actions?.corners?.length) {
        cachedData.actions.corners = this.processCorners(cachedData.actions.corners);
      }
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
    if (lastUpdate.actions?.dangerStateChanges?.length) {
      lastUpdate.actions.dangerStateChanges = this.processDangerStateChanges(lastUpdate.actions.dangerStateChanges);
    }
    if (lastUpdate.actions?.throwIns?.length) {
      lastUpdate.actions.throwIns = this.processThrowIns(lastUpdate.actions.throwIns);
    }
    if (lastUpdate.actions?.blockedShots?.length) {
      lastUpdate.actions.blockedShots = this.processShots(lastUpdate.actions.blockedShots, 'blockedShots');
    }
    if (lastUpdate.actions?.shotsOnTarget?.length) {
      lastUpdate.actions.shotsOnTarget = this.processShots(lastUpdate.actions.shotsOnTarget, 'shotsOnTarget');
    }
    if (lastUpdate.actions?.shotsOffTarget?.length) {
      lastUpdate.actions.shotsOffTarget = this.processShots(lastUpdate.actions.shotsOffTarget, 'shotsOffTarget');
    }
    if (lastUpdate.actions?.shotsOffWoodwork?.length) {
      lastUpdate.actions.shotsOffWoodwork = this.processShots(lastUpdate.actions.shotsOffWoodwork, 'shotsOffWoodwork');
    }
    if (lastUpdate.actions?.corners?.length) {
      lastUpdate.actions.corners = this.processCorners(lastUpdate.actions.corners);
    }
    cacheService.setFeedData(fixtureId, lastUpdate);

    return {
      status_code: 0,
      response: [lastUpdate],
      debug: 'post'
    };
  }
}

export { RouteHandlerService };