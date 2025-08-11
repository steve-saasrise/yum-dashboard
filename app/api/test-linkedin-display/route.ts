import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get LinkedIn posts with videos
  const { data: posts } = await supabase
    .from('content')
    .select('*')
    .eq('platform', 'linkedin')
    .not('media_urls', 'is', null)
    .order('published_at', { ascending: false })
    .limit(5);

  const videoPost = posts?.find((p) =>
    p.media_urls?.some((m: any) => m.type === 'video')
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LinkedIn Content Test</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        .post { border: 1px solid #ccc; padding: 15px; margin: 10px 0; }
        .video-container { position: relative; margin: 10px 0; }
        .video-thumbnail { max-width: 600px; width: 100%; }
        .play-button { 
          position: absolute; 
          top: 50%; 
          left: 50%; 
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 20px;
          border-radius: 50%;
        }
        .media-info { background: #f0f0f0; padding: 10px; margin: 5px 0; }
      </style>
    </head>
    <body>
      <h1>LinkedIn Content Display Test</h1>
      <p>Total LinkedIn posts: ${posts?.length || 0}</p>
      
      ${
        videoPost
          ? `
        <div class="post">
          <h2>Video Post Found!</h2>
          <p><strong>Title:</strong> ${videoPost.title}</p>
          <p><strong>Description:</strong> ${videoPost.description?.substring(0, 200)}...</p>
          
          <h3>Media URLs:</h3>
          ${videoPost.media_urls
            .map(
              (media: any) => `
            <div class="media-info">
              <p><strong>Type:</strong> ${media.type}</p>
              ${
                media.type === 'video'
                  ? `
                <p><strong>Video URL:</strong> <a href="${media.url}" target="_blank">${media.url?.substring(0, 50)}...</a></p>
                <p><strong>Thumbnail:</strong> ${media.thumbnail_url ? `<a href="${media.thumbnail_url}" target="_blank">View</a>` : 'None'}</p>
                <div class="video-container">
                  ${
                    media.thumbnail_url
                      ? `
                    <img src="${media.thumbnail_url}" class="video-thumbnail" alt="Video thumbnail" />
                    <div class="play-button">▶️ PLAY</div>
                  `
                      : '<p>No thumbnail available</p>'
                  }
                </div>
              `
                  : ''
              }
              ${
                media.type === 'image'
                  ? `
                <img src="${media.url}" style="max-width: 400px;" alt="Image" />
              `
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>
      `
          : '<p>No video posts found</p>'
      }
      
      <h2>All LinkedIn Posts:</h2>
      ${
        posts
          ?.map(
            (post) => `
        <div class="post">
          <h3>${post.title}</h3>
          <p>${post.description?.substring(0, 150)}...</p>
          <p>Media: ${post.media_urls?.length || 0} items</p>
          <p>Types: ${post.media_urls?.map((m: any) => m.type).join(', ') || 'None'}</p>
        </div>
      `
          )
          .join('') || '<p>No posts found</p>'
      }
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
