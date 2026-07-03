export interface YouTubeMeta {
  title: string;
  channel: string;
}

export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_name?: string };
    if (!data.title || !data.author_name) return null;
    return { title: data.title, channel: data.author_name };
  } catch {
    return null;
  }
}
