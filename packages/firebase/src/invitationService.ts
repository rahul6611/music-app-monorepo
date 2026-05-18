import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { sendSignInLinkToEmail, isSignInWithEmailLink } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { fetchUserData } from './userService';

export interface StudentInvitation {
  id?: string;
  instructorId: string;
  instructorEmail: string;
  instructorName: string;
  studentEmail: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  instructorMusicSubStyleTypes?: string[];
}

/**
 * Generate a unique invitation token
 */
const generateInvitationToken = (): string => {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Create a student invitation in users collection and send email link
 */
export const createStudentInvitation = async (
  instructorId: string,
  instructorEmail: string,
  instructorName: string,
  studentEmail: string
): Promise<StudentInvitation> => {
  try {
    const normalizedEmail = studentEmail.toLowerCase().trim();
    
    // Check if user already exists
    const existingUsersQuery = query(
      collection(db, 'users'),
      where('emailAddress', '==', normalizedEmail)
    );
    
    const existingUsers = await getDocs(existingUsersQuery);
    if (!existingUsers.empty) {
      const existingUser = existingUsers.docs[0].data();
      if (existingUser.accountType === 'Student' && existingUser.instructorIds?.includes(instructorId)) {
        throw new Error('This student is already linked to you.');
      }
      if (existingUser.status === 'pending' && existingUser.invitationType === 'student') {
        throw new Error('An invitation has already been sent to this email address.');
      }
    }

    const instructorData = await fetchUserData(instructorId);
    const instructorMusicSubStyleTypes = instructorData?.musicSubStyleTypes || [];

    const token = generateInvitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const userRef = doc(db, 'users', tempUserId);
    await setDoc(userRef, {
      emailAddress: normalizedEmail,
      firstName: 'Invited',
      lastName: 'Student',
      accountType: 'Student',
      musicSubStyleTypes: [],
      status: 'pending',
      invitationType: 'student',
      instructorId: instructorId,
      instructorEmail: instructorEmail,
      instructorName: instructorName,
      instructorMusicSubStyleTypes: instructorMusicSubStyleTypes,
      invitationToken: token,
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt),
      isTemporary: true,
    });

    // Note: Email link settings are omitted for Web compatibility in React Native
    // But we still return the invitation object for the UI
    const invitation: StudentInvitation = {
      id: tempUserId,
      instructorId,
      instructorEmail,
      instructorName,
      studentEmail: normalizedEmail,
      token,
      status: 'pending',
      createdAt: now,
      expiresAt,
      instructorMusicSubStyleTypes: instructorMusicSubStyleTypes,
    };

    return invitation;
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw error;
  }
};

/**
 * Get all invitations for an instructor from users collection
 */
export const getInstructorInvitations = async (instructorId: string): Promise<StudentInvitation[]> => {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('instructorId', '==', instructorId),
      where('invitationType', '==', 'student')
    );
    
    const querySnapshot = await getDocs(usersQuery);
    const invitations: StudentInvitation[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      invitations.push({
        id: doc.id,
        instructorId: data.instructorId,
        instructorEmail: data.instructorEmail,
        instructorName: data.instructorName,
        studentEmail: data.emailAddress,
        token: data.invitationToken,
        status: data.status,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt),
        acceptedAt: data.acceptedAt?.toDate ? data.acceptedAt.toDate() : (data.acceptedAt ? new Date(data.acceptedAt) : undefined),
        instructorMusicSubStyleTypes: data.instructorMusicSubStyleTypes || [],
      });
    });

    return invitations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error getting instructor invitations:', error);
    throw error;
  }
};

/**
 * Delete an invitation (delete temporary user document)
 */
export const deleteInvitation = async (invitationId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'users', invitationId));
  } catch (error) {
    console.error('Error deleting invitation:', error);
    throw error;
  }
};
