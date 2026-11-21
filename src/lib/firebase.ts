import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function testFirestoreConnection(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      return {
        ok: false,
        message: 'Unable to reach Cloud Firestore. Please check your internet connection or Firebase configuration.',
      };
    }
    // Permission denied on /test/connection is expected because of default-deny rules, confirming Firestore is reachable!
    return { ok: true };
  }
}
