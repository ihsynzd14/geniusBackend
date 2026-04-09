import axios from 'axios';
import { geniusConfig } from '../config/genius.js';

class BookingService {
  constructor() {
    this._cache = null;
    this._cacheTimestamp = 0;
    this._CACHE_TTL = 300000; // 5 minutes
  }

  async getFixturesWithCoverage(sportId = 10) {
    const now = Date.now();
    if (this._cache && (now - this._cacheTimestamp) < this._CACHE_TTL) {
      return this._cache;
    }

    const url = `${geniusConfig.bookingApiUrl}/Fixtures`;
    const response = await axios.get(url, {
      params: { sportId },
      auth: {
        username: geniusConfig.bookingApiUser,
        password: geniusConfig.bookingApiPassword
      },
      headers: { Accept: 'application/json' },
      timeout: 30000
    });

    const fixtures = (response.data || []).filter(f => {
      if (!f.AvailableFeeds || f.AvailableFeeds.length === 0) return false;
      return f.AvailableFeeds.some(feed =>
        feed.Metadata &&
        feed.Metadata.Origin &&
        (feed.Metadata.Origin === 'Venue' || feed.Metadata.Origin === 'Tv')
      );
    }).map(f => {
      const matchStateFeed = f.AvailableFeeds.find(feed => feed.Type === 'MatchState' && feed.Metadata);
      return {
        fixtureId: f.FixtureId,
        name: f.Name,
        competitionId: f.CompetitionId,
        competitionName: f.CompetitionName,
        sportId: f.SportId,
        date: f.Date,
        isBooked: f.IsBooked,
        origin: matchStateFeed?.Metadata?.Origin || null,
        lineups: matchStateFeed?.Metadata?.Lineups === 'True',
        multisport: matchStateFeed?.Metadata?.Multisport === 'True'
      };
    });

    this._cache = fixtures;
    this._cacheTimestamp = now;
    return fixtures;
  }
}

export const bookingService = new BookingService();
