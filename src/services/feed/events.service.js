import { ablyService } from '../ably.service.js';

export class EventsService {
  static getEvents(fixtureId, since = null) {
    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    const buffer = ablyService.getAllCachedData(fixtureId) ?? [];
    const sinceMs = since ? new Date(since).getTime() : 0;
    if (since && isNaN(sinceMs)) {
      throw new Error('Invalid "since" parameter. Must be a valid ISO timestamp.');
    }
    const events = [];

    for (const feedUpdate of buffer) {
      if (!feedUpdate?.actions) continue;

      for (const [type, actions] of Object.entries(feedUpdate.actions)) {
        if (!Array.isArray(actions)) continue;

        for (const action of actions) {
          const ts = action.timestamp
            ? new Date(action.timestamp).getTime()
            : new Date(feedUpdate.timestamp ?? 0).getTime();

          if (ts > sinceMs) {
            events.push({ ...action, type, timestamp: action.timestamp ?? feedUpdate.timestamp });
          }
        }
      }
    }

    events.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
    return events;
  }
}
