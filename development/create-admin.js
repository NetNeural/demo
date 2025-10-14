#!/usr/bin/env node

const createSuperAdmin = async () => {
  try {
    const response = await fetch('http://127.0.0.1:54321/functions/v1/create-super-admin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      },
      body: JSON.stringify({
        email: 'admin@netneural.ai',
        password: 'NetNeural2025!',
        fullName: 'NetNeural Admin'
      })
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (response.ok) {
      console.log('✅ Super admin user created successfully!');
      console.log('📧 Email: admin@netneural.ai');
      console.log('🔐 Password: NetNeural2025!');
    } else {
      console.log('❌ Failed to create super admin user');
    }
  } catch (error) {
    console.error('Error creating super admin:', error.message);
  }
};

createSuperAdmin();