import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST() {
  try {
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test YouTube channels
    const testChannels = [
      {
        display_name: 'Google Developers',
        url: 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
      },
      {
        display_name: 'Fireship',
        url: 'https://www.youtube.com/@Fireship',
      },
      {
        display_name: 'Traversy Media',
        url: 'https://www.youtube.com/@TraversyMedia',
      },
    ];

    const created = [];
    const errors = [];

    for (const channel of testChannels) {
      try {
        // Create creator
        const { data: creator, error: creatorError } = await supabase
          .from('creators')
          .insert({
            display_name: channel.display_name,
            user_id: user.id,
            bio: `YouTube channel: ${channel.display_name}`,
            verified: false,
            status: 'active',
          })
          .select()
          .single();

        if (creatorError) {
          errors.push({
            channel: channel.display_name,
            error: creatorError.message,
          });
          continue;
        }

        // Add YouTube URL
        const { error: urlError } = await supabase.from('creator_urls').insert({
          creator_id: creator.id,
          platform: 'youtube',
          url: channel.url,
          normalized_url: channel.url,
          validation_status: 'valid',
        });

        if (urlError) {
          // Rollback creator if URL fails
          await supabase.from('creators').delete().eq('id', creator.id);
          errors.push({
            channel: channel.display_name,
            error: urlError.message,
          });
          continue;
        }

        created.push({
          id: creator.id,
          name: creator.display_name,
          url: channel.url,
        });
      } catch (error) {
        errors.push({
          channel: channel.display_name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Test YouTube creators processed',
      created,
      errors,
      summary: `Created ${created.length} YouTube creators, ${errors.length} errors`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
