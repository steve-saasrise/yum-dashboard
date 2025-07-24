import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAISummaryService } from '@/lib/services/ai-summary-service';
import { z } from 'zod';

const summarizeSchema = z.object({
  contentId: z.string().uuid('Invalid content ID'),
  regenerate: z.boolean().optional().default(false),
});

const batchSummarizeSchema = z.object({
  contentIds: z.array(z.string().uuid()).optional(),
  limit: z.number().min(1).max(100).optional().default(10),
  regenerate: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Single content summarization
    if (body.contentId) {
      const { contentId, regenerate } = summarizeSchema.parse(body);

      // Fetch the content
      const { data: content, error: fetchError } = await supabase
        .from('content')
        .select('id, title, description, summary_status, creator_id')
        .eq('id', contentId)
        .single();

      if (fetchError || !content) {
        return NextResponse.json(
          { error: 'Content not found' },
          { status: 404 }
        );
      }

      // Verify user owns the creator
      const { data: creator } = await supabase
        .from('creators')
        .select('user_id')
        .eq('id', content.creator_id)
        .single();

      if (!creator || creator.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Check if already processed and not regenerating
      if (content.summary_status === 'completed' && !regenerate) {
        return NextResponse.json({
          message: 'Summary already generated',
          contentId,
        });
      }

      // Generate summary
      const text =
        `${content.title || ''}\n\n${content.description || ''}`.trim();
      if (!text) {
        return NextResponse.json(
          { error: 'No text content to summarize' },
          { status: 400 }
        );
      }

      const summaryService = getAISummaryService();
      const result = await summaryService.generateSummary({
        content_id: contentId,
        text,
      });

      return NextResponse.json({
        message: 'Summary generated successfully',
        result,
      });
    }

    // Batch summarization
    else {
      const { contentIds, limit, regenerate } =
        batchSummarizeSchema.parse(body);

      const summaryService = getAISummaryService();

      // If specific IDs provided, use those
      let idsToProcess: string[] = [];

      if (contentIds && contentIds.length > 0) {
        // Verify user owns all the content
        const { data: contents } = await supabase
          .from('content')
          .select('id, creator_id')
          .in('id', contentIds);

        if (!contents) {
          return NextResponse.json(
            { error: 'Failed to fetch content' },
            { status: 500 }
          );
        }

        // Get user's creators
        const { data: userCreators } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', user.id);

        const userCreatorIds = new Set(
          userCreators?.map((c: { id: string }) => c.id) || []
        );

        // Filter to only user's content
        idsToProcess = contents
          .filter((c: { creator_id: string }) =>
            userCreatorIds.has(c.creator_id)
          )
          .map((c: { id: string }) => c.id);
      }
      // Otherwise, get pending summaries for user's content
      else {
        // Get user's creators
        const { data: userCreators } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', user.id);

        if (!userCreators || userCreators.length === 0) {
          return NextResponse.json({
            message: 'No creators found',
            processed: 0,
            errors: 0,
          });
        }

        const creatorIds = userCreators.map((c: { id: string }) => c.id);

        // Get pending content
        const query = supabase
          .from('content')
          .select('id')
          .in('creator_id', creatorIds)
          .limit(limit);

        if (regenerate) {
          query.in('summary_status', ['pending', 'error']);
        } else {
          query.eq('summary_status', 'pending');
        }

        const { data: pendingContent } = await query;
        idsToProcess = pendingContent?.map((c: { id: string }) => c.id) || [];
      }

      if (idsToProcess.length === 0) {
        return NextResponse.json({
          message: 'No content to process',
          processed: 0,
          errors: 0,
        });
      }

      // Process summaries
      const results = await summaryService.generateBatchSummaries(
        idsToProcess,
        {
          batchSize: 5,
        }
      );

      return NextResponse.json({
        message: 'Batch summarization completed',
        ...results,
      });
    }
  } catch (error) {
    // Summarization error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate summaries' },
      { status: 500 }
    );
  }
}
