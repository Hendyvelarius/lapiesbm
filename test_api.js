// Test script to check the new API endpoint
const axios = require('axios');

async function testAffectedProducts() {
  try {
    console.log('=== Testing Affected Products API ===');
    
    const testData = {
      description: "Price Changes : AC 014B: 22 -> 31; ",
      simulasiDate: "2025-09-24T00:27:38.087Z"
    };

    console.log('Request data:', testData);
    
    const response = await axios.post('http://localhost:3001/api/hpp/price-change-affected-products', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('=== Response ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('=== Error ===');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data || error.message);
  }
}

// Run test
testAffectedProducts();