import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDfo5hIRN1bbDsfpfS31qslNCgcJwdGp3Y",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "assignment-ef92d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "assignment-ef92d",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "assignment-ef92d.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "623798158777",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:623798158777:web:e75de713c0613525952268",
};

const app = initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const db = getFirestore(app);
