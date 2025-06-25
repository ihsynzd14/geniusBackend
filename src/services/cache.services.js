import { LRUCache } from 'lru-cache';

const feedCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5 // 5 minutes
});

const transformEventType = (type) => {
  const eventTypeMap = {
    'corners': 'Corner Taken',
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
    'HomeCorner': 'Corner Awarded',
    'HomeGoal': 'Home Goal',
    'AwaySafe': 'Safe',
    'AwayAttack': 'Attack',
    'AwayDangerousAttack': 'Dangerous Attack',
    'AwayCorner': 'Corner Awarded',
    'AwayGoal': 'Away Goal',
    'HomePenalty': 'Penalty Awarded',
    'AwayPenalty': 'Penalty Awarded',
    'HomeFreeKick': 'Safe Free Kick',
    'AwayFreeKick': 'Safe Free Kick',
    'HomeDangerousFreeKick': 'Dangerous Free Kick',
    'AwayDangerousFreeKick': 'Dangerous Free Kick',
    'AwayAttackingFreeKick': 'Attacking Free Kick',
    'HomeAttackingFreeKick': 'Attacking Free Kick',
    'Safe': 'Safe',
    'Danger': 'Danger',
    'HomeCornerDanger': 'Corner Risk',
    'AwayCornerDanger': 'Corner Risk'
  };
  return {
    original: state,
    display: dangerStateMap[state] || state
  };
};

const transformVarState = (state, reason, outcome) => {
  const varStateMap = {
    'Danger': 'Under Review',
    'InProgress': 'In Progress',
    'Safe': 'Completed'
  };

  const varReasonMap = {
    'NotSet': 'Not Set',
    'HomeGoal': 'Home Goal',
    'HomePenalty': 'Home Penalty',
    'HomeRedCard': 'Home Red Card',
    'HomeMistakenIdentity': 'Home Mistaken Identity',
    'AwayGoal': 'Away Goal',
    'AwayPenalty': 'Away Penalty',
    'AwayRedCard': 'Away Red Card',
    'AwayMistakenIdentity': 'Away Mistaken Identity',
    'Goal': 'Goal',
    'Penalty': 'Penalty',
    'RedCard': 'Red Card',
    'MistakenIdentity': 'Mistaken Identity',
    'HomeUnknown': 'Home Unknown',
    'AwayUnknown': 'Away Unknown',
    'Unknown': 'Unknown',
    'PenaltyRetake': 'Penalty Retake',
    'HomePenaltyRetake': 'Home Penalty Retake',
    'AwayPenaltyRetake': 'Away Penalty Retake'
  };

  const varOutcomeMap = {
    'Danger': 'Under Review',
    'InProgress': 'In Progress',
    'Safe': 'Completed',
    'HomeGoalAwarded': 'Home Goal Awarded',
    'AwayGoalAwarded': 'Away Goal Awarded',
    'HomeNoGoal': 'Home No Goal',
    'AwayNoGoal': 'Away No Goal',
    'NoGoal': 'No Goal',
    'HomeGoalAwarded': 'Home Goal Awarded',
    'AwayGoalAwarded': 'Away Goal Awarded',
    'GoalAwarded': 'Goal Awarded',
    'HomeNoPenalty': 'Home No Penalty',
    'AwayNoPenalty': 'Away No Penalty',
    'NoPenalty': 'No Penalty',
    'HomePenaltyAwarded': 'Home Penalty Awarded',
    'AwayPenaltyAwarded': 'Away Penalty Awarded',
    'PenaltyAwarded': 'Penalty Awarded',
    'HomeNoRedCard': 'Home No Red Card',
    'AwayNoRedCard': 'Away No Red Card',
    'NoRedCard': 'No Red Card',
    'HomeRedCardGiven': 'Home Red Card Given',
    'AwayRedCardGiven': 'Away Red Card Given',
    'RedCardGiven': 'Red Card Given',
    'HomePlayerNotChanged': 'Home Player Not Changed',
    'AwayPlayerNotChanged': 'Away Player Not Changed',
    'PlayerNotChanged': 'Player Not Changed',
    'HomePlayerChanged': 'Home Player Changed',
    'AwayPlayerChanged': 'Away Player Changed',
    'PlayerChanged': 'Player Changed',
    'HomeNoAction': 'Home No Action',
    'AwayNoAction': 'Away No Action',
    'NoAction': 'No Action',
    'HomeUnknown': 'Home Unknown',
    'AwayUnknown': 'Away Unknown',
    'Unknown': 'Unknown',
    'HomePenaltyWillBeRetaken': 'Home Penalty Will Be Retaken',
    'AwayPenaltyWillBeRetaken': 'Away Penalty Will Be Retaken',
    'HomeNoPenaltyRetake': 'Home No Penalty Retake',
    'AwayNoPenaltyRetake': 'Away No Penalty Retake',
    'PenaltyWillBeRetaken': 'Penalty Will Be Retaken',
    'NoPenaltyRetake': 'No Penalty Retake'
  };

  let display = varStateMap[state] || state;

  // VAR durumuna göre mesajı oluştur
  if (state === 'Danger' && reason && reason !== 'NotSet') {
    display = `Possible VAR - ${varReasonMap[reason] || reason}`;
  } else if (state === 'InProgress' && reason && reason !== 'NotSet') {
    display = `VAR - ${varReasonMap[reason] || reason}`;
  } else if (state === 'Safe' && outcome && outcome !== 'NotSet') {
    display = `VAR Ended - ${varOutcomeMap[outcome] || outcome}`;
  }

  return {
    original: state,
    display: display,
    reason: reason ? (varReasonMap[reason] || reason) : null,
    outcome: outcome ? (varOutcomeMap[outcome] || outcome) : null
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
        varStateDisplay: event.varState ? transformVarState(event.varState, event.varReasonV2, event.varOutcomeV2).display : null
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