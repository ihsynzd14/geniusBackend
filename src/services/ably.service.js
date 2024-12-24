import Ably from 'ably';

class AblyService {
  constructor() {
    this.activeSubscriptions = new Map();
    this.feedData = new Map();
  }

  processMatchActions(matchActions) {
    if (!matchActions) {
      console.log("matchActions is null or undefined. returning empty object");
      return {};
    }

    console.log("Raw matchActions:", JSON.stringify(matchActions, null, 2)); // added log

      const shotsOffWoodwork = matchActions.shotsOffWoodwork;
      console.log("Raw shotsOffWoodwork:", JSON.stringify(shotsOffWoodwork, null, 2));

    return {
      goals: this.processGoals(matchActions.goals?.goals || []),
      yellowCards: this.processBasicActions(matchActions.yellowCards?.matchActions || []),
      secondYellowCards: this.processBasicActions(matchActions.secondYellowCards?.matchActions || []),
      straightRedCards: this.processBasicActions(matchActions.straightRedCards?.matchActions || []),
      penalties: this.processPenalties(matchActions.penalties?.penalties || []),
      penaltyRiskChanges: this.processPenaltyRiskChanges(matchActions.penaltyRiskChanges || []),
      substitutions: this.processSubstitutions(matchActions.substitutions?.substitutions || []),
      shotsOnTarget: this.processShotsOnTarget(matchActions.shotsOnTarget?.shotsOnTarget || []),
      shotsOffTarget: this.processBasicActions(matchActions.shotsOffTarget?.matchActions || []),
        shotsOffWoodwork: this.processShotsOffWoodwork(shotsOffWoodwork?.shotsOffWoodwork || []),
      blockedShots: this.processBasicActions(matchActions.blockedShots?.matchActions || []),
      corners: this.processBasicActions(matchActions.corners?.matchActions || []),
      cornersV2: this.processCornersV2(matchActions.cornersV2?.corners || []),
      penaltiesAwarded: this.processBasicActions(matchActions.penaltiesAwarded?.matchActions || []),
      fouls: this.processFouls(matchActions.fouls?.fouls || []),
      offsides: this.processBasicActions(matchActions.offsides?.matchActions || []),
      goalKicks: this.processBasicActions(matchActions.goalKicks?.matchActions || []),
      missedPenalties: this.processBasicActions(matchActions.missedPenalties?.matchActions || []),
      savedPenalties: this.processBasicActions(matchActions.savedPenalties?.matchActions || []),
      throwIns: this.processBasicActions(matchActions.throwIns?.matchActions || []),
      possessionChanges: this.processPossessionChanges(matchActions.possessionChanges?.possessionChanges || []),
      stoppageTimeAnnouncements: this.processStoppageTime(matchActions.stoppageTimeAnnouncements?.stoppageTimeAnnouncements || []),
      phaseChanges: this.processPhaseChanges(matchActions.phaseChanges?.phaseChanges || []),
      clockActions: this.processClockActions(matchActions.clockActions?.clockActions || []),
      dangerStateChanges: this.processDangerStateChanges(matchActions.dangerStateChanges?.dangerStateChanges || []),
      bookingStateChanges: this.processBookingStateChanges(matchActions.bookingStateChanges?.bookingStateChanges || []),
      lineupUpdates: this.processLineupUpdates(matchActions.lineupUpdates?.updates || []),
      systemMessages: this.processSystemMessages(matchActions.systemMessages?.systemMessages || []),
      kickOffs: this.processBasicActions(matchActions.kickOffs?.matchActions || []),
      varStateChanges: this.processVarStateChanges(matchActions.varStateChanges?.varStateChanges || [])
    };
  }

  processBasicActions(actions) {
    if (!Array.isArray(actions)) {
      console.log('processBasicActions: actions is not an array:', actions);
      return [];
    }
    return actions.map(action => ({
      id: action.id,
      timestamp: action.timestampUtc,
      phase: action.phase,
      timeElapsed: action.timeElapsedInPhase,
      team: action.team,
      playerId: action.playerInternalId,
      isConfirmed: action.isConfirmed
    }));
  }

  processGoals(goals) {
    if (!Array.isArray(goals)) return [];
    return goals.map(goal => ({
      ...this.processBasicActions([goal])[0],
      scoredBy: goal.scoredByInternalId,
      assistBy: goal.assistByInternalId,
      isOwnGoal: goal.isOwnGoal,
      wasPenalty: goal.wasScoredFromPenalty
    }));
  }

  processPenalties(penalties) {
    if (!Array.isArray(penalties)) return [];
    return penalties.map(penalty => ({
      ...this.processBasicActions([penalty])[0],
      outcome: penalty.penaltyOutcome?.outcome || 'Unknown',
      isOutcomeConfirmed: penalty.penaltyOutcome?.isConfirmed
    }));
  }

  processPenaltyRiskChanges(changes) {
    if (!Array.isArray(changes)) return [];
    return changes.map(change => ({
      id: change.id,
      timestamp: change.timestampUtc,
      phase: change.phase,
      timeElapsed: change.timeElapsedInPhase,
      riskState: change.penaltyRiskState,
      isConfirmed: change.isConfirmed
    }));
  }

  processSubstitutions(substitutions) {
    if (!Array.isArray(substitutions)) return [];
    return substitutions.map(sub => ({
      ...this.processBasicActions([sub])[0],
      playerOn: sub.playerOnInternalId,
      playerOff: sub.playerOffInternalId
    }));
  }

  processShotsOnTarget(shots) {
    if (!Array.isArray(shots)) {
      console.log('processShotsOnTarget: shots is not an array:', shots);
      return [];
    }

    const processedShots = shots.map(shot => {
      try {
        return {
          id: shot.id,
          timestamp: shot.timestampUtc,
          phase: shot.phase,
          timeElapsed: shot.timeElapsedInPhase,
          team: shot.team,
          playerId: shot.playerInternalId,
          savedBy: shot.savedByInternalId,
          ballReturned: shot.ballReturnedToPlay,
          isConfirmed: shot.isConfirmed
        };
      } catch (error) {
        console.error('Error processing shot:', shot, error);
        return null
      }
    });
    const filteredShots = processedShots.filter(shot => shot !== null);
    return filteredShots
  }

    processShotsOffWoodwork(shots) {
        if (!Array.isArray(shots)) {
            console.log('processShotsOffWoodwork: shots is not an array:', shots);
            return [];
        }
    
    const processedShots = shots.map(shot => {
        try {
            return {
                id: shot.id,
                timestamp: shot.timestampUtc,
                phase: shot.phase,
                timeElapsed: shot.timeElapsedInPhase,
                team: shot.team,
                playerId: shot.playerInternalId,
                ballReturned: shot.ballReturnedToPlay,
                isConfirmed: shot.isConfirmed
            };
        }
      catch (error) {
            console.error('Error processing shotOffWoodwork:', shot, error);
            return null
        }
    });
     const filteredShots = processedShots.filter(shot => shot !== null);
    console.log("Processed shotsOffWoodwork output:", JSON.stringify(filteredShots, null, 2));
    return filteredShots;
  }
  processCornersV2(corners) {
    if (!Array.isArray(corners)) return [];
    return corners.map(corner => ({
      id: corner.id,
      phase: corner.phase,
      team: corner.team,
      awarded: {
        isConfirmed: corner.awarded?.isConfirmed,
        timestamp: corner.awarded?.timestampUtc,
        timeElapsed: corner.awarded?.timeElapsedInPhase
      },
      taken: {
        isConfirmed: corner.taken?.isConfirmed,
        timestamp: corner.taken?.timestampUtc,
        timeElapsed: corner.taken?.timeElapsedInPhase
      }
    }));
  }

  processFouls(fouls) {
    if (!Array.isArray(fouls)) return [];
    return fouls.map(foul => ({
      id: foul.id,
      timestamp: foul.timestampUtc,
      phase: foul.phase,
      timeElapsed: foul.timeElapsedInPhase,
      foulingTeam: foul.foulingTeam,
      fouledPlayer: foul.fouledPlayerInternalId,
      fouledBy: foul.fouledByInternalId,
      isConfirmed: foul.isConfirmed
    }));
  }

  processPossessionChanges(changes) {
    if (!Array.isArray(changes)) return [];
    return changes.map(change => ({
      ...this.processBasicActions([change])[0]
    }));
  }

  processStoppageTime(announcements) {
    if (!Array.isArray(announcements)) return [];
    return announcements.map(announcement => ({
      ...this.processBasicActions([announcement])[0],
      addedMinutes: announcement.addedMinutes
    }));
  }

  processPhaseChanges(changes) {
    if (!Array.isArray(changes)) return [];
    return changes.map(change => ({
      id: change.id,
      previousPhase: change.previousPhase,
      currentPhase: change.currentPhase,
      phaseStartTime: change.currentPhaseStartTime,
      isConfirmed: change.isConfirmed,
      timestamp: change.timestampUtc
    }));
  }

  processClockActions(actions) {
    if (!Array.isArray(actions)) return [];
    return actions.map(action => ({
      id: action.id,
      phase: action.phase,
      timeElapsed: action.timeElapsedInPhase,
      timestamp: action.timestampUtc,
      activityType: action.activityType,
      isClockRunning: action.isClockRunning,
      isConfirmed: action.isConfirmed
    }));
  }

  processDangerStateChanges(changes) {
    if (!Array.isArray(changes)) return [];
    return changes.map(change => ({
      ...this.processBasicActions([change])[0],
      dangerState: change.dangerState
    }));
  }

  processBookingStateChanges(changes) {
    if (!Array.isArray(changes)) return [];
    return changes.map(change => ({
      ...this.processBasicActions([change])[0],
      bookingState: change.bookingState
    }));
  }

  processLineupUpdates(updates) {
    if (!Array.isArray(updates)) return [];
    return updates.map(update => ({
      id: update.id,
      phase: update.phase,
      timeElapsed: update.timeElapsedInPhase,
      team: update.team,
      lineup: {
        starters: (update.newLineup?.startingOnPitch || []).map(player => ({
          id: player.internalId,
          sourceId: player.sourceId,
          name: player.sourceName,
          number: player.shirtNumber,
          position: player.playerPosition
        })),
        bench: (update.newLineup?.startingBench || []).map(player => ({
          id: player.internalId,
          sourceId: player.sourceId,
          name: player.sourceName,
          number: player.shirtNumber,
          position: player.playerPosition
        })),
        formation: update.newLineup?.formation
      },
      isConfirmed: update.isConfirmed,
      timestamp: update.timestampUtc
    }));
  }

  processSystemMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages.map(message => ({
      id: message.id,
      phase: message.phase,
      timeElapsed: message.timeElapsedInPhase,
      messageId: message.messageId,
      message: message.message,
      timestamp: message.timestamp
    }));
  }

  processVarStateChanges(changes) {
    if (!Array.isArray(changes)) return [];
    return changes.map(change => ({
      ...this.processBasicActions([change])[0],
      varState: change.varState,
      varReason: change.varReason,
      varOutcome: change.varOutcome,
      varReasonV2: change.varReasonV2,
      varOutcomeV2: change.varOutcomeV2
    }));
  }

  async subscribe(fixtureId, ablyToken, channelName, onMessage) {
    try {
      if (this.activeSubscriptions.has(fixtureId)) {
        console.log(`Already subscribed to fixture ${fixtureId}`);
        return;
      }

      this.feedData.set(fixtureId, []);

      const clientOptions = {
        token: ablyToken,
        authCallback: async (tokenParams, callback) => {
          try {
            const ablyFeed = await fixturesService.getAblyFeed(fixtureId);
            callback(null, { token: ablyFeed.accessToken });
          } catch (error) {
            callback(error, null);
          }
        },
        environment: 'geniussports',
        fallbackHosts: [
          'geniussports-a-fallback.ably-realtime.com',
          'geniussports-b-fallback.ably-realtime.com',
          'geniussports-c-fallback.ably-realtime.com',
          'geniussports-d-fallback.ably-realtime.com',
          'geniussports-e-fallback.ably-realtime.com'
        ],
        useBinaryProtocol: true,
        queueMessages: true,
        disconnectedRetryTimeout: 5000,
        suspendedRetryTimeout: 15000,
        httpMaxRetryCount: 3,
        realtimeRequestTimeout: 10000
      };

      const client = new Ably.Realtime(clientOptions);

      client.connection.on('connected', () => {
        console.log(`Ably connection established for fixture ${fixtureId}`);
      });

      client.connection.on('disconnected', () => {
        console.log(`Ably connection disconnected for fixture ${fixtureId}, attempting to reconnect...`);
      });

      client.connection.on('suspended', () => {
        console.log(`Ably connection suspended for fixture ${fixtureId}, waiting before retry...`);
      });

      client.connection.on('failed', async (err) => {
        console.error(`Ably connection failed for fixture ${fixtureId}:`, err);
        await this.unsubscribe(fixtureId);
        setTimeout(() => this.subscribe(fixtureId, ablyToken, channelName, onMessage), 5000);
      });

      const channel = client.channels.get(channelName, {
        params: { rewind: '2m' }
      });

      channel.on('attached', () => {
        console.log(`Successfully attached to channel ${channelName}`);
      });

      channel.on('detached', () => {
        console.log(`Channel ${channelName} detached, attempting to reattach...`);
        channel.attach();
      });

      channel.on('error', async (err) => {
        console.error(`Channel error for ${channelName}:`, err);
        if (err.code === 40330) {
          await this.unsubscribe(fixtureId);
          setTimeout(() => this.subscribe(fixtureId, ablyToken, channelName, onMessage), 5000);
        }
      });

      channel.subscribe(message => {
        try {
          const matchData = message.data;
          if (!matchData) {
            console.warn(`Received empty message data for fixture ${fixtureId}`);
            return;
          }

          const feedUpdate = {
            fixtureId,
            timestamp: new Date().toISOString(),
            matchStatus: matchData.matchStatus,
            currentVarState: matchData.currentVarState,
            statistics: matchData.statistics || {},
            sourceInfo: matchData.sourceInfo || {},
            teams: {
              home: matchData.homeTeam,
              away: matchData.awayTeam
            },
            actions: this.processMatchActions(matchData.matchActions)
          };

          const fixtureData = this.feedData.get(fixtureId) || [];
          fixtureData.push(feedUpdate);
          if (fixtureData.length > 100) {
            fixtureData.shift();
          }
          this.feedData.set(fixtureId, fixtureData);

          onMessage(feedUpdate);
        } catch (error) {
          console.error(`Error processing message for fixture ${fixtureId}:`, error);
        }
      });

      this.activeSubscriptions.set(fixtureId, { client, channel });
      console.log(`Subscribed to fixture ${fixtureId}`);
    } catch (error) {
      console.error(`Error subscribing to fixture ${fixtureId}:`, error);
      await this.unsubscribe(fixtureId);
      throw error;
    }
  }

  async unsubscribe(fixtureId) {
    try {
      const subscription = this.activeSubscriptions.get(fixtureId);
      if (subscription) {
        const { client, channel } = subscription;
        if (channel) {
          await new Promise(resolve => {
            channel.unsubscribe();
            channel.detach(err => {
              if (err) console.error(`Error detaching channel for fixture ${fixtureId}:`, err);
              resolve();
            });
          });
        }
        if (client) {
          await new Promise(resolve => {
            client.close();
            client.connection.on('closed', resolve);
          });
        }
        this.activeSubscriptions.delete(fixtureId);
        this.feedData.delete(fixtureId);
        console.log(`Unsubscribed from fixture ${fixtureId}`);
      }
    } catch (error) {
      console.error(`Error unsubscribing from fixture ${fixtureId}:`, error);
    }
  }

  async unsubscribeAll() {
    const promises = Array.from(this.activeSubscriptions.keys()).map(fixtureId =>
      this.unsubscribe(fixtureId)
    );
    await Promise.all(promises);
    this.feedData.clear();
  }

  getFeedData(fixtureId) {
    return this.feedData.get(fixtureId) || [];
  }

  isSubscribed(fixtureId) {
    const subscription = this.activeSubscriptions.get(fixtureId);
    if (!subscription) return false;
    return subscription.client.connection.state === 'connected';
  }
}

export const ablyService = new AblyService();