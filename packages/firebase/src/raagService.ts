import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  getDocs,
  orderBy,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  collectionGroup,
  limit,
  where,
  documentId
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// UUID fallback
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export interface RaagDetailTableRow {
  feature: string;
  detail: string;
  notes: string;
}

// Default detail table structure for new raags
export const DEFAULT_RAAG_DETAIL_TABLE: RaagDetailTableRow[] = [
  { feature: "Jati", detail: "", notes: "" },
  { feature: "Arohan / Avrohan", detail: "", notes: "" },
  { feature: "Pakad", detail: "", notes: "" },
  { feature: "Vadi / Samvadi", detail: "", notes: "" },
  { feature: "Nyas", detail: "", notes: "" },
  { feature: "Varjit", detail: "", notes: "" },
  { feature: "Saptak", detail: "", notes: "" },
  { feature: "Poorvang / Uttarang", detail: "", notes: "" },
  { feature: "Thaat", detail: "", notes: "" },
  { feature: "Bhav / Ras", detail: "", notes: "" },
  { feature: "Samay", detail: "", notes: "" },
  { feature: "Nearby Raag", detail: "", notes: "" },
  { feature: "Raagang / Chalan", detail: "", notes: "" },
  { feature: "Additional Notes", detail: "", notes: "" },
];

// Default detail table structure for new songs
export const DEFAULT_SONG_DETAIL_TABLE: RaagDetailTableRow[] = [
  { feature: "Film Name", detail: "", notes: "" },
  { feature: "Composer", detail: "", notes: "" },
  { feature: "Singer", detail: "", notes: "" },
  { feature: "Year", detail: "", notes: "" },
  { feature: "Additional Notes", detail: "", notes: "" },
];

// Default detail table structure for new taals
export const DEFAULT_TAAL_DETAIL_TABLE: RaagDetailTableRow[] = [
  { feature: "Matra", detail: "", notes: "" },
  { feature: "Vibhag", detail: "", notes: "" },
  { feature: "Tali", detail: "", notes: "" },
  { feature: "Khali", detail: "", notes: "" },
  { feature: "Theka", detail: "", notes: "" },
  { feature: "Additional Notes", detail: "", notes: "" },
];

// Default detail table structure for new compositions
export const DEFAULT_COMPOSITION_DETAIL_TABLE: RaagDetailTableRow[] = [
  { feature: "Composer", detail: "", notes: "" },
  { feature: "Arranger", detail: "", notes: "" },
  { feature: "Key", detail: "", notes: "" },
  { feature: "Tempo", detail: "", notes: "" },
  { feature: "Time Signature", detail: "", notes: "" },
  { feature: "Additional Notes", detail: "", notes: "" },
];

export interface RaagUploadItem {
  id?: string;
  type: 'audio' | 'video' | 'image' | 'youtube' | 'pdf';
  url: string;
  title?: string;
  notes: string;
  youtubeId?: string;
  fileName?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  fileSize?: number;
  uploadedAt?: any;
}

export interface RaagNotationEntry {
  id?: string;
  notationData: any;
  createdAt?: any;
}

export interface GatBandishEntry {
  id?: string;
  type: string;
  name: string;
  taal?: string;
  laya?: string;
  prasang?: string;
  audioUrl?: string;
  audioFileName?: string;
  createdAt?: any;
}

export type GatBandishMediaType = 'audio' | 'video' | 'youtube' | 'image' | 'pdf';

export interface GatBandishMediaItem {
  id?: string;
  type: GatBandishMediaType;
  url: string;
  youtubeId?: string;
  fileName?: string;
  title?: string;
  notes?: string;
  createdAt?: any;
  uploadedBy?: string;
  uploadedByName?: string;
  fileSize?: number;
  uploadedAt?: any;
}

export interface RaagData {
  id: string;
  name: string;
  description?: string;
  heroImage?: string;
  detailTable?: RaagDetailTableRow[];
  uploads?: RaagUploadItem[];
  notationEntries?: RaagNotationEntry[];
  gatBandishEntries?: GatBandishEntry[];
  musicSubStyleTypes?: string[];
  isSystemDefault?: boolean;
  createdBy?: string;
  sourceRaagId?: string;
  mainNotationId?: string;
}

// Get music item data from Firebase (raags or songs)
export const getRaagData = async (raagId: string, collectionName: string = 'raags'): Promise<RaagData | null> => {
  try {
    const raagDocRef = doc(db, collectionName, raagId);
    const raagDoc = await getDoc(raagDocRef);

    if (!raagDoc.exists()) {
      return null;
    }

    return {
      id: raagDoc.id,
      ...raagDoc.data()
    } as RaagData;
  } catch (error) {
    console.error(`Error getting data from ${collectionName}:`, error);
    throw error;
  }
};

// Save or update music item detail table
export const saveRaagDetailTable = async (raagId: string, tableRows: RaagDetailTableRow[], collectionName: string = 'raags'): Promise<void> => {
  try {
    const raagDocRef = doc(db, collectionName, raagId);
    const raagDoc = await getDoc(raagDocRef);

    if (raagDoc.exists()) {
      await updateDoc(raagDocRef, {
        detailTable: tableRows,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(raagDocRef, {
        id: raagId,
        detailTable: tableRows,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error(`Error saving detail table in ${collectionName}:`, error);
    throw error;
  }
};

// Initialize music item data
export const initializeRaagData = async (raagData: RaagData, collectionName: string = 'raags'): Promise<void> => {
  try {
    const raagDocRef = doc(db, collectionName, raagData.id);
    const raagDoc = await getDoc(raagDocRef);

    if (!raagDoc.exists()) {
      await setDoc(raagDocRef, {
        ...raagData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error(`Error initializing data in ${collectionName}:`, error);
    throw error;
  }
};

export const createRaag = async (
  name: string,
  description?: string,
  heroImage?: string,
  extra?: Partial<Pick<RaagData, 'musicSubStyleTypes' | 'isSystemDefault' | 'createdBy'>>,
  collectionName: string = 'raags'
): Promise<string> => {
  try {
    const raagId = generateUUID();
    const raagDocRef = doc(db, collectionName, raagId);

    const raagData: RaagData = {
      id: raagId,
      name: name,
      description: description || '',
      heroImage: heroImage || '',
      detailTable: collectionName === 'songs'
        ? DEFAULT_SONG_DETAIL_TABLE
        : collectionName === 'taals'
          ? DEFAULT_TAAL_DETAIL_TABLE
          : collectionName === 'compositions'
            ? DEFAULT_COMPOSITION_DETAIL_TABLE
            : DEFAULT_RAAG_DETAIL_TABLE,
      uploads: [],
      notationEntries: [],
      ...(extra?.musicSubStyleTypes ? { musicSubStyleTypes: extra.musicSubStyleTypes } : {}),
      ...(extra?.isSystemDefault !== undefined ? { isSystemDefault: extra.isSystemDefault } : {}),
      ...(extra?.createdBy ? { createdBy: extra.createdBy } : {}),
    };

    await setDoc(raagDocRef, {
      ...raagData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return raagId;
  } catch (error) {
    console.error(`Error creating item in ${collectionName}:`, error);
    throw error;
  }
};

// Update music item info
export const updateRaagInfo = async (
  raagId: string,
  name?: string,
  heroImage?: string,
  description?: string,
  collectionName: string = 'raags'
): Promise<void> => {
  try {
    const raagDocRef = doc(db, collectionName, raagId);
    const updateData: any = {
      updatedAt: serverTimestamp()
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (heroImage !== undefined) {
      updateData.heroImage = heroImage;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    await updateDoc(raagDocRef, updateData);
  } catch (error) {
    console.error(`Error updating info in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get all items (Raags, Songs, Taals, etc.) from a specific collection
 */
export const getAllRaags = async (collectionName: string = 'raags', userId?: string): Promise<RaagData[]> => {
  try {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as RaagData[];

    return items;
  } catch (error) {
    console.error(`Error getting items from ${collectionName}:`, error);
    throw error;
  }
};

export const duplicateRaag = async (sourceRaagId: string, newOwnerUserId: string, collectionName: string = 'raags'): Promise<string> => {
  const sourceRef = doc(db, collectionName, sourceRaagId);
  const sourceSnap = await getDoc(sourceRef);
  if (!sourceSnap.exists()) {
    throw new Error(`Source ${collectionName.slice(0, -1)} does not exist`);
  }

  const source = { id: sourceSnap.id, ...(sourceSnap.data() as any) } as RaagData & Record<string, any>;
  const newRaagId = generateUUID();
  const targetRef = doc(db, collectionName, newRaagId);

  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    isSystemDefault: _isSystemDefault,
    createdBy: _createdBy,
    id: _id,
    ...rest
  } = source;

  await setDoc(targetRef, {
    ...rest,
    id: newRaagId,
    name: source.name ? `${source.name} (Copy)` : 'Item (Copy)',
    isSystemDefault: false,
    createdBy: newOwnerUserId,
    sourceRaagId: sourceRaagId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });


  const copySubcollection = async (sub: 'uploads' | 'notations' | 'gatBandish') => {
    const fromColRef = collection(db, collectionName, sourceRaagId, sub);
    const toColRef = collection(db, collectionName, newRaagId, sub);
    const snap = await getDocs(fromColRef);
    await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        await setDoc(doc(toColRef, d.id), {
          ...data,
          updatedAt: serverTimestamp(),
          ...(data.createdAt ? {} : { createdAt: serverTimestamp() }),
        });
      }),
    );
  };

  await copySubcollection('uploads');
  await copySubcollection('notations');
  await copySubcollection('gatBandish');

  return newRaagId;
};

// Update a single cell in detail table
export const updateDetailTableCell = async (
  raagId: string,
  rowIndex: number,
  field: 'detail' | 'notes',
  value: string,
  collectionName: string = 'raags'
): Promise<void> => {
  try {
    const raagDocRef = doc(db, collectionName, raagId);
    const raagDoc = await getDoc(raagDocRef);

    if (!raagDoc.exists()) {
      throw new Error('Raag document does not exist');
    }

    const data = raagDoc.data();
    const detailTable = data.detailTable || [];

    if (rowIndex >= 0 && rowIndex < detailTable.length) {
      detailTable[rowIndex][field] = value;

      await updateDoc(raagDocRef, {
        detailTable: detailTable,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating detail table cell:', error);
    throw error;
  }
};

// Add upload item
export const addRaagUpload = async (raagId: string, upload: RaagUploadItem, collectionName: string = 'raags'): Promise<string> => {
  try {
    const uploadsCollectionRef = collection(db, collectionName, raagId, 'uploads');
    // Remove undefined fields before saving
    const cleanedUpload = removeUndefinedFields(upload);
    const docRef = await addDoc(uploadsCollectionRef, {
      ...cleanedUpload,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding raag upload:', error);
    throw error;
  }
};

// Get uploads for a raag
export const getRaagUploads = async (raagId: string, collectionName: string = 'raags'): Promise<RaagUploadItem[]> => {
  try {
    const uploadsCollectionRef = collection(db, collectionName, raagId, 'uploads');
    const q = query(uploadsCollectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as RaagUploadItem[];
  } catch (error) {
    console.error('Error getting raag uploads:', error);
    throw error;
  }
};

// Helper function to remove undefined fields
const removeUndefinedFields = (obj: any): any => {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};

// Get or create notation document UUID for a raag
export const getOrCreateNotationDocId = async (raagId: string, collectionName: string = 'raags'): Promise<string> => {
  try {
    const raagDocRef = doc(db, collectionName, raagId);
    const raagDoc = await getDoc(raagDocRef);

    if (raagDoc.exists()) {
      const raagData = raagDoc.data();
      if (raagData.mainNotationId) {
        return raagData.mainNotationId;
      }

      const oldMainDocRef = doc(db, collectionName, raagId, 'notations', 'main');
      const oldMainDoc = await getDoc(oldMainDocRef);

      if (oldMainDoc.exists()) {
        const newNotationId = generateUUID();
        const newNotationDocRef = doc(db, collectionName, raagId, 'notations', newNotationId);

        const oldData = oldMainDoc.data();
        await setDoc(newNotationDocRef, {
          ...oldData,
          updatedAt: serverTimestamp()
        });

        await deleteDoc(oldMainDocRef);

        await updateDoc(raagDocRef, {
          mainNotationId: newNotationId,
          updatedAt: serverTimestamp()
        });

        return newNotationId;
      }
    }

    const newNotationId = generateUUID();

    if (raagDoc.exists()) {
      await updateDoc(raagDocRef, {
        mainNotationId: newNotationId,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(raagDocRef, {
        id: raagId,
        mainNotationId: newNotationId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    return newNotationId;
  } catch (error) {
    console.error('Error getting or creating notation doc ID:', error);
    return generateUUID();
  }
};

// Add notation entry
export const addRaagNotation = async (
  raagId: string,
  notationData: any,
  options?: { notationDocId?: string; collectionName?: string }
): Promise<string> => {
  try {
    const collectionName = options?.collectionName || 'raags';
    const notationDocId = options?.notationDocId || (await getOrCreateNotationDocId(raagId, collectionName));
    const notationDocRef = doc(db, collectionName, raagId, 'notations', notationDocId);
    const notationDoc = await getDoc(notationDocRef);

    let processedNotationData = { ...notationData };
    if (processedNotationData.notationRows && Array.isArray(processedNotationData.notationRows)) {
      processedNotationData.notationRows = [...processedNotationData.notationRows]
        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0))
        .map((row: any, idx: number) => ({
          ...row,
          index: idx
        }));
    }

    if (notationDoc.exists()) {
      const existingData = notationDoc.data().notationData;
      const newRows = processedNotationData.notationRows || [];
      const existingRows = existingData?.notationRows || [];

      const mergedRows = [...existingRows, ...newRows].map((row: any, idx: number) => ({
        ...row,
        index: idx
      }));

      const mergedSectionLabels = {
        ...existingData.sectionLabels,
        ...processedNotationData.sectionLabels
      };

      const { notation, ...dataWithoutNotation } = processedNotationData;

      await updateDoc(notationDocRef, {
        notationData: {
          ...existingData,
          ...dataWithoutNotation,
          sectionLabels: mergedSectionLabels,
          notationRows: mergedRows
        },
        updatedAt: serverTimestamp()
      });

      return notationDocId;
    } else {
      const { notation, ...dataWithoutNotation } = processedNotationData;

      await setDoc(notationDocRef, {
        notationData: dataWithoutNotation,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return notationDocId;
    }
  } catch (error) {
    console.error('Error adding raag notation:', error);
    throw error;
  }
};

// Helper function to reconstruct notation from notationRows array
const reconstructNotationFromRows = (notationData: any): any => {
  if (!notationData) return notationData;

  if (notationData.notationRows && Array.isArray(notationData.notationRows) && notationData.notationRows.length > 0) {
    const notationRows = notationData.notationRows;
    const sortedRows = [...notationRows].sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

    const reconstructedNotation: Record<string, any> = {};
    const reconstructedSectionLabels: Record<string, string> = {};

    sortedRows.forEach((row: any) => {
      if (row.entries && Array.isArray(row.entries) && row.entries.length > 0) {
        row.entries.forEach((entry: any) => {
          const phraseId = entry.phraseId || row.phraseId || 'default';
          const beat = entry.absoluteBeat !== undefined ? entry.absoluteBeat : (entry.beat || 0);
          const key = `${phraseId}-${beat}`;
          reconstructedNotation[key] = {
            ...entry,
            phraseId: entry.phraseId || phraseId
          };

          if (row.sectionLabel && row.phraseId) {
            reconstructedSectionLabels[row.phraseId] = row.sectionLabel;
          }
        });
      }
    });

    if (Object.keys(reconstructedNotation).length > 0) {
      const { notation, ...dataWithoutNotation } = notationData;

      return {
        ...dataWithoutNotation,
        sectionLabels: {
          ...notationData.sectionLabels,
          ...reconstructedSectionLabels
        }
      };
    }
  }

  return notationData;
};

// Get notation entries for a raag
export const getRaagNotations = async (raagId: string, collectionName: string = 'raags'): Promise<RaagNotationEntry[]> => {
  try {
    const notationCollectionRef = collection(db, collectionName, raagId, 'notations');
    const q = query(notationCollectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const reconstructedData = reconstructNotationFromRows(data.notationData);

      return {
        id: doc.id,
        ...data,
        notationData: reconstructedData
      };
    }) as RaagNotationEntry[];
  } catch (error) {
    console.error('Error getting raag notations:', error);
    throw error;
  }
};

export const getGatBandishEntries = async (raagId: string, collectionName: string = 'raags'): Promise<GatBandishEntry[]> => {
  try {
    const q = query(collection(db, collectionName, raagId, 'gatBandish'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as GatBandishEntry));
  } catch (error) {
    console.error(`Error getting gat/bandish entries from ${collectionName}:`, error);
    throw error;
  }
};

export const addGatBandishEntry = async (raagId: string, entry: GatBandishEntry, collectionName: string = 'raags'): Promise<string> => {
  try {
    const colRef = collection(db, collectionName, raagId, 'gatBandish');
    const docRef = await addDoc(colRef, {
      ...entry,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding gat/bandish entry:', error);
    throw error;
  }
};

export const updateGatBandishEntry = async (raagId: string, entryId: string, entry: Partial<GatBandishEntry>, collectionName: string = 'raags'): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, raagId, 'gatBandish', entryId);
    await updateDoc(docRef, {
      ...entry,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating gat/bandish entry:', error);
    throw error;
  }
};

export const deleteGatBandishEntry = async (raagId: string, entryId: string, collectionName: string = 'raags'): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, raagId, 'gatBandish', entryId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting gat/bandish entry:', error);
    throw error;
  }
};

export const getRaagNotationById = async (
  raagId: string, 
  notationId: string, 
  collectionName: string = 'raags'
): Promise<RaagNotationEntry | null> => {
  try {
    const docRef = doc(db, collectionName, raagId, 'notations', notationId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const reconstructedData = reconstructNotationFromRows(data.notationData);
      return { 
        id: docSnap.id, 
        ...data,
        notationData: reconstructedData 
      } as RaagNotationEntry;
    }
    return null;
  } catch (error) {
    console.error('Error getting raag notation by ID:', error);
    return null;
  }
};

export const getNotationByCompositionEntryId = async (
  compositionId: string, 
  raagId?: string, 
  collectionName: string = 'raags'
): Promise<any | null> => {
  try {
    // 1. Try direct path first if raagId is provided (Faster and no collectionGroup required)
    if (raagId) {
      const docId = `gatBandish_${compositionId}`;
      const docRef = doc(db, collectionName, raagId, 'notations', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const notationData = data.notationData || {};
        const reconstructedData = reconstructNotationFromRows(notationData);
        return { 
          id: docSnap.id, 
          notationEntry: {
            ...data,
            notationData: {
              ...notationData,
              ...reconstructedData,
              // Ensure we keep the original notation field if it exists
              notation: reconstructedData.notation || notationData.notation
            }
          } 
        };
      }
      
      // Try subcollection query if direct ID fails
      const subColRef = collection(db, collectionName, raagId, 'notations');
      const subQuery = query(subColRef, where('compositionId', '==', compositionId), limit(1));
      const subSnap = await getDocs(subQuery);
      
      if (!subSnap.empty) {
        const d = subSnap.docs[0];
        const data = d.data();
        const notationData = data.notationData || {};
        const reconstructedData = reconstructNotationFromRows(notationData);
        return { 
          id: d.id, 
          notationEntry: {
            ...data,
            notationData: {
              ...notationData,
              ...reconstructedData,
              notation: reconstructedData.notation || notationData.notation
            }
          } 
        };
      }
    }

    // 2. Global fallback to collectionGroup (Requires collectionGroup rules and indexes)
    const q = query(collectionGroup(db, 'notations'), where('compositionId', '==', compositionId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data();
      const notationData = data.notationData || {};
      const reconstructedData = reconstructNotationFromRows(notationData);
      return { 
        id: doc.id, 
        notationEntry: {
          ...data,
          notationData: {
            ...notationData,
            ...reconstructedData,
            notation: reconstructedData.notation || notationData.notation
          }
        } 
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting notation by composition ID:', error);
    return null;
  }
};

export const deleteRaag = async (raagId: string, collectionName: string = 'raags'): Promise<void> => {
    try {
        await deleteDoc(doc(db, collectionName, raagId));
    } catch (error) {
        console.error(`Error deleting ${raagId} from ${collectionName}:`, error);
        throw error;
    }
};

import { parseSocialVideo, SocialVideoType } from '@music-app/utils';

export const extractYouTubeId = (url: string): string | undefined => {
  const parsed = parseSocialVideo(url);
  return (parsed && parsed.type === 'youtube') ? parsed.id : undefined;
};

export const getSocialMediaInfo = (url: string) => {
  return parseSocialVideo(url);
};
