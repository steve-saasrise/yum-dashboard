import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { PlatformDetector, PlatformDetectionError } from '@/lib/platform-detector';

const importSchema = z.object({
  format: z.enum(['csv', 'opml'], { required_error: 'Format is required' }),
  data: z.string().min(1, 'Data is required'),
});

interface ImportResult {
  imported: number;
  failed: number;
  creators: any[];
  errors: Array<{
    row: number;
    name?: string;
    url?: string;
    error: string;
  }>;
}

interface CSVRow {
  name: string;
  url: string;
  topics?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = importSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { format, data } = validation.data;

    let result: ImportResult;

    if (format === 'csv') {
      result = await importFromCSV(data, user.id, supabase);
    } else if (format === 'opml') {
      result = await importFromOPML(data, user.id, supabase);
    } else {
      return NextResponse.json(
        { error: 'Unsupported format' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${result.imported} imported, ${result.failed} failed`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/creators/import:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function importFromCSV(
  csvData: string,
  userId: string,
  supabase: any
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    failed: 0,
    creators: [],
    errors: [],
  };

  try {
    // Parse CSV data
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('Invalid CSV format: Missing data rows');
    }

    const header = lines[0].toLowerCase();
    const requiredHeaders = ['name', 'url'];
    const hasRequiredHeaders = requiredHeaders.every((h) =>
      header.includes(h)
    );

    if (!hasRequiredHeaders) {
      throw new Error(
        `Invalid CSV format: Missing required headers (${requiredHeaders.join(', ')})`
      );
    }

    // Parse header to determine column positions
    const headers = header.split(',').map((h) => h.trim().replace(/"/g, ''));
    const nameIndex = headers.indexOf('name');
    const urlIndex = headers.indexOf('url');
    const topicsIndex = headers.indexOf('topics');
    const descriptionIndex = headers.indexOf('description');

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const rowData: CSVRow = {
          name: values[nameIndex] || '',
          url: values[urlIndex] || '',
          topics: topicsIndex >= 0 ? values[topicsIndex] : undefined,
          description: descriptionIndex >= 0 ? values[descriptionIndex] : undefined,
        };

        if (!rowData.name || !rowData.url) {
          result.errors.push({
            row: i + 1,
            name: rowData.name,
            url: rowData.url,
            error: 'Missing required fields (name, url)',
          });
          result.failed++;
          continue;
        }

        // Detect platform
        let platformInfo;
        try {
          platformInfo = PlatformDetector.detect(rowData.url);
        } catch (error) {
          result.errors.push({
            row: i + 1,
            name: rowData.name,
            url: rowData.url,
            error: `Platform detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          result.failed++;
          continue;
        }

        // Check if creator already exists
        const { data: existingCreator } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', userId)
          .eq('platform', platformInfo.platform)
          .eq('platform_user_id', platformInfo.platformUserId)
          .single();

        if (existingCreator) {
          result.errors.push({
            row: i + 1,
            name: rowData.name,
            url: rowData.url,
            error: 'Creator already exists',
          });
          result.failed++;
          continue;
        }

        // Create creator
        const creatorData = {
          user_id: userId,
          display_name: rowData.name,
          description: rowData.description,
          platform: platformInfo.platform,
          platform_user_id: platformInfo.platformUserId,
          profile_url: platformInfo.profileUrl,
          metadata: platformInfo.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newCreator, error: createError } = await supabase
          .from('creators')
          .insert(creatorData)
          .select()
          .single();

        if (createError) {
          result.errors.push({
            row: i + 1,
            name: rowData.name,
            url: rowData.url,
            error: `Database error: ${createError.message}`,
          });
          result.failed++;
          continue;
        }

        result.creators.push(newCreator);
        result.imported++;
      } catch (error) {
        result.errors.push({
          row: i + 1,
          error: `Row parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        result.failed++;
      }
    }
  } catch (error) {
    throw new Error(
      `Invalid CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

async function importFromOPML(
  opmlData: string,
  userId: string,
  supabase: any
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    failed: 0,
    creators: [],
    errors: [],
  };

  try {
    // Basic XML parsing for OPML
    const outlineMatches = opmlData.match(/<outline[^>]*>/g);
    if (!outlineMatches) {
      throw new Error('No outline elements found in OPML');
    }

    for (let i = 0; i < outlineMatches.length; i++) {
      const outline = outlineMatches[i];

      try {
        // Extract attributes
        const titleMatch = outline.match(/title="([^"]*)"/);
        const textMatch = outline.match(/text="([^"]*)"/);
        const xmlUrlMatch = outline.match(/xmlUrl="([^"]*)"/);
        const typeMatch = outline.match(/type="([^"]*)"/);

        const title = titleMatch?.[1] || textMatch?.[1];
        const xmlUrl = xmlUrlMatch?.[1];
        const type = typeMatch?.[1];

        if (!title || !xmlUrl) {
          result.errors.push({
            row: i + 1,
            error: 'Missing required OPML attributes (title/text, xmlUrl)',
          });
          result.failed++;
          continue;
        }

        // For OPML, we primarily handle RSS feeds
        if (type && type !== 'rss' && type !== 'atom') {
          result.errors.push({
            row: i + 1,
            name: title,
            url: xmlUrl,
            error: `Unsupported OPML type: ${type}`,
          });
          result.failed++;
          continue;
        }

        // Detect platform (should be RSS)
        let platformInfo;
        try {
          platformInfo = PlatformDetector.detect(xmlUrl);
        } catch (error) {
          result.errors.push({
            row: i + 1,
            name: title,
            url: xmlUrl,
            error: `Platform detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          result.failed++;
          continue;
        }

        // Check if creator already exists
        const { data: existingCreator } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', userId)
          .eq('platform', platformInfo.platform)
          .eq('platform_user_id', platformInfo.platformUserId)
          .single();

        if (existingCreator) {
          result.errors.push({
            row: i + 1,
            name: title,
            url: xmlUrl,
            error: 'Creator already exists',
          });
          result.failed++;
          continue;
        }

        // Create creator
        const creatorData = {
          user_id: userId,
          display_name: title,
          platform: platformInfo.platform,
          platform_user_id: platformInfo.platformUserId,
          profile_url: platformInfo.profileUrl,
          metadata: platformInfo.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newCreator, error: createError } = await supabase
          .from('creators')
          .insert(creatorData)
          .select()
          .single();

        if (createError) {
          result.errors.push({
            row: i + 1,
            name: title,
            url: xmlUrl,
            error: `Database error: ${createError.message}`,
          });
          result.failed++;
          continue;
        }

        result.creators.push(newCreator);
        result.imported++;
      } catch (error) {
        result.errors.push({
          row: i + 1,
          error: `OPML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        result.failed++;
      }
    }
  } catch (error) {
    throw new Error(
      `Invalid OPML format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}