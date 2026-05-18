import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  arrayRemove,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { Module, ModuleContentItem } from '@music-app/types';
import type { StudentUser, InstructorUser } from '@music-app/types';

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const createModule = async (
  moduleLabel: string,
  moduleDescription: string,
  contentItems: ModuleContentItem[],
  createdBy: string,
  moduleDifficultyLevel: string = 'basic',
): Promise<string> => {
  const moduleId = uuidv4();
  const moduleRef = doc(db, 'modules', moduleId);

  const moduleData: Module = {
    moduleId,
    moduleLabel,
    moduleDescription,
    moduleDifficultyLevel: moduleDifficultyLevel as any,
    moduleContentItems: contentItems.map((item, idx) => ({ ...item, order: idx })),
    createdBy,
    instructorId: createdBy,
  };

  await setDoc(moduleRef, {
    ...moduleData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return moduleId;
};

export const updateModule = async (
  moduleId: string,
  updates: Partial<Pick<Module, 'moduleLabel' | 'moduleDescription' | 'moduleContentItems' | 'moduleDifficultyLevel'>>,
): Promise<void> => {
  const ref = doc(db, 'modules', moduleId);
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (updates.moduleLabel !== undefined) updateData.moduleLabel = updates.moduleLabel;
  if (updates.moduleDescription !== undefined) updateData.moduleDescription = updates.moduleDescription;
  if (updates.moduleContentItems !== undefined) {
    updateData.moduleContentItems = updates.moduleContentItems.map((item, idx) => ({ ...item, order: idx }));
  }
  if (updates.moduleDifficultyLevel !== undefined) updateData.moduleDifficultyLevel = updates.moduleDifficultyLevel;

  await updateDoc(ref, updateData);
};

export const deleteModule = async (moduleId: string): Promise<void> => {
  const ref = doc(db, 'modules', moduleId);
  await deleteDoc(ref);
};

export const getModulesForInstructor = async (instructorId: string): Promise<Module[]> => {
  try {
    const modulesRef = collection(db, 'modules');
    const q = query(modulesRef, where('createdBy', '==', instructorId));
    const snapshot = await getDocs(q);
    
    const modules = snapshot.docs.map((d) => ({
      moduleId: d.id,
      ...(d.data() as Omit<Module, 'moduleId'>),
    }));

    return modules.sort((a, b) => {
      const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return [];
  }
};

export const getModuleData = async (moduleId: string): Promise<Module | null> => {
    try {
      const snapshot = await getDoc(doc(db, 'modules', moduleId));
      if (snapshot.exists()) {
        return { moduleId: snapshot.id, ...snapshot.data() } as Module;
      }
      return null;
    } catch (error) {
      console.error('Error fetching module data:', error);
      throw error;
    }
};

export const assignModuleToStudent = async (
  studentId: string,
  moduleId: string,
  instructorId: string
): Promise<void> => {
  try {
    const studentDocRef = doc(db, 'users', studentId);
    const studentDoc = await getDoc(studentDocRef);
    
    if (!studentDoc.exists()) throw new Error('Student not found');

    const studentData = studentDoc.data() as StudentUser;
    const assignedModules = studentData.assignedModules || [];
    
    if (!assignedModules.includes(moduleId)) {
      await updateDoc(studentDocRef, {
        assignedModules: [...assignedModules, moduleId]
      });
    }

    const instructorIds = studentData.instructorIds || [];
    if (!instructorIds.includes(instructorId)) {
      await updateDoc(studentDocRef, {
        instructorIds: [...instructorIds, instructorId]
      });
    }

    const instructorDocRef = doc(db, 'users', instructorId);
    const instructorDoc = await getDoc(instructorDocRef);
    
    if (instructorDoc.exists()) {
      const instructorData = instructorDoc.data() as InstructorUser;
      const studentsArray = instructorData.studentsArray || [];
      const studentExists = studentsArray.some(s => s.studentId === studentId);
      
      if (!studentExists) {
        await updateDoc(instructorDocRef, {
          studentsArray: [
            ...studentsArray,
            {
              studentId,
              studentJoiningDate: new Date().toISOString().split('T')[0],
              studentActiveStatus: true
            }
          ]
        });
      }
    }
  } catch (error) {
    console.error('Error assigning module to student:', error);
    throw error;
  }
};

export const getStudentAssignedModules = async (studentId: string): Promise<Module[]> => {
  try {
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    if (!studentDoc.exists()) return [];
    
    const assignedIds = (studentDoc.data() as StudentUser).assignedModules || [];
    if (assignedIds.length === 0) return [];
    
    const modules: Module[] = [];
    for (const id of assignedIds) {
        const modData = await getModuleData(id);
        if (modData) modules.push(modData);
    }
    return modules;
  } catch (error) {
    console.error('Error getting student assigned modules:', error);
    throw error;
  }
};
