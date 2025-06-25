import axios from 'axios';
import { geniusConfig } from '../config/genius.js';
import { authService } from './auth.service.js';

class FixturesV2Service {
  async getFixtures(params = {}) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/fixtures`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getFixtures(params);
      }
      throw error;
    }
  }

  async getFixtureById(fixtureId) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/fixtures/${fixtureId}`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2()
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getFixtureById(fixtureId);
      }
      throw error;
    }
  }

  async getSports(params = {}) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/sports`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getSports(params);
      }
      throw error;
    }
  }

  async getCompetitions(params = {}) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/competitions`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getCompetitions(params);
      }
      throw error;
    }
  }

  async getSeasons(params = {}) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/seasons`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getSeasons(params);
      }
      throw error;
    }
  }

  async getSeasonById(seasonId) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/seasons/${seasonId}`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2()
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getSeasonById(seasonId);
      }
      throw error;
    }
  }

  async getRounds(params = {}) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/rounds`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getRounds(params);
      }
      throw error;
    }
  }

  async getCompetitorTeam(teamId) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/competitors/teams/${teamId}`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2()
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getCompetitorTeam(teamId);
      }
      throw error;
    }
  }

  async getLiveFixtures() {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/fixtures`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params: {
          filter: `sportId[equals]:${geniusConfig.sportId}~status[equals]:InProgress`,
          sortBy: 'startDate'
        }
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getLiveFixtures();
      }
      throw error;
    }
  }

  async getRecentAndCurrentFixtures(sportId = 10, limit = 20, page = 1, search = null) {
    const now = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const oneWeekAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    
    let filter = `sportId[equals]:${sportId}~startDate[gte]:${now}~startDate[lte]:${oneWeekAhead}`;
    
    if (search) {
      filter += `~name[contains]:${encodeURIComponent(search)}`;
    }
    
    return this.getFixtures({
      filter: filter,
      sortBy: 'startDate',
      page: page,
      pageSize: limit
    });
  }
  
  async getStatistics(fixtureId) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      const url = `https://statistics.api.geniussports.com/v2/sports/${geniusConfig.sportId}/fixtures/${fixtureId}/liveaccess`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2()
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await authService.authenticate();
        return this.getStatistics(fixtureId);
      }
      throw error;
    }
  }
}

export const fixturesV2Service = new FixturesV2Service(); 