// src/utils/websocketTest.ts
// WebSocket connection test utility

import centralizedWebSocketManager from '../services/centralizedWebSocketManager';

export const testWebSocketConnection = async () => {
  console.log('🧪 Testing WebSocket connections...');
  
  const results = {
    checklists: false,
    notifications: false,
    errors: [] as string[]
  };

  // Test checklists endpoint
  try {
    console.log('🧪 Testing checklists WebSocket...');
    await centralizedWebSocketManager.connect('checklists');
    const checklistsConnected = centralizedWebSocketManager.isConnected('checklists');
    results.checklists = checklistsConnected;
    console.log(`✅ Checklists WebSocket: ${checklistsConnected ? 'Connected' : 'Failed'}`);
  } catch (error) {
    const errorMsg = `Checklists WebSocket error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    console.error('❌', errorMsg);
  }

  // Test notifications endpoint
  try {
    console.log('🧪 Testing notifications WebSocket...');
    await centralizedWebSocketManager.connect('notifications');
    const notificationsConnected = centralizedWebSocketManager.isConnected('notifications');
    results.notifications = notificationsConnected;
    console.log(`✅ Notifications WebSocket: ${notificationsConnected ? 'Connected' : 'Failed'}`);
  } catch (error) {
    const errorMsg = `Notifications WebSocket error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    console.error('❌', errorMsg);
  }

  // Get connection states
  const states = centralizedWebSocketManager.getAllConnectionStates();
  console.log('📊 Connection states:', states);

  // Log results
  console.log('🧪 WebSocket test results:', results);
  
  return results;
};

// Auto-test after a delay
export const scheduleWebSocketTest = () => {
  setTimeout(() => {
    console.log('🧪 Running scheduled WebSocket test...');
    testWebSocketConnection();
  }, 5000); // Wait 5 seconds for app to load
};

// Schedule the test automatically
if (typeof window !== 'undefined') {
  scheduleWebSocketTest();
}

export default { testWebSocketConnection, scheduleWebSocketTest };
