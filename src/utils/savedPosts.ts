export async function sharePostContent(
  post: { id: string; authorUsername?: string; caption?: string },
  language: 'ar' | 'en'
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof window === 'undefined') return 'failed';
  const shareUrl = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
  const shareTitle = post.authorUsername ? `@${post.authorUsername} • InstaVibe` : 'InstaVibe';
  const shareText = post.caption
    ? `${shareTitle}: ${post.caption.slice(0, 120)}`
    : language === 'ar'
    ? `شاهد هذا المنشور على InstaVibe`
    : `Check out this post on InstaVibe`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      return 'shared';
    } catch {
      // User cancelled or share unsupported in iframe -> fall back to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    return 'copied';
  } catch {
    return 'failed';
  }
}
