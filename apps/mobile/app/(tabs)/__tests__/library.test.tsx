import './library.setup';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { getAllRaags } from '@music-app/firebase';
import Library from '../library';
import {
  mockRouterPush,
  mockAuthUser,
  mockRaagItems,
  mockSongItems,
  mockTaalItems,
  setupFirebaseMocks,
  setupEmptyLibraryMocks,
  vocalInstructorProfile,
  instrumentInstructorProfile,
  percussionInstructorProfile,
  studentProfile,
} from './library.mocks';

describe('Library screen (React Native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser.uid = 'instructor-vocal-1';
    setupFirebaseMocks(vocalInstructorProfile);
  });

  it('renders the library header and collection subtitle', async () => {
    render(<Library />);

    expect(screen.getByText('Library')).toBeTruthy();
    expect(screen.getByText('Your musical collection')).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText('No items found here')).toBeNull();
    });
  });

  it('shows melody categories for a vocal instructor and hides Taal', async () => {
    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
      expect(screen.queryByText('Taal')).toBeNull();
    });

    expect(screen.getByText('Raag')).toBeTruthy();
    expect(screen.getByText('Songs')).toBeTruthy();
    expect(screen.getByText('Laya')).toBeTruthy();
  });

  it('shows melody categories for an instrument instructor and hides Taal', async () => {
    mockAuthUser.uid = 'instructor-sitar-1';
    setupFirebaseMocks(instrumentInstructorProfile);

    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
      expect(screen.queryByText('Taal')).toBeNull();
    });

    expect(screen.getByText('Raag')).toBeTruthy();
    expect(screen.getByText('Exercises')).toBeTruthy();
  });

  it('shows Taal for a percussion instructor and hides Raag', async () => {
    mockAuthUser.uid = 'instructor-tabla-1';
    setupFirebaseMocks(percussionInstructorProfile);

    render(<Library />);

    await waitFor(() => {
      expect(screen.queryByText('Raag')).toBeNull();
      expect(screen.getByText('Taal')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Taal'));

    await waitFor(() => {
      expect(screen.getByText('Teentaal')).toBeTruthy();
    });

    expect(screen.queryByText('Songs')).toBeNull();
  });

  it('renders raag cards with titles and descriptions after data loads', async () => {
    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
      expect(screen.getByText('Bhairav')).toBeTruthy();
    });

    expect(screen.getByText('Evening raag')).toBeTruthy();
  });

  it('shows an empty state when the active category has no items', async () => {
    setupEmptyLibraryMocks(vocalInstructorProfile);

    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('No items found here')).toBeTruthy();
    });
  });

  it('navigates to raag detail when a library card is pressed', async () => {
    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Yaman'));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/library/raag-yaman',
        params: expect.objectContaining({ category: 'raag', name: 'Yaman' }),
      })
    );
  });

  it('navigates to create screen when the add button is used', async () => {
    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Yaman')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add to library'));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/library/create',
        params: { category: 'raag' },
      })
    );
  });

  it('loads songs when the Songs category pill is selected', async () => {
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

  it('shows only owned or shared raags for a student', async () => {
    mockAuthUser.uid = 'student-1';
    setupFirebaseMocks(studentProfile);
    const { getSharedItemIdsForStudent } = require('@music-app/firebase');
    (getSharedItemIdsForStudent as jest.Mock).mockResolvedValue(['raag-bhairav']);

    render(<Library />);

    await waitFor(() => {
      expect(screen.getByText('Bhairav')).toBeTruthy();
    });

    expect(screen.queryByText('Yaman')).toBeNull();
  });
});
