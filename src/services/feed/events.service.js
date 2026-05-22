import { ablyService } from '../ably.service.js';

export class EventsService {
  static getEvents(fixtureId, since = null) {
    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    const buffer = ablyService.getAllCachedData(fixtureId) ?? [];
    const sinceMs = since ? new Date(since).getTime() : 0;
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
            events.push({ type, timestamp: action.timestamp ?? feedUpdate.timestamp, ...action });
          }
        }
      }
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return events;
  }
}
