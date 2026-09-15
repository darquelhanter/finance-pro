/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// Verifica o Firebase ID token diretamente contra a chave pública do Google
// (em vez de usar firebase-admin, cujo pacote transitivo `jwks-rsa` quebra em
// runtimes serverless que rodam CommonJS: ele faz `require()` de uma versão
// ESM-only do pacote `jose`, travando a função inteira com ERR_REQUIRE_ESM).
// Esta verificação não precisa de nenhuma credencial de service account —
// só confere a assinatura, o emissor e a audiência do token.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export class ErroAutenticacao extends Error {
  status = 401;
}

/**
 * Verifica o Firebase ID token enviado no header `Authorization: Bearer <token>`.
 * Retorna o uid do usuário autenticado ou lança ErroAutenticacao (401).
 */
export async function verificarToken(req: { headers: Record<string, string | string[] | undefined> }): Promise<string> {
  const authHeader = req.headers.authorization;
  const headerStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = headerStr?.startsWith('Bearer ') ? headerStr.slice(7) : null;

  if (!token) {
    throw new ErroAutenticacao('Token de autenticação ausente.');
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
      audience: firebaseConfig.projectId,
    });
    if (!payload.sub) throw new Error('Token sem uid.');
    return payload.sub;
  } catch {
    throw new ErroAutenticacao('Token de autenticação inválido ou expirado.');
  }
}
