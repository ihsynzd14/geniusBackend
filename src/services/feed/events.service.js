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

    // Authoritative score, recomputed from the FULL deduped action set (not the `since` window —
    // a goal's confirm/cancel update keeps the goal's original timestamp, so it would be filtered
    // out of an incremental poll). This mirrors psychobet's calculateScores exactly, so a goal that
    // is scored then disallowed/retracted no longer inflates the score (and the wrong U/O market).
    const all = [...byKey.values()];
    const score = EventsService.calculateScore(
      all.filter(e => e.type === 'goals'),
      all.filter(e => e.type === 'varStateChanges'),
    );

    return { events, score };
  }

  /**
   * Score = confirmed goals per team − VAR goal cancellations. Ported verbatim from psychobet's
   * `calculateScores` (utils/extra-time-calculator's sibling). Only `isConfirmed` goals count;
   * a VAR decision that lands on `Safe` with outcome `NotSet` and reason `Home/AwayGoal` cancels
   * one goal for that team. Keeping it identical guarantees the bot's score === the live UI's score.
   *
   * @param {Array<{team:string,isConfirmed:boolean}>} goals
   * @param {Array<{varState:string,varReason?:string,varReasonV2?:string,varOutcome?:string,varOutcomeV2?:string}>} varDecisions
   * @returns {{ home: number, away: number }}
   */
  static calculateScore(goals, varDecisions) {
    let home = 0, away = 0;
    for (const g of goals) {
      if (!g.isConfirmed) continue;
      if (g.team === 'Home') home++;
      else if (g.team === 'Away') away++;
    }

    let cancelHome = false, cancelAway = false;
    for (const v of varDecisions) {
      if (v.varState === 'Safe' && (v.varOutcomeV2 === 'NotSet' || v.varOutcome === 'NotSet')) {
        const reason = v.varReasonV2 || v.varReason || '';
        if (reason === 'HomeGoal' && v.varOutcomeV2 === 'NotSet') cancelHome = true;
        else if (reason === 'AwayGoal' && v.varOutcomeV2 === 'NotSet') cancelAway = true;
      }
    }
    if (cancelHome) home = Math.max(0, home - 1);
    if (cancelAway) away = Math.max(0, away - 1);

    return { home, away };
  }
}
