import axios from 'axios';
import { geniusConfig } from '../config/genius.js';
import { authService } from './auth.service.js';
import { normalizeSearchTerm } from '../utils/string.utils.js';

class FixturesV2Service {
  constructor() {
    // In-memory cache for fixture name indexes
    // Key: stringified competitionIds or 'recent', Value: { data, timestamp }
    this._nameIndexCache = new Map();
    this._NAME_INDEX_TTL = 60000; // 60 seconds TTL
  }

  /**
   * Get a lightweight name index for fixtures by competition IDs.
   * Returns only { id, name, competitionName } per fixture.
   * Results are cached in-memory for 60 seconds.
   */
  async getFixtureNameIndexByCompetitions(competitionIds) {
    const cacheKey = `competitions:${competitionIds.sort().join(',')}`;
    const cached = this._nameIndexCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this._NAME_INDEX_TTL) {
      return cached.data;
    }

    // Build the same filter as getFixturesByCompetitions (without search)
    const competitionFilter = `competitionId[in]:${competitionIds.join(',')}`;
    const now = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const oneWeekAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const combinedFilter = `${competitionFilter}~startDate[gte]:${now}~startDate[lte]:${oneWeekAhead}~eventStatusType[notequals]:Finished`;

    // Fetch all fixtures in batches of 100 (API max)
    const maxPageSize = 100;
    let allItems = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/fixtures`;
      const response = await axios.get(url, {
        headers: authService.getHeadersV2(),
        params: {
          filter: combinedFilter,
          sortBy: 'startDate',
          page: currentPage,
          pageSize: maxPageSize
        }
      });

      const apiResult = response.data;
      allItems = allItems.concat(apiResult.items);

      const totalPages = Math.ceil(apiResult.totalItems / maxPageSize);
      hasMorePages = currentPage < totalPages;
      currentPage++;

      // Safety limit: max 50 pages = 5000 items
      if (currentPage > 50) break;
    }

    // Map to lightweight name-only entries
    const result = {
      items: allItems.map(fixture => ({
        id: fixture.id,
        name: fixture.name,
        competitionName: fixture.competition?.name || ''
      })),
      totalItems: allItems.length
    };

    // Cache the result
    this._nameIndexCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Get a lightweight name index for recent fixtures (admin use).
   * Returns only { id, name, competitionName } per fixture.
   * Results are cached in-memory for 60 seconds.
   */
  async getRecentFixtureNameIndex(sportId = 10) {
    const cacheKey = `recent:${sportId}`;
    const cached = this._nameIndexCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this._NAME_INDEX_TTL) {
      return cached.data;
    }

    const now = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const oneWeekAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const filter = `sportId[equals]:${sportId}~startDate[gte]:${now}~startDate[lte]:${oneWeekAhead}~eventStatusType[notequals]:Finished`;

    const maxPageSize = 100;
    let allItems = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const apiResult = await this.getFixtures({
        filter: filter,
        sortBy: 'startDate',
        page: currentPage,
        pageSize: maxPageSize
      });

      allItems = allItems.concat(apiResult.items);

      const totalPages = Math.ceil(apiResult.totalItems / maxPageSize);
      hasMorePages = currentPage < totalPages;
      currentPage++;

      if (currentPage > 50) break;
    }

    const result = {
      items: allItems.map(fixture => ({
        id: fixture.id,
        name: fixture.name,
        competitionName: fixture.competition?.name || ''
      })),
      totalItems: allItems.length
    };

    this._nameIndexCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

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
    
    // Handle status filtering
    if (status === 'notfinished') {
      filter += `~eventStatusType[notequals]:Finished`;
    } else if (status) {
      // Allow filtering by any specific status
      filter += `~eventStatusType[equals]:${status}`;
    }
    
    // If no search term, use the original approach
    if (!search) {
      return this.getFixtures({
        filter: filter,
        sortBy: 'startDate',
        page: page,
        pageSize: limit
      });
    }
    
    // When search is present, we need to implement accent-insensitive search
    // The Genius API doesn't support accent-insensitive search, so we need to:
    // 1. Fetch ALL results from the API (with max page size)
    // 2. Filter them locally with accent-insensitive matching
    // 3. Apply pagination to the filtered results
    
    const normalizedSearch = normalizeSearchTerm(search);
    
    // Fetch ALL results by requesting maximum page size
    // API maximum is 100 per page, so we need to fetch multiple pages
    const maxPageSize = 100;
    let allItems = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    // Fetch all pages until we have all results
    while (hasMorePages) {
      const apiResult = await this.getFixtures({
        filter: filter,
        sortBy: 'startDate',
        page: currentPage,
        pageSize: maxPageSize
      });
      
      allItems = allItems.concat(apiResult.items);
      
      // Check if there are more pages
      // API returns totalItems and we can calculate if more pages exist
      const totalPages = Math.ceil(apiResult.totalItems / maxPageSize);
      hasMorePages = currentPage < totalPages;
      currentPage++;
      
      // Safety limit to prevent infinite loops (max 50 pages = 5000 items)
      if (currentPage > 50) {
        console.warn('Search hit safety limit of 50 pages (5000 items). Some results may be missing.');
        break;
      }
    }
    
    // Filter results using accent-insensitive search
    const filteredItems = allItems.filter(fixture => {
      if (!fixture.name) return false;
      
      const normalizedFixtureName = normalizeSearchTerm(fixture.name);
      
      // Check if normalized fixture name contains the normalized search term
      return normalizedFixtureName.includes(normalizedSearch);
    });
    
    // Calculate pagination for filtered results
    const totalFilteredItems = filteredItems.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);
    
    // Calculate total pages for filtered results
    const totalPages = Math.ceil(totalFilteredItems / limit);
    
    // Return paginated result matching the original API structure
    return {
      page: page,
      pageSize: limit,
      totalItems: totalFilteredItems,
      items: paginatedItems,
      self: `/fixtures/?filter=${encodeURIComponent(filter)}&page=${page}&pageSize=${limit}&sortBy=startDate`,
      first: `/fixtures/?filter=${encodeURIComponent(filter)}&page=1&pageSize=${limit}&sortBy=startDate`,
      last: `/fixtures/?filter=${encodeURIComponent(filter)}&page=${totalPages}&pageSize=${limit}&sortBy=startDate`,
      previous: page > 1 ? `/fixtures/?filter=${encodeURIComponent(filter)}&page=${page - 1}&pageSize=${limit}&sortBy=startDate` : undefined,
      next: page < totalPages ? `/fixtures/?filter=${encodeURIComponent(filter)}&page=${page + 1}&pageSize=${limit}&sortBy=startDate` : undefined
    };
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

      // Extract search, page, and limit from additionalParams
      const { search, page = 1, limit = 100, ...otherParams } = additionalParams;

      // Create filter for multiple competition IDs
      // Format: competitionId[in]:123,456,789
      const competitionFilter = `competitionId[in]:${competitionIds.join(',')}`;
      
      // Add date filtering by default (like getRecentAndCurrentFixtures)
      let combinedFilter = competitionFilter;
      
      // Check if date filtering should be applied (default: true)
      const includeDateFilter = otherParams.includeDateFilter !== false;
      
      if (includeDateFilter) {
        // Use same date range as getRecentAndCurrentFixtures: 12 hours ago to 12 hours ahead
        const now = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const oneWeekAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        combinedFilter += `~startDate[gte]:${now}~startDate[lte]:${oneWeekAhead}~eventStatusType[notequals]:Finished`;
      }
      
      // If no search term, use the original approach
      if (!search) {
        // Merge with additional parameters
        const params = {
          filter: combinedFilter,
          sortBy: 'startDate',
          page: page,
          pageSize: limit,
          ...otherParams
        };

        // Remove includeDateFilter from params as it's not a valid API parameter
        delete params.includeDateFilter;

        // If there are additional filters, combine them
        if (otherParams.filter) {
          params.filter = `${combinedFilter}~${otherParams.filter}`;
        }

        const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/fixtures`;
        const response = await axios.get(url, {
          headers: authService.getHeadersV2(),
          params
        });
        
        return response.data;
      }
      
      // When search is present, implement accent-insensitive search
      // Same approach as getRecentAndCurrentFixtures
      const normalizedSearch = normalizeSearchTerm(search);
      
      // Fetch ALL results by requesting maximum page size
      const maxPageSize = 100;
      let allItems = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      // Fetch all pages until we have all results
      while (hasMorePages) {
        const params = {
          filter: combinedFilter,
          sortBy: 'startDate',
          page: currentPage,
          pageSize: maxPageSize,
          ...otherParams
        };
        
        // Remove includeDateFilter from params
        delete params.includeDateFilter;
        
        // If there are additional filters, combine them
        if (otherParams.filter) {
          params.filter = `${combinedFilter}~${otherParams.filter}`;
        }
        
        const url = `${geniusConfig.fixtureUrlV2.replace('http:', 'https:')}/fixtures`;
        const response = await axios.get(url, {
          headers: authService.getHeadersV2(),
          params
        });
        
        const apiResult = response.data;
        allItems = allItems.concat(apiResult.items);
        
        // Check if there are more pages
        const totalPages = Math.ceil(apiResult.totalItems / maxPageSize);
        hasMorePages = currentPage < totalPages;
        currentPage++;
        
        // Safety limit to prevent infinite loops (max 50 pages = 5000 items)
        if (currentPage > 50) {
          console.warn('Search hit safety limit of 50 pages (5000 items). Some results may be missing.');
          break;
        }
      }
      
      // Filter results using accent-insensitive search
      const filteredItems = allItems.filter(fixture => {
        if (!fixture.name) return false;
        
        const normalizedFixtureName = normalizeSearchTerm(fixture.name);
        
        // Check if normalized fixture name contains the normalized search term
        return normalizedFixtureName.includes(normalizedSearch);
      });
      
      // Calculate pagination for filtered results
      const totalFilteredItems = filteredItems.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedItems = filteredItems.slice(startIndex, endIndex);
      
      // Calculate total pages for filtered results
      const totalPages = Math.ceil(totalFilteredItems / limit);
      
      // Return paginated result matching the original API structure
      return {
        page: page,
        pageSize: limit,
        totalItems: totalFilteredItems,
        items: paginatedItems,
        self: `/fixtures/?filter=${encodeURIComponent(combinedFilter)}&page=${page}&pageSize=${limit}&sortBy=startDate`,
        first: `/fixtures/?filter=${encodeURIComponent(combinedFilter)}&page=1&pageSize=${limit}&sortBy=startDate`,
        last: `/fixtures/?filter=${encodeURIComponent(combinedFilter)}&page=${totalPages}&pageSize=${limit}&sortBy=startDate`,
        previous: page > 1 ? `/fixtures/?filter=${encodeURIComponent(combinedFilter)}&page=${page - 1}&pageSize=${limit}&sortBy=startDate` : undefined,
        next: page < totalPages ? `/fixtures/?filter=${encodeURIComponent(combinedFilter)}&page=${page + 1}&pageSize=${limit}&sortBy=startDate` : undefined
      };
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