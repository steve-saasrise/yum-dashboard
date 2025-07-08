import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { testRedisConnection } from '@/lib/redis';

export async function GET() {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      supabase: { status: 'unknown', message: '' },
      redis: { status: 'unknown', message: '' },
    },
  };

  // Test Supabase connection
  if (!supabase) {
    healthStatus.services.supabase = {
      status: 'unconfigured',
      message: 'Supabase client not configured - missing environment variables',
    };
    healthStatus.status = 'degraded';
  } else {
    try {
      const { data, error } = await supabase
        .from('_health_check')
        .select('*')
        .limit(1);
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        // PGRST116 is "table not found", 42P01 is "relation does not exist" - both are expected
        throw error;
      }
      healthStatus.services.supabase = {
        status: 'healthy',
        message: 'Connection successful',
      };
    } catch (error) {
      healthStatus.services.supabase = {
        status: 'unhealthy',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      healthStatus.status = 'degraded';
    }
  }

  // Test Redis connection
  const redisResult = await testRedisConnection();
  healthStatus.services.redis = {
    status: redisResult.success ? 'healthy' : 'unconfigured',
    message: redisResult.message,
  };

  if (!redisResult.success) {
    healthStatus.status = 'degraded';
  }

  // Return appropriate HTTP status
  const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: httpStatus });
}
