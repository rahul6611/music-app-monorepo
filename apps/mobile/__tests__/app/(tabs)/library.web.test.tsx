import './library.web.setup';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { getAllRaags } from '@music-app/firebase';
import Library from '../../../app/(tabs)/library';
import {
  mockRouterPush,
  mockAuthUser,
  setupFirebaseMocks,
  setupEmptyLibraryMocks,
  vocalInstructorProfile,
  percussionInstructorProfile,
  instrumentInstructorProfile,
} from './library.mocks';

describe('Library screen (Web / React DOM)', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser.uid = 'instructor-vocal-1';
    setupFirebaseMocks(vocalInstructorProfile);
  });

  it('shows vocal melody pills on web and hides percussion-only Taal', async () => {
    render(<Library />);

    await waitFor(
      () => {
        expect(screen.getByText('Yaman')).toBeTruthy();
        expect(screen.queryByText('Taal')).toBeNull();
      },
      { timeout: 8000 }
    );

    expect(screen.getByText('Raag')).toBeTruthy();
    expect(screen.getByText('Songs')).toBeTruthy();
  });

  it('shows Taal pill and taal items for a percussion instructor on web', async () => {
    mockAuthUser.uid = 'instructor-tabla-1';
    setupFirebaseMocks(percussionInstructorProfile);

    render(<Library />);

    await waitFor(
      () => {
        expect(screen.queryByText('Raag')).toBeNull();
        expect(screen.getByText('Taal')).toBeTruthy();
      },
      { timeout: 8000 }
    );

    fireEvent.press(screen.getByText('Taal'));

    await waitFor(() => {
      expect(screen.getByText('Teentaal')).toBeTruthy();
    });
  });

  it('shows raag content for an instrument instructor on web', async () => {
    mockAuthUser.uid = 'instructor-sitar-1';
    setupFirebaseMocks(instrumentInstructorProfile);

    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
      expect(screen.queryByText('Taal')).toBeNull();
    });

    expect(screen.getByText('Raag')).toBeTruthy();
  });

  it('navigates to detail route when a card is pressed on web', async () => {
    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Yaman'));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/library/raag-yaman',
      })
    );
  });

  it('switches category and fetches the correct collection on web', async () => {
    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Songs'));

    await waitFor(() => {
      expect(getAllRaags).toHaveBeenCalledWith('songs');
      expect(screen.getByText('Bandish in Yaman')).toBeTruthy();
    });
  });

  it('shows empty state on web when no library items exist', async () => {
    setupEmptyLibraryMocks(vocalInstructorProfile);

    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('No items found here')).toBeTruthy();
    });
  });
});
