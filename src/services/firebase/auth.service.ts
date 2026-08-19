/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User,
  NextOrObserver,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase.config';

export async function loginComGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Erro ao realizar login com o Google:', error);
    throw error;
  }
}

export async function logoutUsuario(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (error: any) {
    console.error('Erro ao desconectar usuário:', error);
    throw error;
  }
}

export function observarEstadoAutenticacao(callback: (user: User | null) => void) {
  return fbOnAuthStateChanged(auth, callback);
}
