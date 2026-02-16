const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function deleteEmptyDuplicate() {
  const deviceIdToDelete = '7bb9cbac-1bde-4362-8d09-3d2ccbb4b834'; // Empty duplicate
  
  console.log('Deleting empty duplicate M260600010 device...\n');
  
  // First, get device details to confirm
  const { data: device, error: fetchError } = await supabase
    .from('devices')
    .select('id, name, serial_number, external_device_id, status')
    .eq('id', deviceIdToDelete)
    .single();
  
  if (fetchError) {
    console.error('Error fetching device:', fetchError);
    return;
  }
  
  console.log('Device to delete:');
  console.log(`  ID: ${device.id}`);
  console.log(`  Name: ${device.name}`);
  console.log(`  Serial: ${device.serial_number || 'null'}`);
  console.log(`  External ID: ${device.external_device_id}`);
  console.log(`  Status: ${device.status}`);
  
  // Check telemetry count one more time
  const { count } = await supabase
    .from('device_telemetry_history')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', deviceIdToDelete);
  
  console.log(`  Telemetry records: ${count || 0}\n`);
  
  if (count && count > 0) {
    console.error('ERROR: Device has telemetry records! Aborting delete.');
    return;
  }
  
  // Proceed with deletion
  const { error: deleteError } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceIdToDelete);
  
  if (deleteError) {
    console.error('Error deleting device:', deleteError);
  } else {
    console.log('✅ Successfully deleted empty duplicate device!');
    
    // Verify only one M260600010 remains
    console.log('\nVerifying remaining M260600010 devices...');
    const { data: remaining, error: verifyError } = await supabase
      .from('devices')
      .select('id, name, serial_number, external_device_id, status')
      .or('name.eq.M260600010,serial_number.eq.M260600010');
    
    if (verifyError) {
      console.error('Verification error:', verifyError);
    } else {
      console.log(`Found ${remaining?.length || 0} device(s) with M260600010:`);
      remaining?.forEach(d => {
        console.log(`\n  ${d.name}`);
        console.log(`    ID: ${d.id}`);
        console.log(`    Serial: ${d.serial_number || 'null'}`);
        console.log(`    External ID: ${d.external_device_id}`);
      });
      
      // Check telemetry for remaining device
      if (remaining && remaining.length === 1) {
        const { count: telCount } = await supabase
          .from('device_telemetry_history')
          .select('*', { count: 'exact', head: true })
          .eq('device_id', remaining[0].id);
        console.log(`    Telemetry records: ${telCount || 0}`);
      }
    }
  }
}

deleteEmptyDuplicate().catch(console.error);
