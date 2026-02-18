#!/usr/bin/env node

/**
 * Check if M260600008 (the device from webhook) exists in database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const GOLIOTH_DEVICE = 'M260600008'; // From webhook

async function checkWebhookDevice() {
  console.log(`🔍 Checking for Golioth device: ${GOLIOTH_DEVICE}\n`);
  
  // Check by serial_number (primary lookup)
  const { data: bySerial, error: serialError } = await supabase
    .from('devices')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('serial_number', GOLIOTH_DEVICE)
    .maybeSingle();
  
  if (serialError) {
    console.error('❌ Error querying by serial_number:', serialError);
  } else if (bySerial) {
    console.log('✅ Found device by serial_number:');
    console.log(`   ID: ${bySerial.id}`);
    console.log(`   Name: ${bySerial.name}`);
    console.log(`   Serial: ${bySerial.serial_number}`);
    console.log(`   External ID: ${bySerial.external_device_id || '(none)'}`);
    console.log(`   Type: ${bySerial.device_type}`);
    console.log(`   Status: ${bySerial.status}`);
    console.log(`   Integration ID: ${bySerial.integration_id || '(none)'}`);
    console.log('\n✅ Device will be matched by webhook handler!');
    return;
  } else {
    console.log('❌ No device found with serial_number: ' + GOLIOTH_DEVICE);
  }
  
  // Check by external_device_id (fallback)
  const { data: byExternal, error: externalError } = await supabase
    .from('devices')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('external_device_id', GOLIOTH_DEVICE)
    .maybeSingle();
  
  if (externalError) {
    console.error('❌ Error querying by external_device_id:', externalError);
  } else if (byExternal) {
    console.log('✅ Found device by external_device_id:');
    console.log(`   ID: ${byExternal.id}`);
    console.log(`   Name: ${byExternal.name}`);
    console.log(`   Serial: ${byExternal.serial_number || '(none)'}`);
    console.log(`   External ID: ${byExternal.external_device_id}`);
    console.log(`   ⚠️  Should populate serial_number for better matching`);
  } else {
    console.log('❌ No device found with external_device_id: ' + GOLIOTH_DEVICE);
  }
  
  // Check by name (last resort)
  const { data: byName, error: nameError } = await supabase
    .from('devices')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('name', GOLIOTH_DEVICE)
    .maybeSingle();
  
  if (nameError) {
    console.error('❌ Error querying by name:', nameError);
  } else if (byName) {
    console.log('✅ Found device by name:');
    console.log(`   ID: ${byName.id}`);
    console.log(`   Name: ${byName.name}`);
    console.log(`   Serial: ${byName.serial_number || '(none)'}`);
    console.log(`   External ID: ${byName.external_device_id || '(none)'}`);
    
    if (!byName.serial_number) {
      console.log('\n🔧 Updating serial_number to match name...');
      const { error: updateError } = await supabase
        .from('devices')
        .update({ serial_number: GOLIOTH_DEVICE })
        .eq('id', byName.id);
      
      if (updateError) {
        console.error('❌ Failed to update:', updateError);
      } else {
        console.log('✅ Serial number updated!');
      }
    }
  } else {
    console.log('❌ No device found with name: ' + GOLIOTH_DEVICE);
  }
  
  if (!bySerial && !byExternal && !byName) {
    console.log('\n⚠️  Device NOT found in database!');
    console.log('   Next webhook will auto-create it with:');
    console.log(`   - serial_number: ${GOLIOTH_DEVICE}`);
    console.log(`   - name: ${GOLIOTH_DEVICE}`);
    console.log(`   - device_type: iot-sensor`);
    console.log(`   - status: online`);
  }
}

checkWebhookDevice().catch(console.error);
