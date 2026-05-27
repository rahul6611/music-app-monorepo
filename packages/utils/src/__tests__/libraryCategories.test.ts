import { getVisibleLibraryCategories } from '../libraryCategories';

describe('getVisibleLibraryCategories', () => {
  it('shows raag, songs, and laya for a vocal instructor', () => {
    const visible = getVisibleLibraryCategories({
      accountType: 'Instructor',
      musicSubStyleTypes: ['vocal'],
    });
    const ids = visible.map((c) => c.id);

    expect(ids).toContain('raag');
    expect(ids).toContain('songs');
    expect(ids).toContain('laya');
    expect(ids).not.toContain('taal');
  });

  it('shows taal but not raag for a percussion instructor', () => {
    const visible = getVisibleLibraryCategories({
      accountType: 'Instructor',
      musicSubStyleTypes: ['tabla'],
    });
    const ids = visible.map((c) => c.id);

    expect(ids).toContain('taal');
    expect(ids).toContain('exercises');
    expect(ids).not.toContain('raag');
    expect(ids).not.toContain('songs');
  });

  it('shows raag for an instrument instructor', () => {
    const visible = getVisibleLibraryCategories({
      accountType: 'Instructor',
      musicSubStyleTypes: ['sitar'],
    });
    const ids = visible.map((c) => c.id);

    expect(ids).toContain('raag');
    expect(ids).not.toContain('taal');
  });
});
