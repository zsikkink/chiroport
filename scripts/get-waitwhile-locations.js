#!/usr/bin/env node

/**
 * Waitwhile Locations Fetcher
 * 
 * This script fetches all locations from Waitwhile API and helps find the ATL location ID.
 * 
 * Usage:
 * 1. Set your WAITWHILE_API_KEY environment variable
 * 2. Run: node scripts/get-waitwhile-locations.js
 */

const https = require('https');

const API_KEY = process.env.WAITWHILE_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: WAITWHILE_API_KEY environment variable is required');
  console.log('💡 Usage: WAITWHILE_API_KEY=your_key_here node scripts/get-waitwhile-locations.js');
  process.exit(1);
}

console.log('🔍 Fetching Waitwhile locations...\n');

const options = {
  hostname: 'api.waitwhile.com',
  port: 443,
  path: '/v2/locations',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode !== 200) {
        console.error('❌ API Error:', response);
        return;
      }

      console.log(`✅ Found ${response.length || 0} locations:\n`);
      
      let atlLocation = null;
      
      response.forEach((location, index) => {
        console.log(`${index + 1}. ${location.name || 'Unnamed Location'}`);
        console.log(`   ID: ${location.id}`);
        console.log(`   Short Name: ${location.shortName || 'N/A'}`);
        console.log(`   Status: ${location.isActive ? '🟢 Active' : '🔴 Inactive'}`);
        
        // Check if this might be the ATL location
        const name = (location.name || '').toLowerCase();
        const shortName = (location.shortName || '').toLowerCase();
        
        if (name.includes('atlanta') || name.includes('atl') || 
            shortName.includes('atlanta') || shortName.includes('atl')) {
          atlLocation = location;
          console.log(`   🎯 POTENTIAL ATL MATCH!`);
        }
        
        console.log('');
      });

      // Summary
      if (atlLocation) {
        console.log('🎯 FOUND POTENTIAL ATL LOCATION:');
        console.log(`   Name: ${atlLocation.name}`);
        console.log(`   ID: ${atlLocation.id}`);
        console.log(`   Short Name: ${atlLocation.shortName || 'N/A'}`);
        console.log('\n📝 To update your code, replace "ATL-PLACEHOLDER" with:', atlLocation.id);
      } else {
        console.log('❓ No obvious ATL location found. Please check the list above manually.');
        console.log('💡 Look for any location name that might refer to Atlanta airport.');
      }

    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.end(); 