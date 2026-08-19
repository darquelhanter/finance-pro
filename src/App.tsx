/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { LancamentosView } from './components/LancamentosView';
import { ContasCartoesView } from './components/ContasCartoesView';
import { ImportacaoFaturaView } from './components/ImportacaoFaturaView';
import { OrcamentosView } from './components/OrcamentosView';
import { IaInsightsView } from './components/IaInsightsView';
import { NovoLancamentoModal } from './components/NovoLancamentoModal';
import { SqlSchemaModal } from './components/SqlSchemaModal';
import { 
  Conta, 
  CartaoCredito, 
  Categoria, 
  Lancamento, 
  FaturaCartao,
  ImportacaoFaturaItem 
} from './types';
import {
  subscribeContas,
  subscribeCartoes,
  subscribeCategorias,
  subscribeLancamentos,
  subscribeFaturas,
  salvarLancamento,
  excluirLancamento,
  salvarConta,
  salvarCartao,
  salvarCategoria,
  salvarFatura,
  registrarAuditLog,
  calcularResumoFinanceiro,
} from './services/firebase/firestore.service';
import { Loader2 } from 'lucide-react';

export function App() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Realtime Data State from Firestore
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [faturas, setFaturas] = useState<FaturaCartao[]>([]);
  const [dataReady, setDataReady] = useState(false);

  // Modal States
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalSqlAberto, setModalSqlAberto] = useState(false);

  // Real-time Firestore subscriptions for authenticated user
  useEffect(() => {
    if (!user) {
      setContas([]);
      setCartoes([]);
      setCategorias([]);
      setLancamentos([]);
      setFaturas([]);
      setDataReady(false);
      return;
    }

    let unsubContas: () => void;
    let unsubCartoes: () => void;
    let unsubCategorias: () => void;
    let unsubLancamentos: () => void;
    let unsubFaturas: () => void;

    try {
      unsubContas = subscribeContas(user.uid, (data) => setContas(data || []));
      unsubCartoes = subscribeCartoes(user.uid, (data) => setCartoes(data || []));
      unsubCategorias = subscribeCategorias(user.uid, (data) => setCategorias(data || []));
      unsubLancamentos = subscribeLancamentos(user.uid, (data) => setLancamentos(data || []));
      unsubFaturas = subscribeFaturas(user.uid, (data) => {
        setFaturas(data || []);
        setDataReady(true);
      });
    } catch (err) {
      console.error('Erro ao conectar listeners do Firestore:', err);
      setDataReady(true);
    }

    return () => {
      if (unsubContas) unsubContas();
      if (unsubCartoes) unsubCartoes();
      if (unsubCategorias) unsubCategorias();
      if (unsubLancamentos) unsubLancamentos();
      if (unsubFaturas) unsubFaturas();
    };
  }, [user]);

  // Dynamically calculate dashboard summary from real-time Firestore collections
  const resumo = useMemo(() => {
    return calcularResumoFinanceiro(contas, cartoes, categorias, lancamentos, faturas);
  }, [contas, cartoes, categorias, lancamentos, faturas]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-xs tracking-wider uppercase font-semibold text-slate-300">Conectando ao Firebase...</p>
      </div>
    );
  }

  // Unauthenticated: Show Mobile-Ready Google Login View
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  // ----------------------------------------------------
  // MUTATION HANDLERS (ISOLATED TO LOGGED-IN USER)
  // ----------------------------------------------------

  const handlePagarLancamento = async (id: string) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    const dataPagamento = new Date().toISOString().split('T')[0];
    const atualizado: Lancamento = {
      ...lanc,
      status: 'pago',
      dataPagamento,
    };

    // If account was linked, adjust balance
    if (lanc.contaId) {
      const conta = contas.find(c => c.id === lanc.contaId);
      if (conta) {
        const delta = lanc.tipo === 'receita' ? lanc.valor : -lanc.valor;
        await salvarConta(user.uid, {
          ...conta,
          saldoAtual: Number(conta.saldoAtual) + delta,
        });
      }
    }

    await salvarLancamento(user.uid, atualizado);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'pagamento',
      detalhes: `Lançamento "${lanc.descricao}" de ${lanc.valor} marcado como pago`,
    });

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#10b981', '#14b8a6', '#06b6d4'],
    });
  };

  const handleCancelarLancamento = async (id: string) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    // If it was already paid from account, revert balance
    if (lanc.status === 'pago' && lanc.contaId) {
      const conta = contas.find(c => c.id === lanc.contaId);
      if (conta) {
        const delta = lanc.tipo === 'receita' ? -lanc.valor : lanc.valor;
        await salvarConta(user.uid, {
          ...conta,
          saldoAtual: Number(conta.saldoAtual) + delta,
        });
      }
    }

    await salvarLancamento(user.uid, { ...lanc, status: 'cancelado' });
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'cancelamento',
      detalhes: `Lançamento "${lanc.descricao}" cancelado`,
    });
  };

  const handleExcluirLancamento = async (id: string) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    await excluirLancamento(user.uid, id);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'exclusao',
      detalhes: `Lançamento "${lanc.descricao}" excluído`,
    });
  };

  const handleCriarSimples = async (dto: any) => {
    if (!user) return;
    const novoId = `lanc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const novo: Lancamento = {
      id: novoId,
      tipo: dto.tipo,
      descricao: dto.descricao,
      valor: Number(dto.valor),
      categoriaId: dto.categoriaId,
      contaId: dto.contaId || undefined,
      cartaoId: dto.cartaoId || undefined,
      faturaId: dto.faturaId || undefined,
      dataCompetencia: dto.dataCompetencia || new Date().toISOString().split('T')[0],
      dataVencimento: dto.dataVencimento || new Date().toISOString().split('T')[0],
      dataPagamento: dto.status === 'pago' ? (dto.dataPagamento || new Date().toISOString().split('T')[0]) : undefined,
      status: dto.status || 'pendente',
      observacoes: dto.observacoes,
      tags: dto.tags || [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // If paid immediately with an account, update account balance
    if (novo.status === 'pago' && novo.contaId) {
      const conta = contas.find(c => c.id === novo.contaId);
      if (conta) {
        const delta = novo.tipo === 'receita' ? novo.valor : -novo.valor;
        await salvarConta(user.uid, {
          ...conta,
          saldoAtual: Number(conta.saldoAtual) + delta,
        });
      }
    }

    await salvarLancamento(user.uid, novo);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Criado lançamento simples: ${novo.descricao} (R$ ${novo.valor})`,
    });
  };

  const handleCriarParcelado = async (dto: any) => {
    if (!user) return;
    const totalParcelas = Number(dto.totalParcelas) || 1;
    const valorTotal = Number(dto.valorTotal);
    const valorParcela = Number((valorTotal / totalParcelas).toFixed(2));
    const paiId = `lanc_parc_${Date.now()}`;
    const dataInicial = new Date(dto.primeiroVencimento || new Date());

    for (let i = 1; i <= totalParcelas; i++) {
      const dataVenc = new Date(dataInicial);
      dataVenc.setMonth(dataVenc.getMonth() + (i - 1));
      const vencStr = dataVenc.toISOString().split('T')[0];

      const parcelaId = `${paiId}_${i}`;
      const lanc: Lancamento = {
        id: parcelaId,
        tipo: 'despesa',
        descricao: `${dto.descricao} (${i}/${totalParcelas})`,
        valor: valorParcela,
        categoriaId: dto.categoriaId,
        cartaoId: dto.cartaoId || undefined,
        contaId: dto.contaId || undefined,
        dataCompetencia: dto.primeiroVencimento || new Date().toISOString().split('T')[0],
        dataVencimento: vencStr,
        status: 'pendente',
        parcela: {
          numero: i,
          total: totalParcelas,
          lancamentoPaiId: paiId,
        },
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLancamento(user.uid, lanc);
    }

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: paiId,
      acao: 'criacao',
      detalhes: `Criada compra parcelada: ${dto.descricao} em ${totalParcelas}x de R$ ${valorParcela}`,
    });
  };

  const handleCriarRecorrente = async (dto: any) => {
    if (!user) return;
    const novoId = `lanc_rec_${Date.now()}`;
    const lanc: Lancamento = {
      id: novoId,
      tipo: dto.tipo,
      descricao: dto.descricao,
      valor: Number(dto.valor),
      categoriaId: dto.categoriaId,
      contaId: dto.contaId || undefined,
      cartaoId: dto.cartaoId || undefined,
      dataCompetencia: new Date().toISOString().split('T')[0],
      dataVencimento: new Date().toISOString().split('T')[0],
      status: 'pendente',
      recorrencia: {
        frequencia: dto.recorrencia?.frequencia || 'mensal',
        diaVencimento: Number(dto.recorrencia?.diaVencimento) || 5,
        ajustaFimMes: true,
      },
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    await salvarLancamento(user.uid, lanc);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Criado lançamento recorrente: ${lanc.descricao}`,
    });
  };

  const handleCriarConta = async (contaDto: any) => {
    if (!user) return;
    const novoId = `conta_${Date.now()}`;
    const saldo = Number(contaDto.saldoInicial) || 0;
    const novaConta: Conta = {
      id: novoId,
      nome: contaDto.nome || 'Nova Conta',
      instituicao: contaDto.instituicao || 'Banco',
      tipo: contaDto.tipo || 'corrente',
      saldoInicial: saldo,
      saldoAtual: saldo,
      cor: contaDto.cor || '#10b981',
      icone: contaDto.icone || 'wallet',
      ativa: true,
      criadaEm: new Date().toISOString(),
    };
    await salvarConta(user.uid, novaConta);
    await registrarAuditLog(user.uid, {
      entidade: 'conta',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Conta criada: ${novaConta.nome}`,
    });
  };

  const handleCriarCartao = async (cartaoDto: any) => {
    if (!user) return;
    const novoId = `cartao_${Date.now()}`;
    const limite = Number(cartaoDto.limiteTotal) || 5000;
    const novoCartao: CartaoCredito = {
      id: novoId,
      nome: cartaoDto.nome || 'Novo Cartão',
      bandeira: cartaoDto.bandeira || 'mastercard',
      limiteTotal: limite,
      limiteDisponivel: limite,
      diaFechamento: Number(cartaoDto.diaFechamento) || 25,
      diaVencimento: Number(cartaoDto.diaVencimento) || 5,
      contaDebitoPadraoId: cartaoDto.contaDebitoPadraoId,
      cor: cartaoDto.cor || '#8b5cf6',
      ultimosDigitos: cartaoDto.ultimosDigitos || '0000',
      ativo: true,
    };
    await salvarCartao(user.uid, novoCartao);
    await registrarAuditLog(user.uid, {
      entidade: 'cartao',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Cartão de crédito criado: ${novoCartao.nome}`,
    });
  };

  const handleUpdateOrcamento = async (catId: string, novoValor: number) => {
    if (!user) return;
    const cat = categorias.find(c => c.id === catId);
    if (!cat) return;
    const catAtualizada = { ...cat, orcamentoMensal: Number(novoValor) || 0 };
    await salvarCategoria(user.uid, catAtualizada);
  };

  const handleImportarLote = async (cartaoId: string, faturaId: string, itens: ImportacaoFaturaItem[]) => {
    if (!user) return;
    for (const item of itens) {
      if (!item.selecionado) continue;
      const novoId = `lanc_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const lanc: Lancamento = {
        id: novoId,
        tipo: 'despesa',
        descricao: item.descricao,
        valor: Number(item.valor),
        categoriaId: item.categoriaSugeridaId || (categorias[0]?.id || 'cat_outros'),
        cartaoId,
        faturaId: faturaId || 'fat_atual',
        dataCompetencia: item.data || new Date().toISOString().split('T')[0],
        dataVencimento: item.data || new Date().toISOString().split('T')[0],
        status: 'pendente',
        observacoes: 'Importado automaticamente via Leitor Inteligente Gemini IA',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLancamento(user.uid, lanc);
    }

    confetti({
      particleCount: 60,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNovoLancamento={() => setModalNovoAberto(true)}
        onOpenSqlModal={() => setModalSqlAberto(true)}
        saldoConsolidado={resumo?.saldoTotalConsolidado ?? 0}
      />

      {/* Main Content Area (with bottom padding for smartphone thumb nav) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
        {!dataReady ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Sincronizando seu banco de dados privado...</span>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                resumo={resumo}
                contas={contas}
                cartoes={cartoes}
                onPagarLancamento={handlePagarLancamento}
                onNovoLancamento={() => setModalNovoAberto(true)}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'lancamentos' && (
              <LancamentosView
                lancamentos={lancamentos}
                contas={contas}
                cartoes={cartoes}
                categorias={categorias}
                onNovoLancamento={() => setModalNovoAberto(true)}
                onPagar={handlePagarLancamento}
                onCancelar={handleCancelarLancamento}
                onExcluir={handleExcluirLancamento}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'contas_cartoes' && (
              <ContasCartoesView
                contas={contas}
                cartoes={cartoes}
                onCriarConta={handleCriarConta}
                onCriarCartao={handleCriarCartao}
              />
            )}

            {currentTab === 'importacao_ia' && (
              <ImportacaoFaturaView
                cartoes={cartoes}
                categorias={categorias}
                onImportarLote={handleImportarLote}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'orcamentos' && (
              <OrcamentosView
                categorias={categorias}
                resumo={resumo}
                onUpdateOrcamento={handleUpdateOrcamento}
              />
            )}

            {currentTab === 'insights' && (
              <IaInsightsView resumo={resumo} />
            )}
          </>
        )}
      </main>

      {/* Smartphone Bottom Navigation Bar */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNovoLancamento={() => setModalNovoAberto(true)}
      />

      {/* Desktop/Tablet Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Finance Pro • Banco de dados individual criptografado por usuário
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Firebase Auth + Cloud Firestore
          </span>
        </div>
      </footer>

      {/* Modals */}
      <NovoLancamentoModal
        isOpen={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        contas={contas}
        cartoes={cartoes}
        categorias={categorias}
        onCriarSimples={handleCriarSimples}
        onCriarParcelado={handleCriarParcelado}
        onCriarRecorrente={handleCriarRecorrente}
      />

      <SqlSchemaModal
        isOpen={modalSqlAberto}
        onClose={() => setModalSqlAberto(false)}
      />

    </div>
  );
}

export default App;
