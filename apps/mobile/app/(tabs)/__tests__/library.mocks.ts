import {
  fetchUserData,
  getAllRaags,
  getAllExercises,
  getAllExerciseCollections,
  getSharedItemIdsForStudent,
} from '@music-app/firebase';

export const mockRouterPush = jest.fn();

export const mockAuthUser = { uid: 'instructor-vocal-1' };

export const mockRaagItems = [
  {
    id: 'raag-yaman',
    name: 'Yaman',
    description: 'Evening raag',
    createdBy: 'instructor-vocal-1',
    isSystemDefault: true,
  },
  {
    id: 'raag-bhairav',
    name: 'Bhairav',
    description: 'Morning raag',
    createdBy: 'system',
    isSystemDefault: true,
  },
];

export const mockTaalItems = [
  {
    id: 'taal-teentaal',
    name: 'Teentaal',
    description: '16 beat cycle',
    createdBy: 'instructor-tabla-1',
    isSystemDefault: false,
  },
];

export const mockSongItems = [
  {
    id: 'song-1',
    name: 'Bandish in Yaman',
    description: 'Vocal composition',
    createdBy: 'instructor-vocal-1',
    isSystemDefault: false,
  },
];

export const vocalInstructorProfile = {
  accountType: 'Instructor',
  musicSubStyleTypes: ['vocal'],
  hiddenSystemDefaults: { raag: [], song: [], taal: [], exerciseCollection: [] },
};

export const instrumentInstructorProfile = {
  accountType: 'Instructor',
  musicSubStyleTypes: ['sitar'],
  hiddenSystemDefaults: { raag: [], song: [], taal: [], exerciseCollection: [] },
};

export const percussionInstructorProfile = {
  accountType: 'Instructor',
  musicSubStyleTypes: ['tabla'],
  hiddenSystemDefaults: { raag: [], song: [], taal: [], exerciseCollection: [] },
};

export const studentProfile = {
  accountType: 'Student',
  musicSubStyleTypes: ['vocal'],
  hiddenSystemDefaults: { raag: [], song: [], taal: [], exerciseCollection: [] },
};

export function setupFirebaseMocks(profile: Record<string, unknown>) {
  (fetchUserData as jest.Mock).mockResolvedValue(profile);
  (getAllRaags as jest.Mock).mockImplementation((collection: string) => {
    if (collection === 'taals') return Promise.resolve(mockTaalItems);
    if (collection === 'songs') return Promise.resolve(mockSongItems);
    return Promise.resolve(mockRaagItems);
  });
  (getAllExercises as jest.Mock).mockResolvedValue([]);
  (getAllExerciseCollections as jest.Mock).mockResolvedValue([]);
  (getSharedItemIdsForStudent as jest.Mock).mockResolvedValue([]);
}

export function setupEmptyLibraryMocks(profile: Record<string, unknown>) {
  (fetchUserData as jest.Mock).mockResolvedValue(profile);
  (getAllRaags as jest.Mock).mockResolvedValue([]);
  (getAllExercises as jest.Mock).mockResolvedValue([]);
  (getAllExerciseCollections as jest.Mock).mockResolvedValue([]);
  (getSharedItemIdsForStudent as jest.Mock).mockResolvedValue([]);
}
