# Feed Status Monitoring Integration Guide

## Current State Analysis

Your current implementation has basic feed management but lacks comprehensive feed status monitoring:

### Existing Capabilities ✅
- **Basic Connection Tracking**: `ablyService.isSubscribed(fixtureId)` checks if a fixture is subscribed
- **Connection State Monitoring**: Ably connection events (connected, disconnected, suspended, failed)
- **Feed Start/Stop Endpoints**: Manual feed control via `/api/feed/start/:id` and `/api/feed/stop/:id`
- **Socket.IO Integration**: Real-time data forwarding to frontend clients

### Missing Capabilities ❌
- **Heartbeat Monitoring**: No systematic heartbeat tracking
- **Feed Reliability Status**: No monitoring of Genius Sports reliability indicators
- **Feed Health Metrics**: No tracking of data flow, latency, or quality
- **Automatic Recovery**: Limited automatic recovery mechanisms
- **Frontend Status API**: No dedicated endpoints for frontend feed status queries

## Genius Sports Feed Monitoring Capabilities

Based on the official documentation and [Fixtures API V2 Swagger documentation](https://swaggerui.api.geniussports.com/?url=https://explorer.api.geniussports.com/Fixtures%2Fv2%2FProduction%2Fswagger-latest.json#/), Genius Sports provides:

### 1. Heartbeat Messages
- Sent at regular intervals before and during matches
- Continue until preset time after fixture status becomes 'Finished'
- **Key Indicator**: Regular heartbeat = active feed

### 2. Fixture Reliability Status
- Forwarded in the live feed data
- Indicates feed reliability in real-time
- **Key Indicator**: Reliable status = quality feed

### 3. Match State Information
- `CurrentPhase`: Match phase tracking
- `BetAcceptOk`: Betting safety indicator (deprecated but useful)
- Connection status from Ably client

### 4. Fixtures API V2 Status Endpoints
- **Fixture Status Tracking**: `eventStatusType` field indicates match state
- **Real-time Updates**: API provides current fixture information
- **Bulk Status Queries**: Can check multiple fixtures simultaneously
- **Competition-level Monitoring**: Track feed status across entire competitions

## Recommended Integration Solutions

### Solution 1: Enhanced Feed Status API (Recommended)

Create comprehensive feed status endpoints for your frontend:

```javascript
// New endpoints to add to server.js

// Get comprehensive feed status
app.get('/api/feed/:id/status', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    const status = await feedStatusService.getFeedStatus(fixtureId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get status for multiple feeds
app.post('/api/feed/status/bulk', async (req, res) => {
  try {
    const { fixtureIds } = req.body;
    const statuses = await feedStatusService.getBulkFeedStatus(fixtureIds);
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get overall system feed health
app.get('/api/feed/health', async (req, res) => {
  try {
    const health = await feedStatusService.getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Solution 2: Feed Status Service Implementation

```javascript
// src/services/feed-status.service.js
class FeedStatusService {
  constructor() {
    this.heartbeatTracker = new Map(); // Track heartbeat timestamps
    this.feedMetrics = new Map();      // Track feed quality metrics
    this.reliabilityStatus = new Map(); // Track reliability from Genius
  }

  async getFeedStatus(fixtureId) {
    const isSubscribed = ablyService.isSubscribed(fixtureId);
    const connection = ablyService.getConnectionStatus(fixtureId);
    const lastHeartbeat = this.getLastHeartbeat(fixtureId);
    const reliability = this.reliabilityStatus.get(fixtureId);
    const metrics = this.feedMetrics.get(fixtureId);

    return {
      fixtureId: parseInt(fixtureId),
      isActive: isSubscribed && connection === 'connected',
      connectionStatus: connection,
      feedReliability: reliability?.isReliable || false,
      lastHeartbeat: lastHeartbeat,
      isHealthy: this.calculateFeedHealth(fixtureId),
      metrics: {
        messagesReceived: metrics?.messageCount || 0,
        lastMessageTime: metrics?.lastMessage || null,
        averageLatency: metrics?.avgLatency || null,
        errorCount: metrics?.errors || 0
      },
      timestamp: new Date().toISOString()
    };
  }

  async getBulkFeedStatus(fixtureIds) {
    const statuses = await Promise.all(
      fixtureIds.map(id => this.getFeedStatus(id))
    );
    
    return {
      feeds: statuses,
      summary: {
        total: fixtureIds.length,
        active: statuses.filter(s => s.isActive).length,
        healthy: statuses.filter(s => s.isHealthy).length,
        errors: statuses.filter(s => s.metrics.errorCount > 0).length
      }
    };
  }

  async getSystemHealth() {
    const activeFeeds = Array.from(ablyService.activeSubscriptions.keys());
    const feedStatuses = await this.getBulkFeedStatus(activeFeeds);
    
    return {
      status: feedStatuses.summary.active === feedStatuses.summary.total ? 'healthy' : 'degraded',
      activeFeeds: feedStatuses.summary.active,
      totalFeeds: feedStatuses.summary.total,
      systemUptime: process.uptime(),
      timestamp: new Date().toISOString(),
      feeds: feedStatuses.feeds
    };
  }

  trackHeartbeat(fixtureId, timestamp) {
    this.heartbeatTracker.set(fixtureId, timestamp);
  }

  trackReliability(fixtureId, reliabilityData) {
    this.reliabilityStatus.set(fixtureId, {
      isReliable: reliabilityData.isReliable,
      lastUpdate: new Date().toISOString(),
      reason: reliabilityData.reason
    });
  }

  updateFeedMetrics(fixtureId, messageData) {
    const current = this.feedMetrics.get(fixtureId) || {
      messageCount: 0,
      errors: 0,
      latencies: [],
      lastMessage: null
    };

    current.messageCount++;
    current.lastMessage = new Date().toISOString();
    
    // Calculate latency if timestamps are available
    if (messageData._geniusTs && messageData._backendTs) {
      const latency = messageData._backendTs - messageData._geniusTs;
      current.latencies.push(latency);
      
      // Keep only last 100 latency measurements
      if (current.latencies.length > 100) {
        current.latencies.shift();
      }
      
      current.avgLatency = current.latencies.reduce((a, b) => a + b, 0) / current.latencies.length;
    }

    this.feedMetrics.set(fixtureId, current);
  }

  calculateFeedHealth(fixtureId) {
    const lastHeartbeat = this.getLastHeartbeat(fixtureId);
    const reliability = this.reliabilityStatus.get(fixtureId);
    const connection = ablyService.getConnectionStatus(fixtureId);
    
    // Feed is healthy if:
    // 1. Connection is active
    // 2. Heartbeat received within last 60 seconds (or no heartbeat tracking yet)
    // 3. Reliability status is good (or not set yet)
    
    const connectionHealthy = connection === 'connected';
    const heartbeatHealthy = !lastHeartbeat || (Date.now() - lastHeartbeat < 60000);
    const reliabilityHealthy = !reliability || reliability.isReliable;
    
    return connectionHealthy && heartbeatHealthy && reliabilityHealthy;
  }

  getLastHeartbeat(fixtureId) {
    return this.heartbeatTracker.get(fixtureId);
  }
}
```

### Solution 3: Enhanced Ably Service Integration

```javascript
// Enhancements to src/services/ably.service.js

// Add to AblyService class:
getConnectionStatus(fixtureId) {
  const subscription = this.activeSubscriptions.get(fixtureId);
  if (!subscription) return 'disconnected';
  return subscription.client.connection.state;
}

// Enhance the message processing in subscribe method:
channel.subscribe(message => {
  try {
    const matchData = message.data;
    if (!matchData) {
      console.warn(`Received empty message data for fixture ${fixtureId}`);
      return;
    }

    const feedUpdate = {
      raw: matchData,
      _geniusTs: message.timestamp,
      _backendTs: Date.now()
    };

    // Track heartbeat if present
    if (matchData.heartbeat) {
      feedStatusService.trackHeartbeat(fixtureId, message.timestamp);
    }

    // Track reliability status
    if (matchData.reliability !== undefined) {
      feedStatusService.trackReliability(fixtureId, {
        isReliable: matchData.reliability,
        reason: matchData.reliabilityReason
      });
    }

    // Update feed metrics
    feedStatusService.updateFeedMetrics(fixtureId, feedUpdate);

    const fixtureData = this.rawFeedData.get(fixtureId) || [];
    fixtureData.push(feedUpdate);
    if (fixtureData.length > 100) {
      fixtureData.shift();
    }
    this.rawFeedData.set(fixtureId, fixtureData);

    onMessage(feedUpdate);
  } catch (error) {
    console.error(`Error processing message for fixture ${fixtureId}:`, error);
    feedStatusService.trackError(fixtureId, error);
  }
});
```

### Solution 4: Fixtures API V2 Integration for Feed Validation

Leverage the Fixtures API V2 to cross-validate feed status with official fixture state:

```javascript
// src/services/fixture-validation.service.js
class FixtureValidationService {
  async validateFeedStatus(fixtureId) {
    try {
      // Get current fixture status from Fixtures API V2
      const fixtureData = await fixturesV2Service.getFixtureById(fixtureId);
      const currentFeedStatus = await feedStatusService.getFeedStatus(fixtureId);
      
      return {
        fixtureId: parseInt(fixtureId),
        officialStatus: fixtureData.eventStatusType,
        feedStatus: currentFeedStatus,
        shouldHaveFeed: this.shouldFixtureHaveFeed(fixtureData.eventStatusType),
        statusMatch: this.validateStatusAlignment(fixtureData.eventStatusType, currentFeedStatus.isActive),
        recommendations: this.getRecommendations(fixtureData, currentFeedStatus)
      };
    } catch (error) {
      throw new Error(`Failed to validate feed status for fixture ${fixtureId}: ${error.message}`);
    }
  }

  shouldFixtureHaveFeed(eventStatusType) {
    // Fixtures that should have active feeds
    const activeFeedStatuses = [
      'InProgress',
      'HalfTime', 
      'ExtraTime',
      'Penalties',
      'Suspended',
      'Delayed'
    ];
    
    return activeFeedStatuses.includes(eventStatusType);
  }

  validateStatusAlignment(eventStatusType, feedIsActive) {
    const shouldHaveFeed = this.shouldFixtureHaveFeed(eventStatusType);
    
    return {
      isAligned: shouldHaveFeed === feedIsActive,
      issue: shouldHaveFeed && !feedIsActive ? 'missing_feed' : 
             !shouldHaveFeed && feedIsActive ? 'unnecessary_feed' : null
    };
  }

  getRecommendations(fixtureData, feedStatus) {
    const recommendations = [];
    
    if (fixtureData.eventStatusType === 'InProgress' && !feedStatus.isActive) {
      recommendations.push({
        type: 'critical',
        message: 'Match is in progress but feed is inactive. Start feed immediately.',
        action: 'start_feed'
      });
    }
    
    if (fixtureData.eventStatusType === 'Finished' && feedStatus.isActive) {
      recommendations.push({
        type: 'optimization',
        message: 'Match is finished but feed is still active. Consider stopping feed to save resources.',
        action: 'stop_feed'
      });
    }
    
    if (feedStatus.isActive && !feedStatus.isHealthy) {
      recommendations.push({
        type: 'warning',
        message: 'Feed is active but unhealthy. Check connection and data quality.',
        action: 'investigate_health'
      });
    }
    
    return recommendations;
  }

  async bulkValidateFeeds(fixtureIds) {
    const validations = await Promise.all(
      fixtureIds.map(id => this.validateFeedStatus(id).catch(err => ({
        fixtureId: id,
        error: err.message
      })))
    );
    
    const successful = validations.filter(v => !v.error);
    const failed = validations.filter(v => v.error);
    
    return {
      validations: successful,
      errors: failed,
      summary: {
        total: fixtureIds.length,
        successful: successful.length,
        aligned: successful.filter(v => v.statusMatch?.isAligned).length,
        issues: successful.filter(v => !v.statusMatch?.isAligned).length
      }
    };
  }
}

// Add validation endpoint to server.js
app.get('/api/feed/:id/validate', async (req, res) => {
  try {
    const validation = await fixtureValidationService.validateFeedStatus(req.params.id);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/feed/validate/bulk', async (req, res) => {
  try {
    const { fixtureIds } = req.body;
    const validations = await fixtureValidationService.bulkValidateFeeds(fixtureIds);
    res.json(validations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Solution 5: Frontend Integration Examples

#### React Hook for Feed Status
```typescript
// useFeeedStatus.ts
export function useFeedStatus(fixtureId: string) {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/feed/${fixtureId}/status`);
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch feed status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [fixtureId]);

  return { status, isLoading, isActive: status?.isActive, isHealthy: status?.isHealthy };
}
```

#### Feed Status Component
```tsx
// FeedStatusIndicator.tsx
export function FeedStatusIndicator({ fixtureId }: { fixtureId: string }) {
  const { status, isLoading } = useFeedStatus(fixtureId);

  if (isLoading) return <div>Checking feed status...</div>;

  const getStatusColor = () => {
    if (!status?.isActive) return 'red';
    if (!status?.isHealthy) return 'orange';
    return 'green';
  };

  const getStatusText = () => {
    if (!status?.isActive) return 'Feed Inactive';
    if (!status?.isHealthy) return 'Feed Issues';
    return 'Feed Active';
  };

  return (
    <div className={`feed-status feed-status--${getStatusColor()}`}>
      <div className="feed-status__indicator" />
      <span className="feed-status__text">{getStatusText()}</span>
      {status?.lastHeartbeat && (
        <span className="feed-status__heartbeat">
          Last update: {new Date(status.lastHeartbeat).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
```

#### Bulk Feed Monitoring Dashboard
```tsx
// FeedDashboard.tsx
export function FeedDashboard() {
  const [systemHealth, setSystemHealth] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      const response = await fetch('/api/feed/health');
      const data = await response.json();
      setSystemHealth(data);
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="feed-dashboard">
      <h2>Feed System Health</h2>
      {systemHealth && (
        <div className="system-metrics">
          <div className="metric">
            <span className="metric__label">Status:</span>
            <span className={`metric__value metric__value--${systemHealth.status}`}>
              {systemHealth.status.toUpperCase()}
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">Active Feeds:</span>
            <span className="metric__value">{systemHealth.activeFeeds}/{systemHealth.totalFeeds}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Uptime:</span>
            <span className="metric__value">{Math.floor(systemHealth.systemUptime / 60)} minutes</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Implementation Priority

### Phase 1: Basic Status API (High Priority)
1. Create `FeedStatusService` class
2. Add basic status endpoints (`/api/feed/:id/status`)
3. Enhance `AblyService` with connection status tracking
4. Create simple frontend hook for status checking

### Phase 2: Advanced Monitoring (Medium Priority)
1. Implement heartbeat tracking
2. Add reliability status monitoring
3. Create bulk status endpoints
4. **NEW**: Add `FixtureValidationService` with Fixtures API V2 integration
5. **NEW**: Add feed validation endpoints (`/api/feed/:id/validate`)
6. Build feed dashboard component

### Phase 3: Automated Recovery (Low Priority)
1. Implement automatic reconnection logic based on validation recommendations
2. Add feed quality scoring
3. Create alerting system for feed issues
4. Add historical feed performance tracking
5. **NEW**: Implement automated feed lifecycle management (start/stop based on fixture status)

## Key Benefits for Frontend Integration

1. **Real-time Status Updates**: Know immediately when feeds go down
2. **User Experience**: Show loading states and connection issues
3. **Debugging**: Identify feed problems quickly
4. **Performance Monitoring**: Track feed latency and quality
5. **Automated Recovery**: Reduce manual intervention needs

## Genius Sports Integration Points

Based on the documentation, monitor these key indicators:

### From Football Match State:
- `MessageTimestampUtc`: Track message frequency
- `CurrentPhase`: Match progression status
- `BetAcceptOk`: Feed safety indicator (deprecated but useful)

### From Statistics API:
- **Heartbeat messages**: Regular interval confirmations
- **Fixture reliability status**: Real-time reliability indicators
- **Connection state**: Ably client connection status

### Sample Status Response:
```json
{
  "fixtureId": 12345,
  "isActive": true,
  "connectionStatus": "connected",
  "feedReliability": true,
  "lastHeartbeat": "2025-09-17T10:30:45.123Z",
  "isHealthy": true,
  "metrics": {
    "messagesReceived": 1247,
    "lastMessageTime": "2025-09-17T10:30:45.123Z",
    "averageLatency": 85,
    "errorCount": 0
  },
  "timestamp": "2025-09-17T10:30:50.000Z"
}
```

### Sample Validation Response (NEW):
```json
{
  "fixtureId": 12345,
  "officialStatus": "InProgress",
  "feedStatus": {
    "isActive": true,
    "isHealthy": true,
    "connectionStatus": "connected"
  },
  "shouldHaveFeed": true,
  "statusMatch": {
    "isAligned": true,
    "issue": null
  },
  "recommendations": []
}
```

### Sample Validation Response with Issues:
```json
{
  "fixtureId": 67890,
  "officialStatus": "InProgress", 
  "feedStatus": {
    "isActive": false,
    "isHealthy": false,
    "connectionStatus": "disconnected"
  },
  "shouldHaveFeed": true,
  "statusMatch": {
    "isAligned": false,
    "issue": "missing_feed"
  },
  "recommendations": [
    {
      "type": "critical",
      "message": "Match is in progress but feed is inactive. Start feed immediately.",
      "action": "start_feed"
    }
  ]
}
```

This comprehensive solution provides both backend monitoring capabilities and frontend integration options to ensure reliable feed status tracking.
