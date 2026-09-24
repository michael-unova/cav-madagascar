import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "../../lib/firebase/firestore";
import { getFirebaseApp } from "../../lib/firebase/config";
import { getAuth } from "firebase/auth";

const auth = getAuth(getFirebaseApp());
const firestore = getFirebaseFirestore();

export async function registerUser(
  displayName: string,
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  await updateProfile(credential.user, {
    displayName,
  });

  await setDoc(doc(firestore, "users", credential.user.uid), {
    uid: credential.user.uid,
    displayName,
    email: credential.user.email,
    role: "student",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return credential.user;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);

  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
