/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function garantirAppAdmin() {
  if (getApps().length) return;

  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svcJson) {
    // Vercel (sem Application Default Credentials): use uma service account do Firebase
    // (Configurações do Projeto > Contas de Serviço > Gerar nova chave privada), colada
    // como uma variável de ambiente FIREBASE_SERVICE_ACCOUNT (JSON em uma linha só).
    initializeApp({ credential: cert(JSON.parse(svcJson)) });
  } else {
    // Em infraestrutura do Google (Cloud Run/Functions) isso funciona sozinho via ADC.
    initializeApp();
  }
}

export class ErroAutenticacao extends Error {
  status = 401;
}

/**
 * Verifica o Firebase ID token enviado no header `Authorization: Bearer <token>`.
 * Retorna o uid do usuário autenticado ou lança ErroAutenticacao (401).
 */
export async function verificarToken(req: { headers: Record<string, string | string[] | undefined> }): Promise<string> {
  garantirAppAdmin();

  const authHeader = req.headers.authorization;
  const headerStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = headerStr?.startsWith('Bearer ') ? headerStr.slice(7) : null;

  if (!token) {
    throw new ErroAutenticacao('Token de autenticação ausente.');
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new ErroAutenticacao('Token de autenticação inválido ou expirado.');
  }
}
