import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
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
            } catch {
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

    // Collect all user data from various tables
    const exportData: {
      export_info: {
        user_id: string;
        export_timestamp: string;
        export_type: string;
        data_format: string;
      };
      user_account: Record<string, unknown>;
      profile: Record<string, unknown>;
      saved_content: Array<Record<string, unknown>>;
      user_lounges: Array<Record<string, unknown>>;
      email_digests: Array<Record<string, unknown>>;
      user_sessions: Array<Record<string, unknown>>;
      api_usage: Array<Record<string, unknown>>;
    } = {
      export_info: {
        user_id: user.id,
        export_timestamp: new Date().toISOString(),
        export_type: 'complete_user_data',
        data_format: 'json',
      },
      user_account: {},
      profile: {},
      saved_content: [],
      user_lounges: [],
      email_digests: [],
      user_sessions: [],
      api_usage: [],
    };

    // 1. Get user account information
    const { data: userAccountData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userAccountData) {
      exportData.user_account = {
        id: userAccountData.id,
        email: userAccountData.email,
        created_at: userAccountData.created_at,
        updated_at: userAccountData.updated_at,
        last_login: userAccountData.last_login,
        account_status: userAccountData.account_status,
        timezone: userAccountData.timezone,
        gdpr_consent: userAccountData.gdpr_consent,
        gdpr_consent_date: userAccountData.gdpr_consent_date,
        data_deletion_requested: userAccountData.data_deletion_requested,
      };
    }

    // 2. Get user profile information
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      exportData.profile = {
        full_name: profileData.full_name,
        username: profileData.username,
        avatar_url: profileData.avatar_url,
        bio: profileData.bio,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
      };
    }

    // 3. Get saved content
    const { data: savedContentData } = await supabase
      .from('saved_content')
      .select(
        `
        *,
        content:content_id (
          title,
          url,
          description,
          published_at,
          platform,
          creators (display_name)
        )
      `
      )
      .eq('user_id', user.id);

    if (savedContentData) {
      exportData.saved_content = savedContentData.map((item) => ({
        saved_at: item.saved_at,
        notes: item.notes,
        read_status: item.read_status,
        tags: item.tags,
        content: {
          title: item.content?.title,
          url: item.content?.url,
          description: item.content?.description,
          published_at: item.content?.published_at,
          platform: item.content?.platform,
          creator_name: item.content?.creators?.display_name,
        },
      }));
    }

    // 4. Get user lounges
    const { data: userLoungesData } = await supabase
      .from('user_lounges')
      .select(
        `
        *,
        lounges (
          name,
          description
        )
      `
      )
      .eq('user_id', user.id);

    if (userLoungesData) {
      exportData.user_lounges = userLoungesData.map((item) => ({
        subscribed_at: item.created_at,
        lounge: {
          name: item.lounges?.name,
          description: item.lounges?.description,
        },
      }));
    }

    // 5. Get email digest preferences
    const { data: emailDigestsData } = await supabase
      .from('email_digests')
      .select('*')
      .eq('user_id', user.id);

    if (emailDigestsData) {
      exportData.email_digests = emailDigestsData.map((digest) => ({
        frequency: digest.frequency,
        day_of_week: digest.day_of_week,
        time_of_day: digest.time_of_day,
        last_sent: digest.last_sent,
        active: digest.active,
        topics_included: digest.topics_included,
        created_at: digest.created_at,
        updated_at: digest.updated_at,
      }));
    }

    // 6. Get recent user sessions (limited for privacy)
    const { data: userSessionsData } = await supabase
      .from('user_sessions')
      .select('session_start, session_end, ip_address, user_agent')
      .eq('user_id', user.id)
      .order('session_start', { ascending: false })
      .limit(50); // Only last 50 sessions for privacy

    if (userSessionsData) {
      exportData.user_sessions = userSessionsData.map((session) => ({
        session_start: session.session_start,
        session_end: session.session_end,
        ip_address: session.ip_address ? 'xxx.xxx.xxx.xxx' : null, // Anonymize IP
        user_agent: session.user_agent,
      }));
    }

    // 7. Get API usage statistics (summary only)
    const { data: apiUsageData } = await supabase
      .from('api_usage_tracking')
      .select('endpoint, request_count, last_request')
      .eq('user_id', user.id)
      .order('last_request', { ascending: false });

    if (apiUsageData) {
      exportData.api_usage = apiUsageData.map((usage) => ({
        endpoint: usage.endpoint,
        request_count: usage.request_count,
        last_request: usage.last_request,
      }));
    }

    // Log the export action for audit purposes
    await supabase.from('api_usage_tracking').insert({
      user_id: user.id,
      endpoint: '/api/gdpr/export',
      request_count: 1,
      last_request: new Date().toISOString(),
    });

    // Return the comprehensive data export
    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user_data_export_${user.id}_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch {
    // GDPR export error - details in response
    return NextResponse.json(
      {
        error: 'Data export failed',
        message:
          'An error occurred while exporting your data. Please try again.',
      },
      { status: 500 }
    );
  }
}

// POST endpoint for requesting specific data formats or filtered exports
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format = 'json', include_sections = [] } = body;

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
            } catch {
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

    // TODO: Implement CSV format and selective data export
    // For now, return JSON format with message about upcoming features
    return NextResponse.json({
      message: 'Custom export formats coming soon',
      available_formats: ['json'],
      available_sections: [
        'user_account',
        'profile',
        'saved_content',
        'user_lounges',
        'email_digests',
        'user_sessions',
        'api_usage',
      ],
      requested_format: format,
      requested_sections: include_sections,
    });
  } catch {
    // GDPR export POST request failed
    return NextResponse.json(
      { error: 'Custom export request failed' },
      { status: 500 }
    );
  }
}
