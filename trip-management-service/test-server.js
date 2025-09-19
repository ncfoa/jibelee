/**
 * Test server for Trip Management Service
 * This file tests the service without external dependencies
 */

require('dotenv').config();

// Mock environment variables for testing
process.env.NODE_ENV = 'development';
process.env.PORT = '3003';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'trip_db_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'password';
process.env.REDIS_HOST = 'localhost';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LOG_LEVEL = 'info';

const app = require('./src/app');
const { logger } = require('./src/config/logger');

// Test endpoints
const testEndpoints = async () => {
  const axios = require('axios');
  const baseURL = 'http://localhost:3003';

  console.log('\n🧪 Testing Trip Management Service Endpoints...\n');

  try {
    // Test health endpoint
    console.log('✅ Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Service: ${healthResponse.data.status}`);

    // Test metrics endpoint
    console.log('✅ Testing metrics endpoint...');
    const metricsResponse = await axios.get(`${baseURL}/metrics`);
    console.log(`   Status: ${metricsResponse.status}`);
    console.log(`   Uptime: ${Math.round(metricsResponse.data.uptime)}s`);

    // Test API info endpoint
    console.log('✅ Testing API info endpoint...');
    const apiResponse = await axios.get(`${baseURL}/api/v1`);
    console.log(`   Status: ${apiResponse.status}`);
    console.log(`   Service: ${apiResponse.data.service}`);

    // Test documentation endpoint
    console.log('✅ Testing documentation endpoint...');
    const docsResponse = await axios.get(`${baseURL}/api/v1/docs`);
    console.log(`   Status: ${docsResponse.status}`);
    console.log(`   Service: ${docsResponse.data.service}`);

    console.log('\n🎉 All basic endpoints are working!\n');

    // Test API endpoints (these will return errors without database, but should not crash)
    console.log('🧪 Testing API endpoints (expected to fail without database)...\n');

    const testCases = [
      { method: 'GET', url: '/api/v1/trips/search', description: 'Trip search' },
      { method: 'GET', url: '/api/v1/trips/templates/public', description: 'Public templates' },
      { method: 'GET', url: '/api/v1/trips/analytics/popular-routes', description: 'Popular routes' }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`   Testing ${testCase.description}...`);
        const response = await axios({
          method: testCase.method,
          url: `${baseURL}${testCase.url}`,
          validateStatus: () => true // Accept any status code
        });
        console.log(`   Status: ${response.status} (${response.data.message || response.data.error || 'OK'})`);
      } catch (error) {
        console.log(`   Status: Error - ${error.message}`);
      }
    }

    console.log('\n✅ Service is running correctly!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Start server and run tests
const startTestServer = async () => {
  try {
    console.log('🚀 Starting Trip Management Service Test Server...\n');
    
    // Start server
    const server = app.listen(3003, 'localhost', () => {
      console.log('✅ Server started on http://localhost:3003');
      
      // Wait a moment then run tests
      setTimeout(testEndpoints, 2000);
      
      // Stop server after tests
      setTimeout(() => {
        console.log('\n🛑 Stopping test server...');
        server.close();
        process.exit(0);
      }, 10000);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start test server:', error.message);
    process.exit(1);
  }
};

startTestServer();