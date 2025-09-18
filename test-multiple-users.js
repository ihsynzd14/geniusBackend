#!/usr/bin/env node

/**
 * Test script to verify multiple users can receive real-time data simultaneously
 * Usage: node test-multiple-users.js <fixtureId> [numberOfUsers]
 */

import io from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const fixtureId = process.argv[2];
const numberOfUsers = parseInt(process.argv[3]) || 3;

if (!fixtureId) {
  console.error('Usage: node test-multiple-users.js <fixtureId> [numberOfUsers]');
  process.exit(1);
}

console.log(`Testing ${numberOfUsers} users connecting to fixture ${fixtureId}`);
console.log(`Socket URL: ${SOCKET_URL}`);

const clients = [];
const userDataReceived = new Map();

// Create multiple socket connections
for (let i = 0; i < numberOfUsers; i++) {
  const userId = `user_${i + 1}`;
  
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000
  });

  socket.on('connect', () => {
    console.log(`${userId} connected with socket ID: ${socket.id}`);
    socket.emit('subscribe', fixtureId);
  });

  socket.on(`fixture:${fixtureId}`, (data) => {
    const timestamp = new Date().toISOString();
    console.log(`${userId} received data at ${timestamp}:`, {
      geniusTs: data._geniusTs,
      backendTs: data._backendTs,
      hasRawData: !!data.raw
    });
    
    if (!userDataReceived.has(userId)) {
      userDataReceived.set(userId, 0);
    }
    userDataReceived.set(userId, userDataReceived.get(userId) + 1);
  });

  socket.on('error', (error) => {
    console.error(`${userId} error:`, error);
  });

  socket.on('connect_error', (error) => {
    console.error(`${userId} connection error:`, error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log(`${userId} disconnected:`, reason);
  });

  clients.push({ userId, socket });
}

// Print statistics every 10 seconds
const statsInterval = setInterval(() => {
  console.log('\n=== DATA RECEPTION STATISTICS ===');
  userDataReceived.forEach((count, userId) => {
    console.log(`${userId}: ${count} messages received`);
  });
  console.log('==================================\n');
}, 10000);

// Clean up after 60 seconds
setTimeout(() => {
  console.log('\nTest completed. Cleaning up...');
  
  clearInterval(statsInterval);
  
  clients.forEach(({ userId, socket }) => {
    socket.emit('unsubscribe', fixtureId);
    socket.disconnect();
    console.log(`${userId} disconnected`);
  });

  console.log('\n=== FINAL STATISTICS ===');
  userDataReceived.forEach((count, userId) => {
    console.log(`${userId}: ${count} messages received`);
  });
  
  // Check if all users received data
  const usersWithData = Array.from(userDataReceived.values()).filter(count => count > 0).length;
  const successRate = (usersWithData / numberOfUsers) * 100;
  
  console.log(`\nSuccess Rate: ${successRate}% (${usersWithData}/${numberOfUsers} users received data)`);
  
  if (successRate === 100) {
    console.log('✅ SUCCESS: All users received real-time data!');
    process.exit(0);
  } else {
    console.log('❌ FAILURE: Not all users received data');
    process.exit(1);
  }
}, 60000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  clearInterval(statsInterval);
  clients.forEach(({ socket }) => socket.disconnect());
  process.exit(0);
});

console.log('Test running for 60 seconds. Press Ctrl+C to stop early.');
