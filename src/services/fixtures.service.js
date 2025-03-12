import axios from 'axios';
import { geniusConfig } from '../config/genius.js';
import { authService } from './auth.service.js';

class FixturesService {
  async getFixtures(fixtureId = null) {
    try {
      if (!authService.accessToken) {
        await authService.authenticate();
      }

      const fromDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const toDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      let url, headers;
      if (fixtureId) {
        url = `${geniusConfig.fixtureUrlV1}/${fixtureId}`;
        headers = authService.getHeadersV1();
      } else {
        url = `${geniusConfig.matchProdStateUrl}/sources/${geniusConfig.sourceId}/sports/${geniusConfig.sportId}/schedule?from=${fromDate}&to=${toDate}`;
        headers = authService.getHeaders();
      }

      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getFixtures(fixtureId);
      }
      throw error;
    }
  }

  async getLiveEvents() {
    const fixtures = await this.getFixtures();
    return fixtures.filter(fixture => 
      fixture.status !== 'Cancelled' && 
      fixture.origin === 'Venue'
    );
  }

  async getMatchState(fixtureId) {
    try {
      if (!authService.accessToken) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.msFixtureUrl}/${fixtureId}`;
      const response = await axios.get(url, {
        headers: authService.getHeaders()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getMatchState(fixtureId);
      }
      throw error;
    }
  }

  async getAblyFeed(fixtureId) {
    try {
      if (!authService.accessToken) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.matchProdStateUrl}/sources/${geniusConfig.sourceId}/sports/${geniusConfig.sportId}/fixtures/${fixtureId}/liveaccess`;
      const response = await axios.get(url, {
        headers: authService.getHeaders()
      });

      const { channelName, accessToken } = response.data;
      
      if (!channelName || !accessToken) {
        throw new Error('Missing channel name or access token in response');
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getAblyFeed(fixtureId);
      }
      throw error;
    }
  }
}

export const fixturesService = new FixturesService();