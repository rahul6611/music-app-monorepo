import { db } from './firebaseConfig';
import { 
  collection, getDocs, query, orderBy 
} from 'firebase/firestore';

export interface ExerciseData {
  id: string;
  title: string;
  description?: string;
  type?: string;
  [key: string]: any;
}

export const getAllExercises = async (userId?: string): Promise<ExerciseData[]> => {
  try {
    const q = query(collection(db, 'exercises'), orderBy('title', 'asc'));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ExerciseData[];

    return items;
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }
};
