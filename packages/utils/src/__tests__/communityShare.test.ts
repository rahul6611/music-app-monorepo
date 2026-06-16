import {
  buildCommunityShareMessage,
  buildInstagramCaption,
  canShareMediaToInstagram,
  canShareMediaToTikTok,
  getCommunityPostDeepLink,
  getCommunityPostWebUrl,
  isSocialEmbedPost,
} from '../communityShare';

describe('communityShare', () => {
  const post = {
    id: 'abc123',
    type: 'video',
    title: 'Morning Raga',
    url: 'https://res.cloudinary.com/demo/video.mp4',
    notes: 'Great practice session',
  };

  it('builds web and deep links', () => {
    expect(getCommunityPostWebUrl('abc123')).toBe('https://musiki.app/community/post/abc123');
    expect(getCommunityPostWebUrl('abc123', 'https://app.example.com/')).toBe(
      'https://app.example.com/community/post/abc123',
    );
    expect(getCommunityPostDeepLink('abc123')).toBe('musiki://community/post/abc123');
  });

  it('builds share message with notes', () => {
    const message = buildCommunityShareMessage(post);
    expect(message).toContain('Morning Raga');
    expect(message).toContain('https://musiki.app/community/post/abc123');
    expect(message).toContain('Great practice session');
  });

  it('builds instagram caption', () => {
    const caption = buildInstagramCaption(post);
    expect(caption).toContain('Morning Raga');
    expect(caption).toContain('Watch on Musiki');
  });

  it('classifies share capabilities', () => {
    expect(isSocialEmbedPost('youtube')).toBe(true);
    expect(isSocialEmbedPost('video')).toBe(false);
    expect(canShareMediaToInstagram('image')).toBe(true);
    expect(canShareMediaToInstagram('youtube')).toBe(false);
    expect(canShareMediaToTikTok('video')).toBe(true);
    expect(canShareMediaToTikTok('image')).toBe(false);
  });
});
