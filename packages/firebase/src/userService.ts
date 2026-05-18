import { doc, getDoc, collection, getDocs, query, where, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { User, StudentUser, InstructorUser, UserPreferences } from '@music-app/types';

export const fetchUserData = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return {
        ...userDoc.data(),
        firebaseUid: userDoc.id
      } as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

export const fetchAllUsers = async (): Promise<User[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const usersData: User[] = [];
    querySnapshot.forEach((doc) => {
      usersData.push({
        ...doc.data(),
        firebaseUid: doc.id
      } as User);
    });
    return usersData;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

export const fetchAllStudents = async (): Promise<Array<StudentUser & { firebaseUid: string }>> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('accountType', '==', 'Student')
    );
    
    const querySnapshot = await getDocs(q);
    const students: Array<StudentUser & { firebaseUid: string }> = [];
    querySnapshot.forEach((doc) => {
      students.push({
        ...doc.data() as StudentUser,
        firebaseUid: doc.id
      });
    });
    
    return students;
  } catch (error) {
    console.error('Error fetching all students:', error);
    throw error;
  }
};

export const fetchAllInstructors = async (): Promise<Array<InstructorUser & { firebaseUid: string }>> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('accountType', '==', 'Instructor')
    );
    
    const querySnapshot = await getDocs(q);
    const instructors: Array<InstructorUser & { firebaseUid: string }> = [];
    querySnapshot.forEach((doc) => {
      instructors.push({
        ...doc.data() as InstructorUser,
        firebaseUid: doc.id
      });
    });
    
    return instructors;
  } catch (error) {
    console.error('Error fetching all instructors:', error);
    throw error;
  }
};

export const updateUserPreferences = async (
  userId: string,
  preferences: Partial<UserPreferences>,
): Promise<void> => {
  const ref = doc(db, 'users', userId);
  
  const updateData: Record<string, any> = {};
  Object.entries(preferences).forEach(([key, value]) => {
    updateData[`preferences.${key}`] = value;
  });
  
  await updateDoc(ref, updateData);
};

export const getUserPreferences = async (
  userId: string,
): Promise<UserPreferences | null> => {
  const userData = await fetchUserData(userId);
  return userData?.preferences || null;
};

// Relation management as per provided logic
export const getInstructorStudents = async (instructorId: string): Promise<Array<StudentUser & { firebaseUid: string }>> => {
    try {
      const q = query(
        collection(db, 'users'),
        where('instructorIds', 'array-contains', instructorId)
      );
      
      const querySnapshot = await getDocs(q);
      const students: Array<StudentUser & { firebaseUid: string }> = [];
      querySnapshot.forEach((doc) => {
        students.push({
          ...doc.data() as StudentUser,
          firebaseUid: doc.id
        });
      });
      
      return students;
    } catch (error) {
      console.error('Error loading instructor students:', error);
      throw error;
    }
};

export const unlinkStudentFromInstructor = async (studentId: string, instructorId: string): Promise<void> => {
    const ref = doc(db, 'users', studentId);
    await updateDoc(ref, {
      instructorIds: arrayRemove(instructorId),
    });
};

export const unhideSystemDefaultItemForUser = async (
  userId: string,
  itemType: 'raag' | 'song' | 'taal' | 'exerciseCollection',
  itemId: string
): Promise<void> => {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, {
    [`hiddenSystemDefaults.${itemType}`]: arrayRemove(itemId),
  });
};
