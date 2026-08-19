/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { FinanceStore } from './src/services/store/finance.store';
import { GeminiService } from './src/services/ai/gemini.service';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const store = FinanceStore.getInstance();

  app.use(express.json({ limit: '15mb' }));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Finance Pro Engine', time: new Date().toISOString() });
  });

  // Dashboard Resumo
  app.get('/api/dashboard/resumo', (req, res) => {
    try {
      const resumo = store.getDashboardResumo();
      res.json(resumo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Contas
  app.get('/api/contas', (req, res) => {
    res.json(store.contas);
  });

  app.post('/api/contas', (req, res) => {
    const { nome, instituicao, tipo, saldoInicial, cor, icone } = req.body;
    const novaConta = {
      id: `conta_${Date.now()}`,
      nome: nome || 'Nova Conta',
      instituicao: instituicao || 'Banco',
      tipo: tipo || 'corrente',
      saldoInicial: Number(saldoInicial) || 0,
      saldoAtual: Number(saldoInicial) || 0,
      cor: cor || '#10b981',
      icone: icone || 'wallet',
      ativa: true,
      criadaEm: new Date().toISOString(),
    };
    store.contas.push(novaConta);
    res.status(201).json(novaConta);
  });

  // Cartões de Crédito
  app.get('/api/cartoes', (req, res) => {
    res.json(store.cartoes);
  });

  app.post('/api/cartoes', (req, res) => {
    const { nome, bandeira, limiteTotal, diaFechamento, diaVencimento, cor, ultimosDigitos, contaDebitoPadraoId } = req.body;
    const novoCartao = {
      id: `cartao_${Date.now()}`,
      nome: nome || 'Novo Cartão',
      bandeira: bandeira || 'mastercard',
      limiteTotal: Number(limiteTotal) || 5000,
      limiteDisponivel: Number(limiteTotal) || 5000,
      diaFechamento: Number(diaFechamento) || 25,
      diaVencimento: Number(diaVencimento) || 5,
      contaDebitoPadraoId,
      cor: cor || '#8b5cf6',
      ultimosDigitos: ultimosDigitos || '0000',
      ativo: true,
    };
    store.cartoes.push(novoCartao);
    res.status(201).json(novoCartao);
  });

  // Categorias
  app.get('/api/categorias', (req, res) => {
    res.json(store.categorias);
  });

  app.put('/api/categorias/:id/orcamento', (req, res) => {
    const { id } = req.params;
    const { orcamentoMensal } = req.body;
    const cat = store.categorias.find(c => c.id === id);
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    cat.orcamentoMensal = Number(orcamentoMensal) || undefined;
    res.json(cat);
  });

  // Faturas
  app.get('/api/faturas', (req, res) => {
    res.json(store.faturas);
  });

  // Lançamentos
  app.get('/api/lancamentos', (req, res) => {
    const { tipo, status, categoriaId, contaId, cartaoId, search } = req.query;
    let list = [...store.lancamentos];

    if (tipo) list = list.filter(l => l.tipo === tipo);
    if (status) list = list.filter(l => l.status === status);
    if (categoriaId) list = list.filter(l => l.categoriaId === categoriaId);
    if (contaId) list = list.filter(l => l.contaId === contaId);
    if (cartaoId) list = list.filter(l => l.cartaoId === cartaoId);
    if (search && typeof search === 'string') {
      const termo = search.toLowerCase();
      list = list.filter(l => l.descricao.toLowerCase().includes(termo) || (l.observacoes && l.observacoes.toLowerCase().includes(termo)));
    }

    res.json(list);
  });

  // Criar Lançamento Simples
  app.post('/api/lancamentos/simples', (req, res) => {
    try {
      const lanc = store.criarLancamentoSimples(req.body);
      res.status(201).json(lanc);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Criar Lançamentos Parcelados
  app.post('/api/lancamentos/parcelado', (req, res) => {
    try {
      const parcelas = store.criarLancamentosParcelados(req.body);
      res.status(201).json(parcelas);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Criar Lançamento Recorrente
  app.post('/api/lancamentos/recorrente', (req, res) => {
    try {
      const lanc = store.criarLancamentoRecorrente(req.body);
      res.status(201).json(lanc);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Marcar como pago / recebido
  app.post('/api/lancamentos/:id/pagar', (req, res) => {
    const { id } = req.params;
    const { dataPagamento } = req.body;
    const atualizado = store.marcarComoPago(id, dataPagamento);
    if (!atualizado) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json(atualizado);
  });

  // Cancelar lançamento
  app.post('/api/lancamentos/:id/cancelar', (req, res) => {
    const { id } = req.params;
    const cancelado = store.cancelarLancamento(id);
    if (!cancelado) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json(cancelado);
  });

  // Excluir lançamento
  app.delete('/api/lancamentos/:id', (req, res) => {
    const { id } = req.params;
    const ok = store.excluirLancamento(id);
    if (!ok) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json({ success: true });
  });

  // IA: Extrair Fatura / Comprovante
  app.post('/api/ia/extrair-fatura', async (req, res) => {
    try {
      const { texto, imagemBase64, mimeType } = req.body;
      const resultado = await GeminiService.extrairItensFatura({ texto, imagemBase64, mimeType });
      res.json(resultado);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // IA: Importar Itens de Fatura
  app.post('/api/ia/importar-fatura', (req, res) => {
    try {
      const { cartaoId, faturaId, itens } = req.body;
      if (!cartaoId || !itens || !Array.isArray(itens)) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }
      const importados = store.importarItensFatura(cartaoId, faturaId || 'fat_nubank_atual', itens);
      res.json({ success: true, count: importados.length, lancamentos: importados });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // IA: Insights Financeiros
  app.post('/api/ia/insights', async (req, res) => {
    try {
      const resumoBody = req.body?.resumo;
      const resumo = resumoBody || store.getDashboardResumo();
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

  // Schema SQL real
  app.get('/api/schema-sql', (req, res) => {
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

  // Audit logs
  app.get('/api/audit-logs', (req, res) => {
    res.json(store.auditLogs);
  });

  // Limpar dados de teste
  app.post('/api/limpar-dados', (req, res) => {
    store.limparDados();
    res.json({ success: true, message: 'Dados de teste limpos com sucesso.' });
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
