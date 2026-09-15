/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';

// Em Cloud Run (ambiente de deploy do AI Studio) as credenciais são obtidas
// automaticamente via Application Default Credentials — nada a configurar.
// Rodando localmente (`npm run dev`), rode `gcloud auth application-default login`
// (ou defina GOOGLE_APPLICATION_CREDENTIALS) para as rotas de IA autenticarem.
if (!getApps().length) {
  initializeApp();
}

export interface RequisicaoAutenticada extends Request {
  uid?: string;
}

/**
 * Middleware Express que exige um Firebase ID token válido no header
 * `Authorization: Bearer <token>`. Protege rotas server-side que consomem
 * a cota paga do Gemini contra uso anônimo/abuso de custo.
 */
export async function exigirUsuarioAutenticado(req: RequisicaoAutenticada, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }
}
