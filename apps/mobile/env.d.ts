/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be in your .gitignore
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_FIREBASE_API_KEY: string;
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: string;
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
    EXPO_PUBLIC_FIREBASE_APP_ID: string;
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: string;
    EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: string;
    EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: string;
    EXPO_PUBLIC_JITSI_SERVER_URL?: string;
    /** 480 | 720 | 1080 — max send/receive video height (default 720) */
    EXPO_PUBLIC_JITSI_VIDEO_QUALITY?: string;
    /** Set to "true" for music lessons (less aggressive noise suppression) */
    EXPO_PUBLIC_JITSI_DISABLE_NOISE_SUPPRESSION?: string;
    /** Public web app URL used in community share links */
    EXPO_PUBLIC_WEB_APP_URL?: string;
    EXPO_PUBLIC_FACEBOOK_APP_ID?: string;
    EXPO_PUBLIC_GOOGLE_CLIENT_ID?: string;
  }
}
