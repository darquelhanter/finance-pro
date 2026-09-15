/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleHealth, handleExtrairFatura, handleInsights, handleSchemaSql } from './api/_lib/handlers';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --- API ROUTES ---
  // Nota: os dados reais do app (contas, cartões, lançamentos) vivem no Firestore e são
  // acessados diretamente pelo cliente via Firebase SDK (ver src/services/firebase/).
  // As únicas rotas server-side são as que precisam da GEMINI_API_KEY, que fica só aqui
  // no servidor — por isso exigem um usuário autenticado (ver api/_lib/auth.ts) para não
  // virar um proxy gratuito da API do Gemini para qualquer visitante da URL pública.
  // A lógica de cada rota vive em api/_lib/handlers.ts, compartilhada com as Serverless
  // Functions da Vercel (api/ia/*.ts) usadas em produção — este servidor Express roda
  // apenas em desenvolvimento local (`npm run dev`).

  app.get('/api/health', (req, res) => handleHealth(req, res));
  app.post('/api/ia/extrair-fatura', (req, res) => handleExtrairFatura(req, res));
  app.post('/api/ia/insights', (req, res) => handleInsights(req, res));
  app.get('/api/schema-sql', (req, res) => handleSchemaSql(req, res));

  // --- VITE MIDDLEWARE & STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finance Pro Server running on http://localhost:${PORT}`);
  });
}

startServer();
