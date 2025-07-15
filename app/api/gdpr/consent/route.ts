import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Consent update schema
const consentUpdateSchema = z.object({
  consent_type: z.enum(['data_processing', 'marketing', 'analytics', 'all']),
  consent_given: z.boolean(),
  consent_details: z
    .object({
      ip_address: z.string().optional(),
      user_agent: z.string().optional(),
      consent_method: z.enum(['signup', 'settings', 'popup', 'explicit']),
      privacy_policy_version: z.string().optional(),
    })
    .optional(),
});

// GET endpoint - Get current consent status
export async function GET(_request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (_error) {
              // Ignore cookie setting errors in server context
            }
          },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get current consent status from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('gdpr_consent, gdpr_consent_date, consent_details')
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to retrieve consent status' },
        { status: 500 }
      );
    }

    // Get consent history (if we have an audit table)
    const { data: consentHistory } = await supabase
      .from('api_usage_tracking')
      .select('endpoint, last_request, request_count')
      .eq('user_id', user.id)
      .like('endpoint', '%consent%')
      .order('last_request', { ascending: false })
      .limit(10);

    return NextResponse.json({
      user_id: user.id,
      current_consent: {
        gdpr_consent: userData?.gdpr_consent || false,
        gdpr_consent_date: userData?.gdpr_consent_date,
        consent_details: userData?.consent_details || {},
      },
      consent_history: consentHistory || [],
      privacy_policy_version: process.env.PRIVACY_POLICY_VERSION || '1.0',
      last_updated: userData?.gdpr_consent_date,
    });
  } catch (_error) {
    // Consent status retrieval failed
    return NextResponse.json(
      { error: 'Failed to retrieve consent status' },
      { status: 500 }
    );
  }
}

// POST endpoint - Update consent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = consentUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { consent_type, consent_given, consent_details } = validation.data;

    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (_error) {
              // Ignore cookie setting errors in server context
            }
          },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get client IP and user agent for audit trail
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Prepare consent details with audit information
    const fullConsentDetails = {
      ...consent_details,
      ip_address: ip,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
      consent_type,
      consent_given,
    };

    // Update user consent in database
    const updateData: {
      updated_at: string;
      gdpr_consent?: boolean;
      gdpr_consent_date?: string;
      consent_details?: Record<string, unknown>;
      gdpr_consent_data_processing?: boolean;
      gdpr_consent_marketing?: boolean;
      gdpr_consent_analytics?: boolean;
      preferences?: Record<string, boolean>;
    } = {
      updated_at: new Date().toISOString(),
    };

    // Handle different consent types
    if (consent_type === 'all' || consent_type === 'data_processing') {
      updateData.gdpr_consent = consent_given;
      updateData.gdpr_consent_date = new Date().toISOString();
      updateData.consent_details = fullConsentDetails;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Consent update error:', updateError);
      }
      return NextResponse.json(
        { error: 'Failed to update consent' },
        { status: 500 }
      );
    }

    // Log the consent change for audit purposes
    await supabase.from('api_usage_tracking').insert({
      user_id: user.id,
      endpoint: `/api/gdpr/consent/${consent_type}`,
      request_count: 1,
      last_request: new Date().toISOString(),
    });

    // Return updated consent status
    return NextResponse.json({
      success: true,
      message: `Consent for ${consent_type} has been ${consent_given ? 'granted' : 'withdrawn'}.`,
      consent_update: {
        consent_type,
        consent_given,
        timestamp: new Date().toISOString(),
        user_id: user.id,
      },
      current_consent: {
        gdpr_consent:
          consent_type === 'all' || consent_type === 'data_processing'
            ? consent_given
            : updateData.gdpr_consent,
        gdpr_consent_date: updateData.gdpr_consent_date,
        consent_details: fullConsentDetails,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Consent update error:', error);
    }
    return NextResponse.json(
      {
        error: 'Consent update failed',
        message: 'An error occurred while updating your consent preferences.',
      },
      { status: 500 }
    );
  }
}

// PUT endpoint - Bulk consent update (for signup flow)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      data_processing_consent = false,
      marketing_consent = false,
      analytics_consent = false,
      consent_method = 'signup',
      privacy_policy_version = '1.0',
    } = body;

    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (_error) {
              // Ignore cookie setting errors in server context
            }
          },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get client IP and user agent for audit trail
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Prepare comprehensive consent details
    const consentDetails = {
      data_processing_consent,
      marketing_consent,
      analytics_consent,
      consent_method,
      privacy_policy_version,
      ip_address: ip,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
    };

    // Update user consent
    const { error: updateError } = await supabase
      .from('users')
      .update({
        gdpr_consent: data_processing_consent, // Main consent required for data processing
        gdpr_consent_date: new Date().toISOString(),
        consent_details: consentDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Bulk consent update error:', updateError);
      }
      return NextResponse.json(
        { error: 'Failed to update consent preferences' },
        { status: 500 }
      );
    }

    // Log the consent setup for audit purposes
    await supabase.from('api_usage_tracking').insert({
      user_id: user.id,
      endpoint: '/api/gdpr/consent/bulk-update',
      request_count: 1,
      last_request: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Consent preferences have been saved successfully.',
      consent_summary: {
        data_processing_consent,
        marketing_consent,
        analytics_consent,
        consent_method,
        privacy_policy_version,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (_error) {
    // Bulk consent update failed
    return NextResponse.json(
      { error: 'Failed to update consent preferences' },
      { status: 500 }
    );
  }
}
