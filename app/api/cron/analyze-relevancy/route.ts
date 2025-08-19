import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// This should be called weekly via a cron job
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Get unprocessed corrections from the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: corrections, error: correctionsError } = await supabase
      .from('relevancy_corrections')
      .select(
        `
        *,
        lounges (
          id,
          name,
          theme_description,
          relevancy_threshold
        )
      `
      )
      .eq('processed', false)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('lounge_id');

    if (correctionsError) {
      console.error('Error fetching corrections:', correctionsError);
      return NextResponse.json(
        { error: 'Failed to fetch corrections' },
        { status: 500 }
      );
    }

    if (!corrections || corrections.length === 0) {
      console.log('No corrections to analyze this week');
      return NextResponse.json({
        message: 'No corrections to analyze',
        corrections_analyzed: 0,
        suggestions_generated: 0,
      });
    }

    // Group corrections by lounge
    const correctionsByLounge = corrections.reduce(
      (acc, correction) => {
        const loungeId = correction.lounge_id;
        if (!acc[loungeId]) {
          acc[loungeId] = {
            lounge: correction.lounges,
            corrections: [],
          };
        }
        acc[loungeId].corrections.push(correction);
        return acc;
      },
      {} as Record<string, { lounge: any; corrections: any[] }>
    );

    const suggestions: any[] = [];
    const analysisSummary: any = {};

    // Analyze each lounge's corrections
    for (const [loungeId, data] of Object.entries(correctionsByLounge)) {
      const { lounge, corrections: loungeCorrections } = data as {
        lounge: any;
        corrections: any[];
      };

      if (loungeCorrections.length === 0) continue;

      // Prepare content for analysis
      const correctionSummaries = loungeCorrections.map((c) => ({
        content: c.content_snapshot,
        original_score: c.original_score,
        original_reason: c.original_reason,
      }));

      // Ask GPT-4 to analyze patterns
      const analysisPrompt = `You are analyzing content that was incorrectly filtered as low relevancy but was manually restored by curators.

Lounge: ${lounge.name}
Description: ${lounge.theme_description}
Current threshold: ${lounge.relevancy_threshold || 60}

Incorrectly filtered content (${loungeCorrections.length} items):
${JSON.stringify(correctionSummaries, null, 2)}

Analyze these corrections and identify patterns. What type of content is being incorrectly filtered?

Provide up to 3 specific, actionable adjustments to the relevancy prompt that would have correctly identified this content as relevant. Each adjustment should be:
1. A single, clear rule or criterion
2. Specific enough to catch similar content
3. Not so broad that it would let in irrelevant content

Respond in JSON format:
{
  "pattern_analysis": "Brief description of the pattern you identified",
  "adjustments": [
    {
      "type": "keep", // or "filter" or "borderline"
      "text": "Specific rule to add (e.g., 'B2B marketing strategies with indirect SaaS applications')",
      "reasoning": "Why this would help"
    }
  ]
}`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert at analyzing content categorization patterns. Provide specific, actionable improvements.',
            },
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });

        const analysis = JSON.parse(
          response.choices[0].message.content || '{}'
        );

        analysisSummary[lounge.name] = {
          corrections_count: loungeCorrections.length,
          pattern: analysis.pattern_analysis,
          suggestions_count: analysis.adjustments?.length || 0,
        };

        // Store each adjustment suggestion
        for (const adjustment of analysis.adjustments || []) {
          // Check if this adjustment already exists
          const { data: existing } = await supabase
            .from('prompt_adjustments')
            .select('id')
            .eq('lounge_id', loungeId)
            .eq('adjustment_text', adjustment.text)
            .single();

          if (!existing) {
            const { data: newAdjustment, error: adjustmentError } =
              await supabase
                .from('prompt_adjustments')
                .insert({
                  lounge_id: loungeId,
                  adjustment_type: adjustment.type,
                  adjustment_text: adjustment.text,
                  reason: adjustment.reasoning,
                  corrections_addressed: loungeCorrections.length,
                  approved: false, // Requires manual approval
                  active: false, // Not active until approved
                })
                .select()
                .single();

            if (!adjustmentError && newAdjustment) {
              suggestions.push({
                lounge: lounge.name,
                adjustment: newAdjustment,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error analyzing lounge ${lounge.name}:`, error);
      }
    }

    // Mark all analyzed corrections as processed
    const correctionIds = corrections.map((c) => c.id);
    await supabase
      .from('relevancy_corrections')
      .update({ processed: true })
      .in('id', correctionIds);

    // Record the analysis run
    const { data: analysisRun } = await supabase
      .from('relevancy_analysis_runs')
      .insert({
        corrections_analyzed: corrections.length,
        suggestions_generated: suggestions.length,
        analysis_summary: analysisSummary,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Send notification email to admin (optional - implement if needed)
    if (suggestions.length > 0) {
      // You could send an email here with the suggestions
      console.log('New relevancy suggestions generated:', suggestions);
    }

    return NextResponse.json({
      success: true,
      run_id: analysisRun?.id,
      corrections_analyzed: corrections.length,
      suggestions_generated: suggestions.length,
      analysis_summary: analysisSummary,
      suggestions,
    });
  } catch (error) {
    console.error('Error in analyze-relevancy cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
