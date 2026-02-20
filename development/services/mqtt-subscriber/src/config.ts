import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Supabase configuration
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Service configuration
  maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10', 10),
  reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '5000', 10),
  
  // Message processing
  batchSize: parseInt(process.env.MESSAGE_BATCH_SIZE || '100', 10),
  processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '30000', 10),
};

// Validate required configuration
if (!config.supabaseUrl) {
  throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!config.supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}
