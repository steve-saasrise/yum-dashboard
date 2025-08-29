import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { ContentWithCreator, EngagementMetrics } from '@/types/content';
import type { Database } from '@/types/database.types';

// Query parameters schema
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(21),
  platforms: z
    .string()
    .transform((val) => val.split(',').filter(Boolean))
    .pipe(
      z.array(
        z.enum(['youtube', 'twitter', 'linkedin', 'threads', 'rss', 'website'])
      )
    )
    .optional(),
  creator_id: z.string().uuid().optional(),
  lounge_id: z.string().uuid().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['published_at', 'created_at']).default('published_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  content_type: z.enum(['social', 'news']).optional(),
  hours_ago: z.coerce.number().min(1).max(168).optional(), // For news filtering (max 7 days)
});

export async function GET(request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError,
    });

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is curator or admin
    const { data: userData, error: userError } = (await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()) as { data: { role: string } | null; error: any };

    console.log('User data query:', {
      userData,
      userError,
    });

    // Default to non-privileged if query fails or returns no data
    let isPrivilegedUser = false;
    if (userData && !userError) {
      isPrivilegedUser =
        userData.role === 'curator' || userData.role === 'admin';
    }

    console.log('User role check:', {
      userId: user.id,
      userEmail: user.email,
      userRole: userData?.role,
      isPrivilegedUser,
    });

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    // Get creator IDs based on lounge_id and feed subscriptions
    let creatorIds: string[] = [];
    let excludedCreatorIds: string[] = [];

    if (query.lounge_id) {
      // If lounge_id is provided, get creators for that specific lounge
      const { data: creatorLounges, error: creatorsError } = (await supabase
        .from('creator_lounges')
        .select('creator_id')
        .eq('lounge_id', query.lounge_id)) as {
        data: { creator_id: string }[] | null;
        error: any;
      };

      if (creatorsError) {
        return NextResponse.json(
          { error: 'Failed to fetch lounge creators' },
          { status: 500 }
        );
      }

      creatorIds = creatorLounges?.map((cl) => cl.creator_id) || [];
    } else {
      // When no lounge is selected, exclude content from creators who are ONLY in unsubscribed lounges
      // This applies to ALL users including curators/admins
      const { data: unsubscribedLounges, error: subsError } = (await supabase
        .from('lounge_feed_subscriptions')
        .select('lounge_id')
        .eq('user_id', user.id)
        .eq('subscribed', false)) as {
        data: { lounge_id: string }[] | null;
        error: any;
      };

      if (!subsError && unsubscribedLounges && unsubscribedLounges.length > 0) {
        const unsubscribedLoungeIds = unsubscribedLounges.map(
          (s) => s.lounge_id
        );

        // Get ALL lounges the user is subscribed to (or hasn't explicitly unsubscribed from)
        const { data: allLounges } = (await supabase
          .from('lounges')
          .select('id')) as { data: { id: string }[] | null; error: any };

        const subscribedLoungeIds =
          allLounges
            ?.filter((l) => !unsubscribedLoungeIds.includes(l.id))
            .map((l) => l.id) || [];

        // Get creators from unsubscribed lounges
        const { data: creatorsInUnsubscribedLounges } = (await supabase
          .from('creator_lounges')
          .select('creator_id')
          .in('lounge_id', unsubscribedLoungeIds)) as {
          data: { creator_id: string }[] | null;
          error: any;
        };

        // Get creators from subscribed lounges (only if there are any subscribed lounges)
        let creatorsInSubscribedLounges: { creator_id: string }[] | null = null;
        if (subscribedLoungeIds.length > 0) {
          const result = (await supabase
            .from('creator_lounges')
            .select('creator_id')
            .in('lounge_id', subscribedLoungeIds)) as {
            data: { creator_id: string }[] | null;
            error: any;
          };
          creatorsInSubscribedLounges = result.data;
        }

        if (creatorsInUnsubscribedLounges) {
          // Find creators who are ONLY in unsubscribed lounges
          const subscribedCreatorSet = new Set(
            creatorsInSubscribedLounges?.map((cl) => cl.creator_id) || []
          );

          const unsubscribedCreatorIds = creatorsInUnsubscribedLounges.map(
            (cl) => cl.creator_id
          );

          // Only exclude creators who are NOT in any subscribed lounge
          excludedCreatorIds = [
            ...new Set(
              unsubscribedCreatorIds.filter(
                (id) => !subscribedCreatorSet.has(id)
              )
            ),
          ];

          console.log('Feed subscription filtering:', {
            userId: user.id,
            unsubscribedLounges: unsubscribedLoungeIds,
            subscribedLounges: subscribedLoungeIds.length,
            creatorsInUnsubscribed: unsubscribedCreatorIds.length,
            creatorsInSubscribed: subscribedCreatorSet.size,
            actuallyExcluded: excludedCreatorIds.length,
            isPrivilegedUser,
          });
        }
      }
      // Empty creatorIds array means no creator filtering (show all)
      creatorIds = [];
    }

    // If there's a search query, also find creators whose names match
    let searchCreatorIds: string[] = [];
    if (query.search) {
      const { data: matchingCreators, error: searchError } = (await supabase
        .from('creators')
        .select('id, display_name')
        .ilike('display_name', `%${query.search}%`)) as {
        data: { id: string; display_name: string }[] | null;
        error: any;
      };

      console.log('Creator search query:', {
        searchTerm: query.search,
        matchingCreatorsFound: matchingCreators?.length || 0,
        error: searchError,
        sampleCreators: matchingCreators
          ?.slice(0, 3)
          .map((c) => c.display_name),
      });

      if (matchingCreators && matchingCreators.length > 0) {
        // Filter to only include creators that are in the original set (respecting lounge filter)
        const filteredMatchingCreators = matchingCreators.filter((c) =>
          creatorIds.includes(c.id)
        );
        searchCreatorIds = filteredMatchingCreators.map((c) => c.id);

        console.log('Filtered creators matching search:', {
          searchTerm: query.search,
          totalMatchingCreators: matchingCreators.length,
          filteredMatchingCreatorCount: searchCreatorIds.length,
          matchingCreatorNames: filteredMatchingCreators.map(
            (c) => c.display_name
          ),
        });
      }
    }

    console.log('Creator IDs for query:', {
      loungeId: query.lounge_id,
      creatorCount: creatorIds.length,
      excludedCreatorCount: excludedCreatorIds.length,
      showingAllContent: creatorIds.length === 0 && !query.lounge_id,
    });

    // Only return empty if we have a specific lounge with no creators
    if (query.lounge_id && creatorIds.length === 0) {
      // Specific lounge has no creators
      return NextResponse.json({
        content: [],
        page: query.page,
        limit: query.limit,
        total: 0,
        has_more: false,
      });
    }

    // Get deleted content IDs first (before fetching content)
    const deletedContentMap = new Map<string, boolean>();
    const deletedContentIds = new Set<string>();

    if (!isPrivilegedUser) {
      if (creatorIds.length > 0) {
        // For viewers with specific creators, get deleted content IDs using the database function
        const { data: deletedIds, error: rpcError } = (await supabase.rpc(
          'get_deleted_content_for_filtering',
          {
            creator_ids: creatorIds,
          }
        )) as { data: { content_id: string }[] | null; error: any };

        console.log('Deleted content IDs from RPC for viewer:', {
          count: deletedIds?.length || 0,
          error: rpcError,
          ids: deletedIds?.map((d) => d.content_id),
        });

        if (deletedIds && deletedIds.length > 0) {
          deletedIds.forEach((item) => {
            deletedContentMap.set(item.content_id, true);
            deletedContentIds.add(item.content_id);
          });
        }
      } else {
        // For viewers seeing all content, use the database function to efficiently get deleted content IDs
        // This handles large datasets better than IN clauses
        const { data: deletedIds, error: deletedError } = (await supabase.rpc(
          'get_all_deleted_content_ids',
          {
            excluded_creator_ids:
              excludedCreatorIds.length > 0 ? excludedCreatorIds : undefined,
          }
        )) as { data: { content_id: string }[] | null; error: any };

        if (deletedError) {
          console.error('Error fetching deleted content IDs:', deletedError);
        }

        if (deletedIds && deletedIds.length > 0) {
          deletedIds.forEach((item) => {
            deletedContentIds.add(item.content_id);
            deletedContentMap.set(item.content_id, true);
          });
        }

        console.log(
          `Pre-fetched ${deletedContentIds.size} deleted content IDs for viewer seeing all content (excluded ${excludedCreatorIds.length} creators)`
        );
      }
    }

    // Build the content query with lounge associations
    let contentQuery = supabase
      .from('content')
      .select(
        `
        *,
        creator:creators(
          id,
          display_name,
          avatar_url,
          metadata,
          content_type
        )
      `,
        { count: 'exact' }
      )
      .eq('processing_status', 'processed');

    // Filter by creator_id if we have specific creators
    if (creatorIds.length > 0) {
      contentQuery = contentQuery.in('creator_id', creatorIds);
    } else if (excludedCreatorIds.length > 0) {
      // When showing all content, exclude creators from unsubscribed lounges
      // This applies to ALL users including curators/admins to respect their feed preferences
      // Using proper Supabase filter syntax for NOT IN
      contentQuery = contentQuery.filter(
        'creator_id',
        'not.in',
        `(${excludedCreatorIds.map((id) => `"${id}"`).join(',')})`
      );
    }

    // For non-privileged users, exclude deleted content at query level for proper pagination
    if (!isPrivilegedUser && deletedContentIds.size > 0) {
      contentQuery = contentQuery.filter(
        'id',
        'not.in',
        `(${Array.from(deletedContentIds)
          .map((id) => `"${id}"`)
          .join(',')})`
      );
    }

    // IMPORTANT: For regular users, only show content that has been scored
    // This prevents unscored (potentially off-topic) content from appearing
    if (!isPrivilegedUser) {
      contentQuery = contentQuery.not('relevancy_checked_at', 'is', null);
    }

    // Filter duplicates - only show primary content for regular users
    // Privileged users see all content but with duplicate information
    if (!isPrivilegedUser) {
      contentQuery = contentQuery.eq('is_primary', true);
    }

    // Apply content type filter if specified
    if (query.content_type) {
      // First get creators of the specified type
      const { data: typedCreators } = await supabase
        .from('creators')
        .select('id')
        .eq('content_type', query.content_type);

      if (typedCreators && typedCreators.length > 0) {
        const typedCreatorIds = typedCreators.map((c) => c.id);
        if (creatorIds.length > 0) {
          // If we already have creator filtering, intersect with typed creators
          const intersection = creatorIds.filter((id) =>
            typedCreatorIds.includes(id)
          );
          contentQuery = contentQuery.in('creator_id', intersection);
        } else {
          // Apply content type filtering
          contentQuery = contentQuery.in('creator_id', typedCreatorIds);
        }
      } else {
        // No creators of this type, return empty result
        return NextResponse.json({
          content: [],
          page: query.page,
          limit: query.limit,
          total: 0,
          has_more: false,
        });
      }
    }

    // Apply time-based filtering for news content
    if (query.hours_ago) {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - query.hours_ago);
      contentQuery = contentQuery.gte('published_at', cutoffDate.toISOString());
    }

    // Apply filters
    if (query.platforms && query.platforms.length > 0) {
      contentQuery = contentQuery.in('platform', query.platforms);
    }

    if (query.creator_id && creatorIds.includes(query.creator_id)) {
      contentQuery = contentQuery.eq('creator_id', query.creator_id);
    }

    // Note: Lounge filtering removed as content_topics table doesn't exist yet

    if (query.search) {
      // Build a complex OR query that includes:
      // 1. Content with matching title or description
      // 2. Content from creators with matching names
      if (searchCreatorIds.length > 0) {
        // If we found creators matching the search, include their content
        // Use proper PostgREST syntax for IN clause
        const creatorIdList = searchCreatorIds.join(',');
        contentQuery = contentQuery.or(
          `title.ilike.%${query.search}%,description.ilike.%${query.search}%,creator_id.in.(${creatorIdList})`
        );
      } else {
        // No matching creators, just search content
        contentQuery = contentQuery.or(
          `title.ilike.%${query.search}%,description.ilike.%${query.search}%`
        );
      }
    }

    // Apply sorting
    contentQuery = contentQuery.order(query.sort_by, {
      ascending: query.sort_order === 'asc',
    });

    // Apply pagination
    const offset = (query.page - 1) * query.limit;
    contentQuery = contentQuery.range(offset, offset + query.limit - 1);

    // Execute query
    const {
      data: content,
      error: contentError,
      count,
    } = (await contentQuery) as {
      data: any[] | null;
      error: any;
      count: number | null;
    };

    if (contentError) {
      // Error fetching content
      return NextResponse.json(
        { error: 'Failed to fetch content' },
        { status: 500 }
      );
    }

    // Debug: Check if relevancy fields are in raw data
    if (content && content.length > 0) {
      const bobGourley = content.find(
        (c) => c.id === '87546a50-7064-4c2b-90a9-e18ec5f4a1dd'
      );
      if (bobGourley) {
        console.log('[API] Raw Bob Gourley content from DB:', {
          id: bobGourley.id,
          title: bobGourley.title,
          relevancy_score: bobGourley.relevancy_score,
          relevancy_checked_at: bobGourley.relevancy_checked_at,
          relevancy_reason: bobGourley.relevancy_reason,
          hasFields: {
            score: 'relevancy_score' in bobGourley,
            checked: 'relevancy_checked_at' in bobGourley,
            reason: 'relevancy_reason' in bobGourley,
          },
        });
      }
    }

    console.log('Content query results:', {
      totalCount: count,
      fetchedCount: content?.length || 0,
      contentIds: content?.slice(0, 5).map((c) => ({
        id: c.id,
        platform_content_id: c.platform_content_id,
        platform: c.platform,
        title: c.title?.substring(0, 50),
      })),
    });

    // For privileged users, get deleted content data after fetching content
    const deletionReasonMap = new Map<string, string>();
    if (isPrivilegedUser && content && content.length > 0) {
      // Extract unique combinations of platform_content_id, platform, and creator_id from current page
      const contentIdentifiers = content.map((c) => ({
        platform_content_id: c.platform_content_id,
        platform: String(c.platform),
        creator_id: c.creator_id,
      }));

      // Fetch deletion data for all items on the current page in a single query
      // We'll use multiple OR conditions to match each content item
      const { data: deletedContent, error: deletedError } = await supabase
        .from('deleted_content')
        .select('platform_content_id, platform, creator_id, deletion_reason')
        .in(
          'platform_content_id',
          contentIdentifiers.map((c) => c.platform_content_id)
        );

      console.log('Deleted content query result:', {
        contentOnPage: content.length,
        deletedItemsFound: deletedContent?.length || 0,
        error: deletedError,
      });

      if (deletedContent && deletedContent.length > 0) {
        deletedContent.forEach((dc) => {
          // Find matching content by platform_content_id, platform, and creator_id
          const matchingContent = content.find((c) => {
            const matches =
              c.platform_content_id === dc.platform_content_id &&
              String(c.platform) === dc.platform &&
              c.creator_id === dc.creator_id;

            return matches;
          });

          if (matchingContent) {
            deletedContentMap.set(matchingContent.id, true);
            deletionReasonMap.set(
              matchingContent.id,
              dc.deletion_reason || 'manual'
            );

            // Debug log for auto-deleted items
            if (dc.deletion_reason === 'low_relevancy') {
              console.log('Successfully mapped low_relevancy item:', {
                content_id: matchingContent.id,
                deletion_reason: dc.deletion_reason,
                title: matchingContent.title,
                platform_content_id: dc.platform_content_id,
              });
            }
          }
        });
      }
    }

    // For privileged users, content is not filtered. For non-privileged users,
    // deleted content was already filtered at the query level for proper pagination
    const filteredContent = content || [];

    if (!isPrivilegedUser) {
      console.log(
        `Content already filtered at query level for non-privileged user ${user.email}`
      );
    } else {
      console.log(
        `Showing all content including deleted for privileged user ${user.email} (role: ${userData?.role})`
      );
    }

    // Fetch lounge associations for all creators in the content
    const uniqueCreatorIds = [
      ...new Set(
        filteredContent.map((item) => item.creator_id).filter(Boolean)
      ),
    ];
    const creatorLoungesMap = new Map<
      string,
      Array<{ id: string; name: string }>
    >();

    if (uniqueCreatorIds.length > 0) {
      const { data: creatorLounges } = await supabase
        .from('creator_lounges')
        .select('creator_id, lounges(id, name)')
        .in('creator_id', uniqueCreatorIds);

      if (creatorLounges) {
        creatorLounges.forEach((cl) => {
          if (cl.lounges) {
            if (!creatorLoungesMap.has(cl.creator_id)) {
              creatorLoungesMap.set(cl.creator_id, []);
            }
            creatorLoungesMap.get(cl.creator_id)?.push(cl.lounges as any);
          }
        });
      }
    }

    // Transform the data to match ContentWithCreator type
    const transformedContent: ContentWithCreator[] = filteredContent.map(
      (item): ContentWithCreator => {
        // Debug Hiten Shah tweet
        if (item.description?.includes('pile of highlights')) {
          const transformedItem = {
            ...item,
            // Handle media_urls Json type
            media_urls: Array.isArray(item.media_urls)
              ? (item.media_urls as any)
              : null,
            // Handle engagement_metrics Json type
            engagement_metrics:
              typeof item.engagement_metrics === 'object' &&
              item.engagement_metrics &&
              !Array.isArray(item.engagement_metrics)
                ? (item.engagement_metrics as EngagementMetrics)
                : null,
            topics: [], // No topics for now since content_topics table doesn't exist
            creator: item.creator
              ? {
                  id: item.creator.id,
                  name: item.creator.display_name, // Map display_name to name
                  platform: item.platform, // Get platform from content since creators don't have it
                  avatar_url: item.creator.avatar_url,
                  metadata:
                    typeof item.creator.metadata === 'object' &&
                    item.creator.metadata &&
                    !Array.isArray(item.creator.metadata)
                      ? (item.creator.metadata as Record<string, any>)
                      : undefined,
                  lounges: creatorLoungesMap.get(item.creator_id) || [], // Add lounges
                }
              : undefined,
            // Add deletion status for privileged users
            ...(isPrivilegedUser && {
              is_deleted: deletedContentMap.has(item.id),
              deletion_reason: deletionReasonMap.get(item.id),
            }),
          };

          console.log('Transforming Hiten Shah tweet:', {
            id: item.id,
            has_deletion: deletedContentMap.has(item.id),
            deletion_reason_from_map: deletionReasonMap.get(item.id),
            isPrivilegedUser,
            transformed_deletion_reason: transformedItem.deletion_reason,
            final_item: transformedItem,
          });
        }

        // Log reference fields for debugging
        if (item.reference_type || item.referenced_content) {
          console.log('Content with reference:', {
            id: item.id,
            title: item.title,
            reference_type: item.reference_type,
            has_referenced_content: !!item.referenced_content,
            referenced_content_sample: item.referenced_content
              ? {
                  text: (item.referenced_content as any)?.text?.substring(
                    0,
                    50
                  ),
                  author: (item.referenced_content as any)?.author?.username,
                }
              : null,
          });
        }

        const transformedItem = {
          ...item,
          // Explicitly preserve relevancy fields
          relevancy_score: item.relevancy_score,
          relevancy_checked_at: item.relevancy_checked_at,
          relevancy_reason: item.relevancy_reason,
          // Handle media_urls Json type
          media_urls: Array.isArray(item.media_urls) ? item.media_urls : null,
          // Handle engagement_metrics Json type
          engagement_metrics:
            typeof item.engagement_metrics === 'object' &&
            item.engagement_metrics &&
            !Array.isArray(item.engagement_metrics)
              ? (item.engagement_metrics as EngagementMetrics)
              : null,
          topics: [], // No topics for now since content_topics table doesn't exist
          creator: item.creator
            ? {
                id: item.creator.id,
                name: item.creator.display_name, // Map display_name to name
                platform: item.platform, // Get platform from content since creators don't have it
                avatar_url: item.creator.avatar_url,
                metadata:
                  typeof item.creator.metadata === 'object' &&
                  item.creator.metadata &&
                  !Array.isArray(item.creator.metadata)
                    ? (item.creator.metadata as Record<string, any>)
                    : undefined,
                lounges: creatorLoungesMap.get(item.creator_id) || [], // Add lounges
              }
            : undefined,
          // Add deletion status for privileged users
          ...(isPrivilegedUser && {
            is_deleted: deletedContentMap.has(item.id),
            deletion_reason: deletionReasonMap.get(item.id),
          }),
          // Add deduplication info for privileged users
          ...(isPrivilegedUser && {
            content_hash: item.content_hash,
            duplicate_group_id: item.duplicate_group_id,
            is_primary: item.is_primary,
          }),
        };

        // Debug duplicate content
        if (item.duplicate_group_id) {
          console.log('Duplicate content found:', {
            id: transformedItem.id,
            title: transformedItem.title,
            content_hash: transformedItem.content_hash,
            duplicate_group_id: transformedItem.duplicate_group_id,
            is_primary: transformedItem.is_primary,
            isPrivilegedUser,
          });
        }

        // Debug Bob Gourley's transformed data
        if (item.title?.includes('@bobgourley')) {
          console.log('[API] Bob Gourley transformed data:', {
            id: transformedItem.id,
            relevancy_score: transformedItem.relevancy_score,
            relevancy_checked_at: transformedItem.relevancy_checked_at,
            relevancy_reason: transformedItem.relevancy_reason,
            hasFields: {
              score: 'relevancy_score' in transformedItem,
              checked: 'relevancy_checked_at' in transformedItem,
              reason: 'relevancy_reason' in transformedItem,
            },
          });
        }

        return transformedItem as ContentWithCreator;
      }
    );

    // Check if user has saved any of this content
    if (transformedContent.length > 0) {
      const contentIds = transformedContent.map((c) => c.id);
      const { data: savedContent } = await supabase
        .from('saved_content')
        .select('content_id')
        .eq('user_id', user.id)
        .in('content_id', contentIds);

      const savedContentIds = new Set(
        savedContent?.map((s) => s.content_id) || []
      );

      // Add saved status to content
      transformedContent.forEach((content) => {
        (content as ContentWithCreator & { is_saved: boolean }).is_saved =
          savedContentIds.has(content.id);
      });
    }

    // Debug: Check Bob Gourley in transformed content
    const transformedBobGourley = transformedContent.find(
      (c) => c.id === '87546a50-7064-4c2b-90a9-e18ec5f4a1dd'
    );
    if (transformedBobGourley) {
      console.log('[API] Transformed Bob Gourley content:', {
        id: transformedBobGourley.id,
        title: transformedBobGourley.title,
        relevancy_score: transformedBobGourley.relevancy_score,
        relevancy_checked_at: transformedBobGourley.relevancy_checked_at,
        relevancy_reason: transformedBobGourley.relevancy_reason,
        hasFields: {
          score: 'relevancy_score' in transformedBobGourley,
          checked: 'relevancy_checked_at' in transformedBobGourley,
          reason: 'relevancy_reason' in transformedBobGourley,
        },
      });
    }

    const response = {
      content: transformedContent,
      page: query.page,
      limit: query.limit,
      total: count || 0,
      has_more: (count || 0) > offset + query.limit,
    };

    console.log('API Response:', {
      contentCount: transformedContent.length,
      isPrivilegedUser,
      deletedContentIds: Array.from(deletedContentMap.keys()),
      firstFewItems: transformedContent.slice(0, 3).map((c) => ({
        id: c.id,
        title: c.title,
        is_deleted: c.is_deleted,
      })),
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    // Error in content API

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint for saving/bookmarking content
export async function POST(request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content_id, action } = z
      .object({
        content_id: z.string().uuid(),
        action: z.enum(['save', 'unsave']),
      })
      .parse(body);

    if (action === 'save') {
      const { error } = await supabase
        .from('saved_content')
        .insert({
          user_id: user.id,
          content_id,
        })
        .single();

      if (error && error.code !== '23505') {
        // Ignore duplicate key errors
        // Error saving content
        return NextResponse.json(
          { error: 'Failed to save content' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from('saved_content')
        .delete()
        .eq('user_id', user.id)
        .eq('content_id', content_id);

      if (error) {
        // Error unsaving content
        return NextResponse.json(
          { error: 'Failed to unsave content' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Error in save content API

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint for deleting/undeleting content
export async function DELETE(request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is curator or admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      !userData ||
      (userData.role !== 'curator' && userData.role !== 'admin')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const content_id = searchParams.get('content_id');
    const action = searchParams.get('action');

    if (
      !content_id ||
      !action ||
      (action !== 'delete' && action !== 'undelete' && action !== 'unduplicate')
    ) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      // Get content details for the deleted_content table
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('platform_content_id, platform, creator_id, title, url')
        .eq('id', content_id)
        .single();

      if (contentError || !content) {
        return NextResponse.json(
          { error: 'Content not found' },
          { status: 404 }
        );
      }

      // Insert into deleted_content
      const { error: deleteError } = await supabase
        .from('deleted_content')
        .insert({
          platform_content_id: content.platform_content_id,
          platform: content.platform,
          creator_id: content.creator_id,
          deleted_by: user.id,
          deleted_at: new Date().toISOString(),
          title: content.title,
          url: content.url,
        });

      if (deleteError && deleteError.code !== '23505') {
        // Ignore duplicate key errors
        return NextResponse.json(
          { error: 'Failed to delete content' },
          { status: 500 }
        );
      }
    } else if (action === 'undelete') {
      // Undelete - remove from deleted_content
      // First get the content details to match the deletion
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select(
          'platform_content_id, platform, creator_id, relevancy_score, relevancy_reason, title, description, url'
        )
        .eq('id', content_id)
        .single();

      if (contentError || !content) {
        return NextResponse.json(
          { error: 'Content not found' },
          { status: 404 }
        );
      }

      const { error: undeleteError } = await supabase
        .from('deleted_content')
        .delete()
        .eq('platform_content_id', content.platform_content_id)
        .eq('platform', content.platform)
        .eq('creator_id', content.creator_id);

      if (undeleteError) {
        return NextResponse.json(
          { error: 'Failed to undelete content' },
          { status: 500 }
        );
      }

      // Track restoration for relevancy learning (only if content has low relevancy score)
      if (
        content.relevancy_score &&
        parseFloat(content.relevancy_score.toString()) < 60
      ) {
        try {
          // Get the first lounge this content belongs to via creator
          const { data: loungeData } = await supabase
            .from('creator_lounges')
            .select('lounge_id')
            .eq('creator_id', content.creator_id)
            .limit(1)
            .single();

          if (loungeData?.lounge_id) {
            // Get creator name for the snapshot
            const { data: creatorData } = await supabase
              .from('creators')
              .select('display_name')
              .eq('id', content.creator_id)
              .single();

            const contentSnapshot = {
              title: content.title,
              description: content.description,
              url: content.url,
              platform: content.platform,
              creator_name: creatorData?.display_name || 'Unknown',
            };

            // Track the restoration
            const { error: trackingError } = await supabase
              .from('relevancy_corrections')
              .insert({
                content_id: content_id,
                lounge_id: loungeData.lounge_id,
                original_score: parseFloat(content.relevancy_score.toString()),
                original_reason:
                  content.relevancy_reason || 'No reason recorded',
                restored_by: user.id,
                content_snapshot: contentSnapshot,
              });

            if (!trackingError) {
              console.log('Restoration tracked for relevancy learning:', {
                content_id,
                lounge_id: loungeData.lounge_id,
                score: content.relevancy_score,
              });

              // Also update the content's relevancy score to prevent immediate re-filtering
              await supabase
                .from('content')
                .update({
                  relevancy_score: 100, // Max score to indicate manual approval
                  relevancy_reason: 'Manually restored by ' + userData.role,
                })
                .eq('id', content_id);
            }
          }
        } catch (trackError) {
          // Don't fail the undelete if tracking fails, just log it
          console.error(
            'Failed to track restoration for learning:',
            trackError
          );
        }
      }
    } else if (action === 'unduplicate') {
      // Unduplicate - set is_primary = true to show this content to all users
      const { error: unduplicateError } = await supabase
        .from('content')
        .update({ is_primary: true })
        .eq('id', content_id);

      if (unduplicateError) {
        return NextResponse.json(
          { error: 'Failed to unduplicate content' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
