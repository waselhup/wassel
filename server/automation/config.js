// All values from environment variables — NO hardcoded keys
export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  automationApiKey: process.env.AUTOMATION_API_KEY || '',
  port: parseInt(process.env.PORT || '4000'),
  dailyLimits: {
    visit: 80,
    connect: 20,
    message: 30,
  },
};
