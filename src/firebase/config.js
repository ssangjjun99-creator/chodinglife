import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDUeBPz6VuMFAV3H7gF-VO9OeZiaxLW07Y",
  authDomain: "chodinglife-af09a.firebaseapp.com",
  projectId: "chodinglife-af09a",
  storageBucket: "chodinglife-af09a.firebasestorage.app",
  messagingSenderId: "1079803403295",
  appId: "1:1079803403295:web:ee63044d3c21dda2ed492a",
  measurementId: "G-BHP33RHQRD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
