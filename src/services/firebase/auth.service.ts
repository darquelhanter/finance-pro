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

/**
 * Retorna o ID token do usuário logado, usado para autenticar chamadas às
 * rotas server-side que consomem a API do Gemini (ver api/_lib/auth.ts).
 */
export async function obterTokenAtual(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * `fetch` com o Firebase ID token do usuário logado anexado ao header
 * Authorization — usado nas chamadas às rotas server-side protegidas
 * (/api/ia/*, /api/schema-sql, ver api/_lib/auth.ts).
 */
export async function fetchAutenticado(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await obterTokenAtual();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
