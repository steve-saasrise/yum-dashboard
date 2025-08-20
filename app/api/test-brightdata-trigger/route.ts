import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const profileUrl = 'https://www.linkedin.com/in/alexhormozi';
    
    // Test triggering a profile-specific collection
    const endpoint = 'https://api.brightdata.com/datasets/v3/trigger';
    
    // For profile discovery, we need to enable discovery mode
    const queryParams = new URLSearchParams({
      dataset_id: 'gd_lyy3tktm25m4avu764',
      include_errors: 'true',
      type: 'discover_new', // Enable discovery phase
      discover_by: 'profile_url', // Specify we're discovering by profile URL
    });
    
    const body = [
      {
        url: profileUrl,
      },
    ];
    
    const fullUrl = `${endpoint}?${queryParams.toString()}`;
    
    console.log('[Test] Triggering collection:', fullUrl);
    console.log('[Test] Request body:', JSON.stringify(body));
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}`,
        message: errorText,
      });
    }
    
    const result = await response.json();
    console.log('[Test] Trigger response:', result);
    
    // Wait a bit and check status
    if (result.snapshot_id) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Check snapshot status
      const statusUrl = `https://api.brightdata.com/datasets/v3/progress/${result.snapshot_id}`;
      const statusResponse = await fetch(statusUrl, {
        headers: {
          Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
        },
      });
      
      const status = await statusResponse.json();
      
      // If ready, try to fetch data
      let data = null;
      if (status.status === 'ready') {
        const dataUrl = `https://api.brightdata.com/datasets/v3/snapshot/${result.snapshot_id}?format=json`;
        const dataResponse = await fetch(dataUrl, {
          headers: {
            Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
          },
        });
        
        if (dataResponse.ok) {
          data = await dataResponse.json();
        }
      }
      
      return NextResponse.json({
        success: true,
        profile: profileUrl,
        snapshot_id: result.snapshot_id,
        status: status,
        data_preview: data ? {
          count: Array.isArray(data) ? data.length : 1,
          first_post: Array.isArray(data) ? data[0] : data,
        } : null,
      });
    }
    
    return NextResponse.json({
      success: true,
      result: result,
    });
  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}