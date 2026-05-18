export type AccountType = 'SuperAdmin' | 'Instructor' | 'Student';

export interface UserPreferences {
  notationSystem?: 'hindustani_bhatkhande' | 'carnatic' | 'paluskar';
  language?: string;
  remindersEnabled?: boolean;
  reminderTime?: string; // "HH:mm" format
  [key: string]: any;
}

export interface User {
  firebaseUid: string;
  emailAddress: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  musicSubStyleTypes: string[];
  preferences?: UserPreferences;
  status?: 'pending' | 'active' | 'inactive';
  instructorIds?: string[];
  joiningDate?: string;
  activeStatus?: boolean;
  [key: string]: any;
}

export interface StudentUser extends User {
  accountType: 'Student';
}

export interface InstructorUser extends User {
  accountType: 'Instructor';
}
