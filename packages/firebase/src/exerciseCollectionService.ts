import { db } from './firebaseConfig';
import { 
  collection, getDocs, getDoc, doc, query, orderBy, addDoc, updateDoc, deleteDoc, Timestamp 
} from 'firebase/firestore';

export interface ExerciseCollectionData {
  id: string;
  title: string;
  description?: string;
  heroImage?: string;
  exerciseCount?: number;
  isSystemDefault?: boolean;
  createdBy?: string;
  [key: string]: any;
}

export const getAllExerciseCollections = async (userId?: string): Promise<ExerciseCollectionData[]> => {
  try {
    const q = query(collection(db, 'exerciseCollections'), orderBy('title', 'asc'));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ExerciseCollectionData[];

    return items;
  } catch (error) {
    console.error('Error fetching exercise collections:', error);
    return [];
  }
};

export const createExerciseCollection = async (data: any): Promise<string> => {
  const docRef = await addDoc(collection(db, 'exerciseCollections'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getExerciseCollection = async (id: string): Promise<ExerciseCollectionData | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'exerciseCollections', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ExerciseCollectionData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching exercise collection:', error);
    return null;
  }
};

export const updateExerciseCollectionInfo = async (id: string, data: any): Promise<void> => {
  try {
    const docRef = doc(db, 'exerciseCollections', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating exercise collection info:', error);
    throw error;
  }
};

export const updateExerciseCollectionExercises = async (id: string, exercises: any[]): Promise<void> => {
  try {
    const docRef = doc(db, 'exerciseCollections', id);
    await updateDoc(docRef, {
      exercises,
      exerciseCount: exercises.length,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating exercise collection exercises:', error);
    throw error;
  }
};

export const deleteExerciseCollection = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, 'exerciseCollections', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting exercise collection:', error);
    throw error;
  }
};

export type CollectionExerciseItem = {
  id: string;
  title: string;
  description?: string;
  notes?: any[];
  mode?: 'different' | 'anchored';
  media?: any[];
  [key: string]: any;
};

export type CollectionDifficultyLevel = {
  id: string;
  name: string;
  patternType: 'metronome' | 'tabla' | 'none';
  bpmVariants: string[];
  laya: string[];
  raag: string;
  practiceAmountType: 'time' | 'repetitions' | 'none';
  practiceAmountValue: string | string[];
};
