#!/usr/bin/env node

// Simple data upload using basic HTTP requests
const https = require('https');

const SUPABASE_URL = 'https://bldojxpockljyivldxwf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI';

function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'bldojxpockljyivldxwf.supabase.co',
      port: 443,
      path: `/rest/v1/${endpoint}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData ? JSON.parse(responseData) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  try {
    // First, let's try to fetch any existing data
    const result = await makeRequest('GET', 'locations?select=*&limit=1');
    console.log('✅ Connection successful!');
    console.log('📊 Current locations in database:', result?.length || 0);
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function uploadSimpleData() {
  console.log('🚀 Starting simple data upload...');
  
  const connected = await testConnection();
  if (!connected) {
    console.log('💡 Connection issue detected. This might be because:');
    console.log('   1. The API key needs to be refreshed');
    console.log('   2. The tables do not exist yet in the remote database');
    console.log('   3. The anon key does not have insert permissions');
    console.log('');
    console.log('🔧 Suggested solutions:');
    console.log('   1. Check the Supabase dashboard to ensure tables exist');
    console.log('   2. Try using the service role key instead');
    console.log('   3. Set up RLS policies to allow anonymous inserts');
    return;
  }

  try {
    // Try uploading one location first
    console.log('📍 Testing location upload...');
    const testLocation = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Building A - Main Campus',
      address: '123 Corporate Blvd',
      city: 'Atlanta',
      state_province: 'GA',
      latitude: 33.7490,
      longitude: -84.3880,
      sensors_total: 8,
      sensors_online: 7,
      alerts_active: 1
    };

    await makeRequest('POST', 'locations', testLocation);
    console.log('✅ Test location uploaded successfully!');
    
    console.log('🎉 Upload test completed! The connection is working.');
    console.log('💡 You can now proceed with the full data upload.');

  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    
    if (error.message.includes('duplicate key')) {
      console.log('✅ Data already exists - this is expected if you ran this before!');
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('🔧 Tables do not exist. You need to:');
      console.log('   1. Go to your Supabase dashboard');
      console.log('   2. Run the table creation SQL first');
      console.log('   3. Then run this data upload script');
    } else if (error.message.includes('permission')) {
      console.log('🔐 Permission issue. You may need to:');
      console.log('   1. Use the service role key instead of anon key');
      console.log('   2. Set up Row Level Security policies');
    }
  }
}

uploadSimpleData();
