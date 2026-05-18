import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  deleteDoc, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { ClassAssignment, AssignmentItem, AssignmentSubmission } from '@music-app/types';

export const createClassAssignment = async (
  studentId: string,
  instructorId: string,
  classDate: string,
  partMinutes: number[],
  assignments: any[]
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'classAssignments'), {
    studentId,
    instructorId,
    classDate,
    partMinutes,
    assignments,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateClassAssignment = async (
  id: string,
  data: Partial<ClassAssignment>
): Promise<void> => {
  const ref = doc(db, 'classAssignments', id);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const getClassAssignmentsByStudent = async (
  studentId: string,
  instructorId?: string
): Promise<ClassAssignment[]> => {
  let q = query(
    collection(db, 'classAssignments'),
    where('studentId', '==', studentId)
  );

  if (instructorId) {
    q = query(q, where('instructorId', '==', instructorId));
  }

  const querySnapshot = await getDocs(q);
  const assignments: ClassAssignment[] = [];
  querySnapshot.forEach((doc) => {
    assignments.push({ id: doc.id, ...doc.data() } as ClassAssignment);
  });
  return assignments;
};

export const addAssignmentToClass = async (
  classAssignmentId: string,
  assignment: Omit<AssignmentItem, 'id'>
): Promise<void> => {
  const ref = doc(db, 'classAssignments', classAssignmentId);
  const id = `a_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await updateDoc(ref, {
    assignments: arrayUnion({ ...assignment, id })
  });
};

export const removeAssignmentsFromClass = async (
  classAssignmentId: string,
  assignmentIds: string[]
): Promise<void> => {
  const ref = doc(db, 'classAssignments', classAssignmentId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  
  const currentAssignments = snapshot.data().assignments || [];
  const nextAssignments = currentAssignments.filter((a: any) => !assignmentIds.includes(a.id));
  
  await updateDoc(ref, {
    assignments: nextAssignments
  });
};

export const deleteClassAssignment = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'classAssignments', id));
};

export const updateClassAssignmentPartMinutes = async (
  id: string,
  partMinutes: number[]
): Promise<void> => {
  const ref = doc(db, 'classAssignments', id);
  await updateDoc(ref, { partMinutes });
};

export const updateClassAssignmentDate = async (
  id: string,
  classDate: string
): Promise<void> => {
  const ref = doc(db, 'classAssignments', id);
  await updateDoc(ref, { classDate });
};

export const duplicatePracticePlan = async (
  sourceId: string,
  studentId: string,
  instructorId: string,
  newDate: string
): Promise<string> => {
  const sourceRef = doc(db, 'classAssignments', sourceId);
  const sourceSnap = await getDoc(sourceRef);
  if (!sourceSnap.exists()) throw new Error('Source plan not found');
  
  const sourceData = sourceSnap.data();
  const { id: _, createdAt: __, ...dataToCopy } = sourceData;
  
  const docRef = await addDoc(collection(db, 'classAssignments'), {
    ...dataToCopy,
    studentId,
    instructorId,
    classDate: newDate,
    createdAt: serverTimestamp(),
  });
  
  return docRef.id;
};

export const createAssignmentSubmission = async (
  assignmentId: string,
  classAssignmentId: string,
  studentId: string,
  instructorId: string,
  mediaUrl: string,
  mediaType: 'video' | 'audio',
  fileName: string,
  duration: number,
  practiceCount: number
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'assignmentSubmissions'), {
    assignmentId,
    classAssignmentId,
    studentId,
    instructorId,
    mediaUrl,
    mediaType,
    fileName,
    duration,
    practiceCount,
    submittedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getSubmissionsByStudent = async (
  studentId: string,
  instructorId?: string
): Promise<AssignmentSubmission[]> => {
  let q = query(
    collection(db, 'assignmentSubmissions'),
    where('studentId', '==', studentId)
  );

  if (instructorId) {
    q = query(q, where('instructorId', '==', instructorId));
  }

  const querySnapshot = await getDocs(q);
  const submissions: AssignmentSubmission[] = [];
  querySnapshot.forEach((doc) => {
    submissions.push({ id: doc.id, ...doc.data() } as AssignmentSubmission);
  });
  submissions.sort((a, b) => {
    const timeA = a.submittedAt?.toMillis?.() || 0;
    const timeB = b.submittedAt?.toMillis?.() || 0;
    return timeB - timeA;
  });

  return submissions;
};
