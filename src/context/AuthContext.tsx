import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react';
import {
  getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
  GoogleAuthProvider, OAuthProvider, updateProfile, sendEmailVerification,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { AuthUser } from '../types';
import { initializeFirebase } from '../lib/firebase';
import { useFirebaseConfig } from './FirebaseContext';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(u: FirebaseUser): AuthUser {
  const providerData = u.providerData?.[0];
  const provider = providerData?.providerId
    ? providerData.providerId.replace('.com', '').replace('oauth', 'OAuth')
    : 'password';
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    provider,
  };
}

function formatAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/account-exists-with-different-credential': 'An account already exists with the same email using a different provider.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
  };
  return map[code] || 'An authentication error occurred. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { config, hasConfig } = useFirebaseConfig();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFirebaseAuth = useCallback(() => {
    if (!hasConfig) return null;
    return getAuth(initializeFirebase(config).app);
  }, [hasConfig, config]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? toAuthUser(fbUser) : null);
      setLoading(false);
    });
    return unsub;
  }, [getFirebaseAuth]);

  const clearError = useCallback(() => setError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) { setError('Firebase is not configured.'); return; }
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(formatAuthError(code));
      throw err;
    }
  }, [getFirebaseAuth]);

  const signInWithMicrosoft = useCallback(async () => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) { setError('Firebase is not configured.'); return; }
    try {
      const provider = new OAuthProvider('microsoft.com');
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(formatAuthError(code));
      throw err;
    }
  }, [getFirebaseAuth]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) { setError('Firebase is not configured.'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(formatAuthError(code));
      throw err;
    }
  }, [getFirebaseAuth]);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) { setError('Firebase is not configured.'); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await sendEmailVerification(cred.user);
      setUser(toAuthUser({ ...cred.user, displayName: displayName || cred.user.displayName }));
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(formatAuthError(code));
      throw err;
    }
  }, [getFirebaseAuth]);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) { setError('Firebase is not configured.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(formatAuthError(code));
      throw err;
    }
  }, [getFirebaseAuth]);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
  }, [getFirebaseAuth]);

  return (
    <AuthContext.Provider
      value={{
        user, loading, error, signInWithGoogle, signInWithMicrosoft,
        signInWithEmail, signUpWithEmail, resetPassword, logout, clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
