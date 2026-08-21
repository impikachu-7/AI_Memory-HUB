import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyBhBE-61d8SavPGE_DETT-Jd-ydo4iiA7M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "ai-memory-hub-a80a0.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "ai-memory-hub-a80a0",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "ai-memory-hub-a80a0.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "76184448679",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:76184448679:web:e32c7accc4c3b827e7f582",
};

export async function signInWithFirebaseGoogle(): Promise<string> {
  if (!Object.values(config).every(Boolean)) {
    throw new Error("Firebase Google login is not configured.");
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  const result = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
  return result.user.getIdToken();
}
