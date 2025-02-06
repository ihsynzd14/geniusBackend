---

### **Mission Objective**  
**≤250ms End-to-End Latency** from Genius Sports API → Your Backend → Frontend Render  
**Success Metric:** Timestamp variance ≤250ms vs. Genius LiveViewer

---

### **Critical Path Optimization Checklist**

#### **1. Backend Zero-Latency Forwarding** _(Priority 1)_
- [ ] **Remove All Caching**  
  ```javascript
  // route-handler.service.js
  static async getLastAction(fixtureId) {
    return { 
      data: ablyService.getRawFeed(fixtureId),
      _ts: Date.now() 
    };
  }
  ```
- [ ] **Disable Data Transformations**  
  ```javascript
  // ably.service.js
  channel.subscribe(message => {
    io.emit(`fixture:${fixtureId}`, {
      raw: message.data,        // Original Genius payload
      _geniusTs: message.timestamp,
      _backendTs: Date.now()
    });
  });
  ```
- [ ] **WebSocket Transport Lock**  
  ```javascript
  // server.js
  const io = new Server(httpServer, {
    transports: ['websocket'],
    allowUpgrades: false,
    pingInterval: 25000,
    pingTimeout: 10000
  });
  ```

#### **2. Frontend Real-Time Pipeline** _(Priority 2)_
- [ ] **Eliminate Polling Mechanisms**  
  ```typescript
  // use-match-data.ts
  const { data: feedData } = useQuery({
    queryKey: ['feed', fixtureId],
    queryFn: () => null // Disable initial fetch
  });
  ```
- [ ] **Direct WebSocket Binding**  
  ```typescript
  useEffect(() => {
    const unsubscribe = api.subscribeToFixture(fixtureId, (data) => {
      queryClient.setQueryData(['feed', fixtureId], data);
    });
    return unsubscribe;
  }, [fixtureId]);
  ```
- [ ] **Web Worker Transformations**  
  ```typescript
  // transform.worker.ts
  self.onmessage = (e) => {
    const mapped = e.data.actions.map(action => ({
      ...action,
      typeDisplay: ACTION_MAP[action.type] || action.type
    }));
    postMessage({ ...e.data, actions: mapped });
  };
  ```

#### **3. Genius Integration Optimizations** _(Priority 3)_
- [ ] **Ably Credential Cache**  
  ```javascript
  // fixtures.service.js
  const ABLY_CRED_CACHE = new Map();

  async getAblyFeed(fixtureId) {
    if (ABLY_CRED_CACHE.has(fixtureId)) {
      return ABLY_CRED_CACHE.get(fixtureId);
    }
    // ... fetch and cache with 1h TTL ...
  }
  ```
- [ ] **Persistent HTTP Connections**  
  ```javascript
  const axiosInstance = axios.create({
    httpAgent: new http.Agent({ 
      keepAlive: true,
      maxSockets: 50 
    }),
    timeout: 2000
  });
  ```

#### **4. Performance Monitoring** _(Continuous)_
- [ ] **Latency Diagnostics**  
  ```javascript
  // Backend emission
  io.emit('update', {
    ...
    _geniusTs: message.timestamp,
    _backendTs: Date.now()
  });

  // Frontend reception
  socket.on('update', (data) => {
    console.log(`Latency: ${Date.now() - data._geniusTs}ms`);
  });
  ```
- [ ] **LiveViewer Comparator**  
  ```typescript
  useEffect(() => {
    setInterval(() => {
      const delta = feedData?._geniusTs - getGeniusLiveTime();
      alertIf(delta > 250, `Latency spike: ${delta}ms`);
    }, 1000);
  }, [feedData]);
  ```

#### **5. Render Performance** _(Post-Optimization)_
- [ ] **Virtualized Lists**  
  ```typescript
  <Virtuoso
    data={transformedActions}
    itemContent={(index, action) => (
      <ActionItem {...action} />
    )}
  />
  ```
- [ ] **GPU-Accelerated Animations**  
  ```
  using tailwind and animation of react
  ```

---

### **Implementation Roadmap**
1. **Phase 1 - Backend Streamlining** (1-2 hrs)  
   - Disable caching & transformations  
   - Enforce WebSocket-only transport  
   - Add latency diagnostics

2. **Phase 2 - Frontend Rebuild** (2-4 hrs)  
   - Remove polling dependencies  
   - Implement Web Worker pipeline  
   - Add delta monitor

3. **Phase 3 - Network Optimizations** (1 hr)  
   - Setup credential caching  
   - Configure connection pooling

4. **Phase 4 - Render Tuning** (1-2 hrs)  
   - Virtualize heavy lists  
   - GPU-accelerate animations

---

### **Expected Performance Gains**
| Metric | Current | Target |
|--------|---------|--------|
| API → Frontend Latency | 500-1500ms | **≤250ms** |
| Backend CPU Load | High (70-90%) | Medium (30-50%) |
| Frontend FPS | 30-45 | 60 (stable) |
| Memory Usage | ~1.2GB | ~800MB |

---

### **Validation Protocol**
1. Run side-by-side comparison with Genius LiveViewer
2. Monitor latency delta console every 15s
3. Stress test with 10 concurrent fixtures
4. Profile CPU/memory during peak loads


Execute these steps systematically while monitoring the latency delta after each change. The AI agent should validate against these checkpoints:

1. **After Phase 1:** API → Backend latency ≤50ms  
2. **After Phase 2:** Backend → Frontend latency ≤150ms  
3. **After Phase 3:** Concurrent connection handling 10x improvement  
4. **Final Validation:** End-to-end latency ≤250ms consistently

Let me know which phase you want to implement first! 🚀