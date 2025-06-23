import axios from 'axios';
import { geniusConfig } from '../config/genius.js';

class FixtureApiService {
  constructor() {
    this.idToken = null;
    this.refreshToken = null;
    this.baseUrl = 'https://api.geniussports.com/Fixtures-v1/PRODPRM';
  }

  async authenticate() {
    try {
      const response = await axios.post(geniusConfig.authUrlV1, {
        user: geniusConfig.user,
        password: geniusConfig.password
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      this.idToken = response.data.IdToken;
      this.refreshToken = response.data.RefreshToken;
      return true;
    } catch (error) {
      console.error('Fixture API Authentication failed:', error);
      throw error;
    }
  }

  async refreshAuth() {
    try {
      const response = await axios.post(geniusConfig.refreshUrl, {
        user: geniusConfig.user,
        refreshtoken: this.refreshToken
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      this.idToken = response.data.IdToken;
      this.refreshToken = response.data.RefreshToken;
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return this.authenticate();
    }
  }

  getHeaders() {
    return {
      'Authorization': this.idToken,
      'x-api-key': geniusConfig.apiKeyV1,
      'Content-Type': 'application/json'
    };
  }

  async makeRequest(endpoint, retryCount = 0) {
    try {
      if (!this.idToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: this.getHeaders()
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 401 && retryCount < 2) {
        await this.refreshAuth();
        return this.makeRequest(endpoint, retryCount + 1);
      }
      throw error;
    }
  }

  // Get all sports
  async getSports() {
    return this.makeRequest('/sports');
  }

  // Get competitions for a specific sport
  async getCompetitions(sportId) {
    return this.makeRequest(`/sports/${sportId}/competitions`);
  }

  // Get seasons for a specific competition
  async getSeasons(competitionId) {
    return this.makeRequest(`/competitions/${competitionId}/seasons`);
  }

  // Get fixtures for a specific season
  async getFixtures(seasonId) {
    return this.makeRequest(`/seasons/${seasonId}/fixtures`);
  }

  // Get specific fixture details
  async getFixtureDetails(fixtureId) {
    return this.makeRequest(`/fixtures/${fixtureId}`);
  }

  // Get roster/contracts for a specific competitor (team)
  async getTeamRoster(competitorId) {
    return this.makeRequest(`/contracts/${competitorId}`);
  }

  // Get specific competitor details
  async getCompetitorDetails(competitorId) {
    return this.makeRequest(`/competitors/${competitorId}`);
  }

  // Get venue details
  async getVenueDetails(venueId) {
    return this.makeRequest(`/venues/${venueId}`);
  }

  // Utility method to get all active fixtures for a sport
  async getActiveFixtures(sportId) {
    try {
      // Get all competitions for the sport
      const competitions = await this.getCompetitions(sportId);
      const activeFixtures = [];

      // For each competition, get active seasons and their fixtures
      for (const competition of competitions.competitions) {
        const seasons = await this.getSeasons(competition.id);
        
        for (const season of seasons.seasons) {
          // Check if season is current/active
          const now = new Date();
          const startDate = new Date(season.seasonproperty.startDate);
          const endDate = new Date(season.seasonproperty.endDate);

          if (now >= startDate && now <= endDate) {
            const fixtures = await this.getFixtures(season.id);
            activeFixtures.push(...fixtures.fixtures);
          }
        }
      }

      return activeFixtures;
    } catch (error) {
      console.error('Error fetching active fixtures:', error);
      throw error;
    }
  }
}

export const fixtureApiService = new FixtureApiService();