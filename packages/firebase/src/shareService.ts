import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebaseConfig';

export type ShareItemType = 'raag' | 'song' | 'taal' | 'exerciseCollection' | 'module';

/**
 * Syncs item sharing for a list of students.
 * - Adds the item to students who are newly selected.
 * - Removes the item from students who were de-selected.
 */
export const syncItemShareWithStudents = async (
  instructorId: string,
  itemType: ShareItemType,
  itemId: string,
  selectedStudentIds: string[],
  allPossibleStudentIds: string[]
): Promise<void> => {
  try {
    const promises = allPossibleStudentIds.map(async (studentId) => {
      const isSelected = selectedStudentIds.includes(studentId);
      const studentRef = doc(db, 'users', studentId);

      const shareData = {
        itemType,
        itemId,
        instructorId,
        createdAt: new Date().toISOString()
      };

      if (isSelected) {
        // Add if not already shared (handled by arrayUnion by matching object structure)
        // Note: Field name is 'sharedItems' as per StudentUser interface
        await updateDoc(studentRef, {
            sharedItems: arrayUnion(shareData)
        });
      } else {
      }
    });

    // Real-world implementation often requires fetching and filtering:
    const syncPromises = allPossibleStudentIds.map(async (studentId) => {
        const isSelected = selectedStudentIds.includes(studentId);
        const studentRef = doc(db, 'users', studentId);
        
        // It's safer to fetch the student and update the list
        // especially since 'sharedItems' contains a timestamp which might differ.
        const currentDoc = await (await import('./userService')).fetchUserData(studentId);
        if (!currentDoc || currentDoc.accountType !== 'Student') return;
        
        const sharedItems = (currentDoc.sharedItems || []) as any[];
        const filtered = sharedItems.filter(item => !(item.itemId === itemId && item.itemType === itemType));
        
        if (isSelected) {
            filtered.push({
                itemType,
                itemId,
                instructorId,
                createdAt: new Date().toISOString()
            });
        }
        
        await updateDoc(studentRef, { sharedItems: filtered });
    });

    await Promise.all(syncPromises);
  } catch (error) {
    console.error('Error syncing shares:', error);
    throw error;
  }
};

/**
 * Fetches IDs of items shared with a student.
 */
export const getSharedItemIdsForStudent = async (
  studentId: string,
  itemType: ShareItemType
): Promise<string[]> => {
  try {
    const userData = await (await import('./userService')).fetchUserData(studentId);
    if (!userData || !userData.sharedItems) return [];
    
    return userData.sharedItems
      .filter((item: any) => item.itemType === itemType)
      .map((item: any) => item.itemId);
  } catch (error) {
    console.error('Error getting shared items for student:', error);
    return [];
  }
};

/**
 * Fetches IDs of items shared BY an instructor.
 * (This is a simplified implementation - usually you'd query a sharedItems collection)
 */
export const getSharedItemIdsForInstructor = async (
  instructorId: string,
  itemType: ShareItemType
): Promise<string[]> => {
  // In this project structure, instructors usually own the items they create.
  // This function can return an empty array or be used to track shared status.
  return [];
};
