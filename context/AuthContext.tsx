// context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

import { auth, db } from '../utils/FirebaseConfig';
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  update as rtdbUpdate,
  get as rtdbGet,
  remove as rtdbRemove,
} from 'firebase/database';

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */
export type UserRole = 'father' | 'mother' | 'child';

export interface UserData {
  id?: string;
  nombre: string;
  apellido: string;
  correo: string;
  role: UserRole;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<UserData | null>;
  register: (
    email: string,
    password: string,
    userData: UserData
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  updateUserData: (userData: Partial<UserData>) => Promise<void>;
  getUserById: (id: string) => Promise<UserData | null>;
  getUserByEmail: (email: string) => Promise<UserData | null>;
  getUsersByRole: (role: UserRole) => Promise<UserData[]>;
  deleteUser: () => Promise<void>;
}

/* ------------------------------------------------------------------ */

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/* ------------------------------------------------------------------ */
/*  Instancia de Realtime Database                                     */
/* ------------------------------------------------------------------ */
const rtdb = getDatabase();

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------------- listener de sesión ---------------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData({ id: user.uid, ...userDoc.data() } as UserData);
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /* ---------------- register --------------------------- */
  const register = async (
    email: string,
    password: string,
    newUser: UserData
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = cred.user;

    /* Firestore */
    await setDoc(doc(db, 'users', uid), {
      nombre: newUser.nombre,
      apellido: newUser.apellido,
      correo: email,
      role: newUser.role,
    });

    /* RTDB */
    await rtdbSet(rtdbRef(rtdb, `users/${uid}`), {
      nombre: newUser.nombre,
      apellido: newUser.apellido,
      correo: email,
      role: newUser.role,
    });

    setUserData({ id: uid, ...newUser });
  };

  /* ---------------- login ------------------------------ */
  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const { uid } = cred.user;

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = { id: uid, ...userDoc.data() } as UserData;
      setUserData(data);
      return data;
    }
    setUserData(null);
    return null;
  };

  /* ---------------- logout ----------------------------- */
  const logout = async () => {
    await signOut(auth);
    setUserData(null);
  };

  /* ---------------- reset password --------------------- */
  const resetPassword = async (email: string) =>
    sendPasswordResetEmail(auth, email);

  /* ---------------- update user ------------------------ */
  const updateUserData = async (patch: Partial<UserData>) => {
    if (!currentUser || !userData) throw new Error('No user');

    await updateDoc(doc(db, 'users', currentUser.uid), patch);
    await rtdbUpdate(rtdbRef(rtdb, `users/${currentUser.uid}`), patch);

    setUserData({ ...userData, ...patch });
  };

  /* ---------------- get helpers ------------------------ */
  const getUserById = async (id: string) => {
    const docSnap = await getDoc(doc(db, 'users', id));
    return docSnap.exists()
      ? ({ id, ...docSnap.data() } as UserData)
      : null;
  };

  const getUserByEmail = async (email: string) => {
    const q = query(collection(db, 'users'), where('correo', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as UserData;
    }
    return null;
  };

  const getUsersByRole = async (role: UserRole) => {
    const q = query(collection(db, 'users'), where('role', '==', role));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as UserData[];
  };

  /* ---------------- delete user ------------------------ */
  const deleteUser = async () => {
    if (!currentUser) throw new Error('No user');

    await deleteDoc(doc(db, 'users', currentUser.uid));
    await rtdbRemove(rtdbRef(rtdb, `users/${currentUser.uid}`));
    await currentUser.delete();

    setUserData(null);
  };

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateUserData,
    getUserById,
    getUserByEmail,
    getUsersByRole,
    deleteUser,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export default AuthContext;
