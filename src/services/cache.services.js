import { LRUCache } from 'lru-cache';

const feedCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5 // 5 minutes
});

const transformEventType = (type) => {
  const eventTypeMap = {
    'corners': 'Corner Awarded',
    'dangerStateChanges': 'Danger State',
    'substitutions': 'Substitution',
    'shotsOffTarget': 'Shot Off Target',
    'shotsOnTarget': 'Shot On Target',
    'offsides': 'Offside',
    'blockedShots': 'Blocked Shot',
    'kickOffs': 'Kick Off',
    'goals': 'Goal Confirmed',
    'yellowCards': 'Yellow Card',
    'redCards': 'Red Card',
    'penalties': 'Penalty',
    'fouls': 'Foul',
    'throwIns': 'Throw In',
    'goalKicks': 'Goal Kick',
    'varStateChanges': 'VAR Check'
  };
  return {
    original: type,
    display: eventTypeMap[type] || type
  };
};

const transformDangerState = (state) => {
  const dangerStateMap = {
    'HomeSafe': 'Safe',
    'HomeAttack': 'Attack',
    'HomeDangerousAttack': 'Dangerous Attack',
    'HomeCorner': 'Corner',
    'HomeGoal': 'Goal',
    'HomeFreeKick': 'Free Kick',
    'AwaySafe': 'Safe',
    'AwayAttack': 'Attack',
    'AwayDangerousAttack': 'Dangerous Attack',
    'AwayCorner': 'Corner',
    'AwayGoal': 'Goal',
    'AwayFreeKick': 'Free Kick',
    'AwayAttackingFreeKick': 'Attacking Free Kick',
    'HomeAttackingFreeKick': 'Attacking Free Kick',
    'HomeDangerousAttackingFreeKick': 'Dangerous Attacking Free Kick',
    'AwayDangerousAttackingFreeKick': 'Dangerous Attacking Free Kick',
    'Safe': 'Safe',
    'Danger': 'Danger'
  };
  return {
    original: state,
    display: dangerStateMap[state] || state
  };
};

const transformVarState = (state) => {
  const varStateMap = {
    'Danger': 'Under Review',
    'InProgress': 'In Progress',
    'Safe': 'Completed'
  };
  return {
    original: state,
    display: varStateMap[state] || state
  };
};

const transformPhase = (phase) => {
  const phaseMap = {
    'PreMatch': 'Pre Match',
    'FirstHalf': 'First Half',
    'HalfTime': 'Half Time',
    'SecondHalf': 'Second Half',
    'ExtraTimeFirstHalf': 'Extra Time First Half',
    'ExtraTimeHalfTime': 'Extra Time Half Time',
    'ExtraTimeSecondHalf': 'Extra Time Second Half',
    'Penalties': 'Penalties',
    'FullTime': 'Full Time'
  };
  return {
    original: phase,
    display: phaseMap[phase] || phase
  };
};

const transformFeedData = (data) => {
  if (!data) return null;

  // Shallow clone to avoid modifying original data
  const transformed = { ...data };

  // Add display names for all events
  Object.keys(transformed.actions || {}).forEach(actionType => {
    if (Array.isArray(transformed.actions[actionType])) {
      transformed.actions[actionType] = transformed.actions[actionType].map(event => ({
        ...event,
        typeDisplay: transformEventType(actionType).display,
        phaseDisplay: transformPhase(event.phase).display,
        dangerStateDisplay: event.dangerState ? transformDangerState(event.dangerState).display : null,
        varStateDisplay: event.varState ? transformVarState(event.varState).display : null
      }));
    }
  });

  return transformed;
};

class CacheService {
  setFeedData(fixtureId, data) {
    const key = `feed:${fixtureId}`;
    const transformedData = transformFeedData(data);
    feedCache.set(key, {
      original: data,
      transformed: transformedData,
      timestamp: Date.now()
    });
  }

  getFeedData(fixtureId) {
    const key = `feed:${fixtureId}`;
    const cached = feedCache.get(key);
    return cached?.transformed || null;
  }

  getOriginalFeedData(fixtureId) {
    const key = `feed:${fixtureId}`;
    const cached = feedCache.get(key);
    return cached?.original || null;
  }

  setLastAction(fixtureId, data) {
    const key = `lastAction:${fixtureId}`;
    const transformedData = transformFeedData(data);
    feedCache.set(key, {
      original: data,
      transformed: transformedData,
      timestamp: Date.now()
    });
  }

  getLastAction(fixtureId) {
    const key = `lastAction:${fixtureId}`;
    const cached = feedCache.get(key);
    return cached?.transformed || null;
  }

  clearFixtureData(fixtureId) {
    const feedKey = `feed:${fixtureId}`;
    const lastActionKey = `lastAction:${fixtureId}`;
    feedCache.delete(feedKey);
    feedCache.delete(lastActionKey);
  }

  clear() {
    feedCache.clear();
  }
}

export const cacheService = new CacheService();