/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { GeminiService } from '../../src/services/ai/gemini.service';
import { verificarToken, ErroAutenticacao } from './auth';

/**
 * Handlers compartilhados entre o servidor Express local (server.ts, usado em `npm run dev`)
 * e as Serverless Functions da Vercel (api/ia/*.ts, api/schema-sql.ts) — a lógica de negócio
 * fica em um único lugar; só o roteamento muda entre os dois ambientes.
 */

interface ReqLike {
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

interface ResLike {
  status: (code: number) => ResLike;
  json: (body: any) => void;
  send: (body: any) => void;
  setHeader: (name: string, value: string) => void;
}

async function comAutenticacao(req: ReqLike, res: ResLike, fn: () => Promise<void>) {
  try {
    await verificarToken(req);
  } catch (err) {
    const status = err instanceof ErroAutenticacao ? err.status : 401;
    res.status(status).json({ error: (err as Error).message });
    return;
  }
  await fn();
}

export async function handleExtrairFatura(req: ReqLike, res: ResLike) {
  await comAutenticacao(req, res, async () => {
    try {
      const { texto, imagemBase64, mimeType } = req.body || {};
      const resultado = await GeminiService.extrairItensFatura({ texto, imagemBase64, mimeType });
      res.status(200).json(resultado);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

export async function handleInsights(req: ReqLike, res: ResLike) {
  await comAutenticacao(req, res, async () => {
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
      res.status(200).json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

export async function handleSchemaSql(req: ReqLike, res: ResLike) {
  await comAutenticacao(req, res, async () => {
    try {
      const sqlPath = path.join(process.cwd(), 'src', 'services', 'schema_financepro.sql');
      if (fs.existsSync(sqlPath)) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(fs.readFileSync(sqlPath, 'utf8'));
        return;
      }
      res.status(404).send('-- Schema file not found');
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });
}
