import { Timestamp } from 'firebase/firestore';

export type AssignmentType = 'exercise' | 'raag' | 'song' | 'taal';

export interface AssignmentItem {
  id: string;
  type: AssignmentType;
  itemId: string;
  title: string;
  assignedBy: string;
  bpm?: number | number[];
  repetitions?: number;
  accompanimentType?: 'tabla' | 'metronome' | 'none';
  minutes?: number;
  parentItemId?: string;
  [key: string]: any;
}

export interface ClassAssignment {
  id: string;
  studentId: string;
  instructorId: string;
  classId: string;
  classDate: string; // ISO string YYYY-MM-DD
  classTime: string;
  assignments: AssignmentItem[];
  partMinutes?: number[];
  createdAt?: Timestamp | { seconds: number; nanoseconds: number; toMillis?: () => number };
  [key: string]: any;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  classAssignmentId: string;
  studentId: string;
  instructorId: string;
  mediaUrl: string;
  mediaType: 'video' | 'audio';
  fileName: string;
  duration: number;
  practiceCount: number;
  submittedAt: Timestamp;
}
