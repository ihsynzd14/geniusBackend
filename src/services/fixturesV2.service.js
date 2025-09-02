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

  async getRecentAndCurrentFixtures(sportId = 10, limit = 20, page = 1, search = null, status = null) {
    const now = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const oneWeekAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    
    let filter = `sportId[equals]:${sportId}~startDate[gte]:${now}~startDate[lte]:${oneWeekAhead}`;
    
    if (search) {
      filter += `~name[contains]:${encodeURIComponent(search)}`;
    }
    
    // Handle status filtering
    if (status === 'notfinished') {
      filter += `~eventStatusType[notequals]:Finished`;
    } else if (status) {
      // Allow filtering by any specific status
      filter += `~eventStatusType[equals]:${status}`;
    }
    
    return this.getFixtures({
      filter: filter,
      sortBy: 'startDate',
      page: page,
      pageSize: limit
    });
  }
  
  async getFixturesByCompetitions(competitionIds, additionalParams = {}) {
    try {
      if (!authService.accessTokenV2) {
        await authService.authenticate();
      }

      // Validate input
      if (!competitionIds || !Array.isArray(competitionIds) || competitionIds.length === 0) {
        throw new Error('competitionIds must be a non-empty array');
      }

      // Create filter for multiple competition IDs
      // Format: competitionId[in]:123,456,789
      const competitionFilter = `competitionId[in]:${competitionIds.join(',')}`;
      
      // Add date filtering by default (like getRecentAndCurrentFixtures)
      let combinedFilter = competitionFilter;
      
      // Check if date filtering should be applied (default: true)
      const includeDateFilter = additionalParams.includeDateFilter !== false;
      
      if (includeDateFilter) {
        // Use same date range as getRecentAndCurrentFixtures: 12 hours ago to 12 hours ahead
        const now = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const oneWeekAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        combinedFilter += `~startDate[gte]:${now}~startDate[lte]:${oneWeekAhead}`;
      }
      
      // Merge with additional parameters
      const params = {
        filter: combinedFilter,
        sortBy: 'startDate',
        page: 1,
        pageSize: 100,
        ...additionalParams
      };

      // Remove includeDateFilter from params as it's not a valid API parameter
      delete params.includeDateFilter;

      // If there are additional filters, combine them
      if (additionalParams.filter) {
        params.filter = `${combinedFilter}~${additionalParams.filter}`;
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
        return this.getFixturesByCompetitions(competitionIds, additionalParams);
      }
      throw error;
    }
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