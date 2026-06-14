import { ablyService } from '../ably.service.js';

/**
 * Flattens the in-memory Ably buffer into a chronological list of discrete match
 * events (goals, phaseChanges, stoppageTimeAnnouncements, ...) for a fixture.
 *
 * The buffer stores raw Genius messages as { raw, _geniusTs, _backendTs }, where
 * `raw.matchActions` is the nested Genius payload (e.g. goals.goals,
 * phaseChanges.phaseChanges, stoppageTimeAnnouncements.stoppageTimeAnnouncements).
 * We normalise each message with ablyService.processMatchActions — the exact same
 * mapping the live socket feed relies on — so consumers get the flat shape with
 * `phase`, `addedMinutes`, `currentPhase`, etc.
 *
 * Genius messages are cumulative: the same action (stable `id`) recurs across many
 * buffered messages, which is why the frontend merges them by id. We do the same here,
 * deduping by `${type}:${id}` and keeping the latest occurrence, so callers never
 * over-count (e.g. a single goal counted once, not once per buffered snapshot).
 */
export class EventsService {
  static getEvents(fixtureId, since = null) {
    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    const sinceMs = since ? new Date(since).getTime() : 0;
    if (since && isNaN(sinceMs)) {
      throw new Error('Invalid "since" parameter. Must be a valid ISO timestamp.');
    }

    const buffer = ablyService.getAllCachedData(fixtureId) ?? [];

    // Dedupe across cumulative snapshots by type+id, keeping the latest occurrence.
    const byKey = new Map();

    for (const feedUpdate of buffer) {
      const matchActions = feedUpdate?.raw?.matchActions;
      if (!matchActions) continue;

      const processed = ablyService.processMatchActions(matchActions);

      for (const [type, actions] of Object.entries(processed)) {
        if (!Array.isArray(actions)) continue;

        for (const action of actions) {
          const key = action.id != null
            ? `${type}:${action.id}`
            : `${type}:${action.timestamp ?? ''}`;
          byKey.set(key, { ...action, type });
        }
      }
    }

    const events = [];
    for (const event of byKey.values()) {
      const ts = event.timestamp ? new Date(event.timestamp).getTime() : 0;
      if (ts > sinceMs) events.push(event);
    }

    events.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });

    return events;
  }
}
