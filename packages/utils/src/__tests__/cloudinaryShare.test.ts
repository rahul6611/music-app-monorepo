import { getCloudinaryOgImageUrl, getCloudinaryVideoUrl } from '../cloudinaryShare';

describe('cloudinaryShare', () => {
  const videoUrl =
    'https://res.cloudinary.com/demo/video/upload/v1234567890/sample-folder/clip.mp4';

  it('builds a Cloudinary JPEG thumbnail for video OG previews', () => {
    expect(getCloudinaryOgImageUrl(videoUrl, true)).toBe(
      'https://res.cloudinary.com/demo/video/upload/so_0,w_1200,h_630,c_fill,f_jpg,q_auto/v1234567890/sample-folder/clip.jpg',
    );
  });

  it('optimizes Cloudinary video playback URLs', () => {
    expect(getCloudinaryVideoUrl(videoUrl)).toBe(
      'https://res.cloudinary.com/demo/video/upload/q_auto/v1234567890/sample-folder/clip.mp4',
    );
  });

  it('passes through non-Cloudinary URLs unchanged', () => {
    const external = 'https://cdn.example.com/video.mp4';
    expect(getCloudinaryOgImageUrl(external, true)).toBe(external);
    expect(getCloudinaryVideoUrl(external)).toBe(external);
  });
});
