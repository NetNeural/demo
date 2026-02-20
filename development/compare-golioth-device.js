// Compare Golioth device data with database
require('dotenv').config({ path: '.env.local' });

const GOLIOTH_DEVICE_ID = '6913a4ccafb9ed23a5fb26a7'; // Temperature Sensor 1 from Golioth

async function compareData() {
  console.log('='.repeat(80));
  console.log('COMPARING GOLIOTH DATA WITH DATABASE');
  console.log('='.repeat(80));
  console.log();

  // Fetch from Golioth
  const goliothResponse = await fetch(
    `https://api.golioth.io/v1/projects/nn-cellular-alerts/devices?pageSize=100`,
    {
      headers: {
        'x-api-key': process.env.GOLIOTH_API_KEY,
        'Accept': 'application/json'
      }
    }
  );
  
  const goliothData = await goliothResponse.json();
  const goliothDevice = goliothData.list?.find(d => d.id === GOLIOTH_DEVICE_ID);
  
  console.log('📡 GOLIOTH API DATA:');
  console.log(JSON.stringify(goliothDevice, null, 2));
  console.log();
  console.log('='.repeat(80));
  console.log();
  
  // Fetch from local database
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: dbDevice, error } = await supabase
    .from('devices')
    .select('*')
    .eq('external_device_id', GOLIOTH_DEVICE_ID)
    .single();
  
  if (error) {
    console.error('Database error:', error);
    return;
  }
  
  console.log('💾 DATABASE DATA:');
  console.log(JSON.stringify(dbDevice, null, 2));
  console.log();
  console.log('='.repeat(80));
  console.log();
  
  // Compare fields
  console.log('🔍 FIELD COMPARISON:');
  console.log();
  
  const comparisons = [
    { field: 'name', golioth: goliothDevice?.name, db: dbDevice?.name },
    { field: 'id (Golioth) vs external_device_id (DB)', golioth: goliothDevice?.id, db: dbDevice?.external_device_id },
    { field: 'status', golioth: goliothDevice?.status, db: dbDevice?.status },
    { field: 'hardwareIds', golioth: goliothDevice?.hardwareIds || goliothDevice?.hardwareId, db: dbDevice?.hardware_ids },
    { field: 'cohortId', golioth: goliothDevice?.cohortId, db: dbDevice?.cohort_id },
    { field: 'lastSeenOnline', golioth: goliothDevice?.lastSeenOnline, db: dbDevice?.last_seen_online },
    { field: 'lastSeenOffline', golioth: goliothDevice?.lastSeenOffline, db: dbDevice?.last_seen_offline },
    { field: 'metadata', golioth: goliothDevice?.metadata, db: dbDevice?.metadata },
    { field: 'tags', golioth: goliothDevice?.tags, db: 'N/A (not in DB schema)' },
  ];
  
  comparisons.forEach(({ field, golioth, db }) => {
    const match = JSON.stringify(golioth) === JSON.stringify(db);
    const icon = match ? '✅' : '❌';
    console.log(`${icon} ${field}:`);
    console.log(`   Golioth: ${JSON.stringify(golioth)}`);
    console.log(`   Database: ${JSON.stringify(db)}`);
    console.log();
  });
}

compareData().catch(console.error);
