import express from 'express';
import { fixtureApiService } from '../services/fixture-api.service.js';

const router = express.Router();

// Get all sports
router.get('/sports', async (req, res) => {
  try {
    const sports = await fixtureApiService.getSports();
    res.json(sports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get competitions for a sport
router.get('/sports/:sportId/competitions', async (req, res) => {
  try {
    const competitions = await fixtureApiService.getCompetitions(req.params.sportId);
    res.json(competitions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get seasons for a competition
router.get('/competitions/:competitionId/seasons', async (req, res) => {
  try {
    const seasons = await fixtureApiService.getSeasons(req.params.competitionId);
    res.json(seasons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get fixtures for a season
router.get('/seasons/:seasonId/fixtures', async (req, res) => {
  try {
    const fixtures = await fixtureApiService.getFixtures(req.params.seasonId);
    res.json(fixtures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific fixture details
router.get('/fixtures/:fixtureId', async (req, res) => {
  try {
    const fixture = await fixtureApiService.getFixtureDetails(req.params.fixtureId);
    res.json(fixture);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get team roster
router.get('/teams/:competitorId/roster', async (req, res) => {
  try {
    const roster = await fixtureApiService.getTeamRoster(req.params.competitorId);
    res.json(roster);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get competitor details
router.get('/competitors/:competitorId', async (req, res) => {
  try {
    const competitor = await fixtureApiService.getCompetitorDetails(req.params.competitorId);
    res.json(competitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get venue details
router.get('/venues/:venueId', async (req, res) => {
  try {
    const venue = await fixtureApiService.getVenueDetails(req.params.venueId);
    res.json(venue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active fixtures for a sport
router.get('/sports/:sportId/active-fixtures', async (req, res) => {
  try {
    const fixtures = await fixtureApiService.getActiveFixtures(req.params.sportId);
    res.json(fixtures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as fixtureApiRoutes };