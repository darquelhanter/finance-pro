/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GeminiService } from './src/services/ai/gemini.service';
import { exigirUsuarioAutenticado } from './src/services/firebase/admin.auth';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --- API ROUTES ---
  // Nota: os dados reais do app (contas, cartões, lançamentos) vivem no Firestore e são
  // acessados diretamente pelo cliente via Firebase SDK (ver src/services/firebase/).
  // As únicas rotas server-side são as que precisam da GEMINI_API_KEY, que fica só aqui
  // no servidor — por isso exigem um usuário autenticado para não virar um proxy gratuito
  // da API do Gemini para qualquer visitante da URL pública.

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Finance Pro Engine', time: new Date().toISOString() });
  });

  // IA: Extrair Fatura / Comprovante
  app.post('/api/ia/extrair-fatura', exigirUsuarioAutenticado, async (req, res) => {
    try {
      const { texto, imagemBase64, mimeType } = req.body;
      const resultado = await GeminiService.extrairItensFatura({ texto, imagemBase64, mimeType });
      res.json(resultado);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // IA: Insights Financeiros
  app.post('/api/ia/insights', exigirUsuarioAutenticado, async (req, res) => {
    try {
      const resumo = req.body?.resumo || {};
      const insights = await GeminiService.gerarInsightsFinanceiros({
        receitasTotal: Number(resumo.receitasMes) || 0,
        despesasTotal: Number(resumo.despesasMes) || 0,
        saldoConsolidado: Number(resumo.saldoTotalConsolidado) || 0,
        categoriasGasto: (resumo.despesasPorCategoria || []).map((c: any) => ({
          nome: c.categoriaNome || c.nome || 'Geral',
          valor: Number(c.valor) || 0,
          percentual: Number(c.percentual) || 0,
        })),
      });
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Schema SQL real (referência de estrutura de dados, exibida no modal "Ver Schema SQL")
  app.get('/api/schema-sql', exigirUsuarioAutenticado, (req, res) => {
    try {
      const sqlPath = path.join(process.cwd(), 'src', 'services', 'schema_financepro.sql');
      if (fs.existsSync(sqlPath)) {
        const content = fs.readFileSync(sqlPath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        return res.send(content);
      }
      res.status(404).send('-- Schema file not found');
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

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
