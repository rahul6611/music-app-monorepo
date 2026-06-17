const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)(\?.*)?$/i;

export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com');
}

/** JPEG thumbnail from a Cloudinary video — used for Facebook/Twitter link previews. */
export function getCloudinaryOgImageUrl(mediaUrl: string, isVideo = false): string {
  if (!mediaUrl || !isCloudinaryUrl(mediaUrl)) {
    return mediaUrl;
  }

  if (isVideo && mediaUrl.includes('/video/upload/')) {
    const [prefix, rest] = mediaUrl.split('/video/upload/');
    const [path, query = ''] = rest.split('?');
    const jpgPath = path.replace(VIDEO_EXT, '.jpg');
    return `${prefix}/video/upload/so_0,w_1200,h_630,c_fill,f_jpg,q_auto/${jpgPath}${query ? `?${query}` : ''}`;
  }

  if (mediaUrl.includes('/image/upload/')) {
    const [prefix, rest] = mediaUrl.split('/image/upload/');
    return `${prefix}/image/upload/w_1200,h_630,c_fill,f_jpg,q_auto/${rest}`;
  }

  return mediaUrl;
}

/** Direct HTTPS Cloudinary video URL for og:video and inline playback. */
export function getCloudinaryVideoUrl(mediaUrl: string): string {
  if (!mediaUrl || !isCloudinaryUrl(mediaUrl)) {
    return mediaUrl;
  }

  if (mediaUrl.includes('/video/upload/')) {
    return mediaUrl.replace('/video/upload/', '/video/upload/q_auto/');
  }

  return mediaUrl;
}
