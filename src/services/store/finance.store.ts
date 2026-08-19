/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Conta, 
  CartaoCredito, 
  FaturaCartao, 
  Categoria, 
  Lancamento, 
  DashboardResumo,
  ImportacaoFaturaItem,
  AuditLog
} from '../../types';
import { SaldoService } from '../domain/saldo.service';
import { LancamentoService, CriarLancamentoDTO, CriarParceladoDTO, CriarRecorrenteDTO } from '../domain/lancamento.service';

const INITIAL_CONTAS: Conta[] = [
  {
    id: 'conta_principal',
    nome: 'Conta Principal',
    instituicao: 'Banco Principal',
    tipo: 'corrente',
    saldoInicial: 0,
    saldoAtual: 0,
    cor: '#10b981',
    icone: 'landmark',
    ativa: true,
    criadaEm: new Date().toISOString(),
  },
  {
    id: 'conta_carteira',
    nome: 'Carteira / Dinheiro',
    instituicao: 'Caixa',
    tipo: 'dinheiro',
    saldoInicial: 0,
    saldoAtual: 0,
    cor: '#0ea5e9',
    icone: 'wallet',
    ativa: true,
    criadaEm: new Date().toISOString(),
  }
];

const INITIAL_CARTOES: CartaoCredito[] = [
  {
    id: 'cartao_principal',
    nome: 'Cartão de Crédito Principal',
    bandeira: 'mastercard',
    limiteTotal: 5000.00,
    limiteDisponivel: 5000.00,
    diaFechamento: 25,
    diaVencimento: 5,
    contaDebitoPadraoId: 'conta_principal',
    cor: '#8b5cf6',
    ultimosDigitos: '0000',
    ativo: true,
  }
];

const INITIAL_CATEGORIAS: Categoria[] = [
  // Despesas
  { id: 'cat_alimentacao', nome: 'Alimentação & Mercado', tipo: 'despesa', cor: '#ef4444', icone: 'utensils', orcamentoMensal: 0 },
  { id: 'cat_moradia', nome: 'Moradia & Aluguel', tipo: 'despesa', cor: '#f97316', icone: 'home', orcamentoMensal: 0 },
  { id: 'cat_transporte', nome: 'Transporte & Combustível', tipo: 'despesa', cor: '#eab308', icone: 'car', orcamentoMensal: 0 },
  { id: 'cat_servicos', nome: 'Software & Assinaturas', tipo: 'despesa', cor: '#8b5cf6', icone: 'laptop', orcamentoMensal: 0 },
  { id: 'cat_saude', nome: 'Saúde & Farmácia', tipo: 'despesa', cor: '#ec4899', icone: 'heart-pulse', orcamentoMensal: 0 },
  { id: 'cat_lazer', nome: 'Lazer & Viagens', tipo: 'despesa', cor: '#06b6d4', icone: 'plane', orcamentoMensal: 0 },
  { id: 'cat_educacao', nome: 'Educação & Cursos', tipo: 'despesa', cor: '#3b82f6', icone: 'graduation-cap', orcamentoMensal: 0 },
  { id: 'cat_outras_despesas', nome: 'Outras Despesas', tipo: 'despesa', cor: '#64748b', icone: 'minus-circle', orcamentoMensal: 0 },
  
  // Receitas
  { id: 'cat_salario', nome: 'Salário & Honorários', tipo: 'receita', cor: '#10b981', icone: 'badge-dollar-sign' },
  { id: 'cat_prestacao_servicos', nome: 'Contratos PJ & Freelance', tipo: 'receita', cor: '#14b8a6', icone: 'briefcase' },
  { id: 'cat_rendimentos', nome: 'Rendimentos & Investimentos', tipo: 'receita', cor: '#059669', icone: 'trending-up' },
  { id: 'cat_outras_receitas', nome: 'Outras Receitas', tipo: 'receita', cor: '#84cc16', icone: 'plus-circle' }
];

const INITIAL_FATURAS: FaturaCartao[] = [];

const INITIAL_LANCAMENTOS: Lancamento[] = [];

export class FinanceStore {
  private static instance: FinanceStore;
  
  public contas: Conta[] = [...INITIAL_CONTAS];
  public cartoes: CartaoCredito[] = [...INITIAL_CARTOES];
  public categorias: Categoria[] = [...INITIAL_CATEGORIAS];
  public faturas: FaturaCartao[] = [...INITIAL_FATURAS];
  public lancamentos: Lancamento[] = [...INITIAL_LANCAMENTOS];
  public auditLogs: AuditLog[] = [];

  private constructor() {
    this.recalcularTotais();
  }

  public static getInstance(): FinanceStore {
    if (!FinanceStore.instance) {
      FinanceStore.instance = new FinanceStore();
    }
    return FinanceStore.instance;
  }

  public limparDados(): void {
    this.lancamentos = [];
    this.faturas = [];
    this.contas.forEach(c => {
      c.saldoAtual = c.saldoInicial || 0;
    });
    this.cartoes.forEach(car => {
      car.limiteDisponivel = car.limiteTotal;
    });
    this.auditLogs = [];
    this.recalcularTotais();
  }

  public getDashboardResumo(): DashboardResumo {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    const saldoTotalConsolidado = this.contas
      .filter(c => c.ativa)
      .reduce((acc, c) => acc + (c.saldoAtual || 0), 0);

    let receitasMes = 0;
    let despesasMes = 0;
    const categoriaMap: Record<string, { nome: string; cor: string; valor: number }> = {};

    this.lancamentos.forEach(l => {
      const partes = (l.dataCompetencia || '').split('-');
      const ano = Number(partes[0]);
      const mes = Number(partes[1]);

      if (ano === anoAtual && mes === mesAtual && l.status !== 'cancelado') {
        const val = Number(l.valor) || 0;
        if (l.tipo === 'receita') {
          receitasMes += val;
        } else if (l.tipo === 'despesa') {
          despesasMes += val;
          const cat = this.categorias.find(c => c.id === l.categoriaId);
          const catNome = cat ? cat.nome : 'Outros';
          const catCor = cat ? cat.cor : '#64748b';

          if (!categoriaMap[l.categoriaId]) {
            categoriaMap[l.categoriaId] = { nome: catNome, cor: catCor, valor: 0 };
          }
          categoriaMap[l.categoriaId].valor += val;
        }
      }
    });

    const despesasPorCategoria = Object.entries(categoriaMap).map(([categoriaId, dados]) => ({
      categoriaId,
      categoriaNome: dados.nome,
      cor: dados.cor,
      valor: dados.valor,
      percentual: despesasMes > 0 ? Math.round((dados.valor / despesasMes) * 100) : 0
    })).sort((a, b) => b.valor - a.valor);

    const faturasAbertasTotal = this.faturas
      .filter(f => f.status === 'aberta' || f.status === 'fechada')
      .reduce((acc, f) => acc + Number(f.valorTotal || 0), 0);

    const lancamentosPendentesCount = this.lancamentos.filter(l => l.status === 'pendente').length;

    // Próximos vencimentos pendentes
    const proximosVencimentos = [...this.lancamentos]
      .filter(l => l.status === 'pendente')
      .sort((a, b) => (a.dataVencimento || '').localeCompare(b.dataVencimento || ''))
      .slice(0, 5);

    // Fluxo Mensal real
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fluxoMensal = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - 1 - i, 1);
      const m = d.getMonth() + 1;
      const a = d.getFullYear();
      const nomeMes = mesesNomes[d.getMonth()];

      let rMes = 0;
      let dMes = 0;

      this.lancamentos.forEach(l => {
        const p = (l.dataCompetencia || '').split('-');
        if (Number(p[0]) === a && Number(p[1]) === m && l.status !== 'cancelado') {
          const v = Number(l.valor) || 0;
          if (l.tipo === 'receita') rMes += v;
          if (l.tipo === 'despesa') dMes += v;
        }
      });

      fluxoMensal.push({
        mes: nomeMes,
        receitas: rMes,
        despesas: dMes,
      });
    }

    return {
      saldoTotalConsolidado,
      receitasMes,
      despesasMes,
      saldoPrevistoMes: saldoTotalConsolidado + (receitasMes - despesasMes),
      saldoPrevistoFinalMes: saldoTotalConsolidado + (receitasMes - despesasMes),
      faturasAbertasTotal,
      lancamentosPendentesCount,
      despesasPorCategoria,
      fluxoMensal,
      proximosVencimentos
    };
  }

  public criarLancamentoSimples(dto: CriarLancamentoDTO): Lancamento {
    const agora = new Date().toISOString();
    const id = `lanc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const novo: Lancamento = {
      id,
      tipo: dto.tipo,
      descricao: dto.descricao,
      valor: Number(dto.valor),
      categoriaId: dto.categoriaId,
      contaId: dto.contaId,
      cartaoId: dto.cartaoId,
      faturaId: dto.faturaId,
      contaDestinoId: dto.contaDestinoId,
      dataCompetencia: dto.dataCompetencia,
      dataVencimento: dto.dataVencimento,
      dataPagamento: dto.status === 'pago' ? (dto.dataPagamento || dto.dataVencimento) : undefined,
      status: dto.status || 'pendente',
      observacoes: dto.observacoes,
      tags: dto.tags,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    this.lancamentos.unshift(novo);

    // Se já foi criado como pago e tem conta vinculada, atualiza o saldo
    if (novo.status === 'pago' && novo.contaId) {
      const conta = this.contas.find(c => c.id === novo.contaId);
      if (conta) {
        conta.saldoAtual = SaldoService.aplicarEfeitoLancamento(conta, novo);
      }
    }

    this.logAuditoria('lancamento', novo.id, 'criacao', `Lançamento simples criado: ${novo.descricao} (R$ ${novo.valor.toFixed(2)})`);
    this.recalcularTotais();
    return novo;
  }

  public criarLancamentosParcelados(dto: CriarParceladoDTO): Lancamento[] {
    const novos = LancamentoService.gerarLancamentosParcelados(dto);
    this.lancamentos.unshift(...novos);

    // Se 1ª parcela foi paga, atualiza conta
    const p1 = novos[0];
    if (p1 && p1.status === 'pago' && p1.contaId) {
      const conta = this.contas.find(c => c.id === p1.contaId);
      if (conta) {
        conta.saldoAtual = SaldoService.aplicarEfeitoLancamento(conta, p1);
      }
    }

    this.logAuditoria('lancamento', novos[0].id, 'criacao', `Compra parcelada em ${novos.length}x criada: ${dto.descricao}`);
    this.recalcularTotais();
    return novos;
  }

  public criarLancamentoRecorrente(dto: CriarRecorrenteDTO): Lancamento {
    const novo = LancamentoService.gerarLancamentoRecorrente(dto);
    this.lancamentos.unshift(novo);

    if (novo.status === 'pago' && novo.contaId) {
      const conta = this.contas.find(c => c.id === novo.contaId);
      if (conta) {
        conta.saldoAtual = SaldoService.aplicarEfeitoLancamento(conta, novo);
      }
    }

    this.logAuditoria('lancamento', novo.id, 'criacao', `Lançamento recorrente criado (${dto.recorrencia.frequencia}): ${novo.descricao}`);
    this.recalcularTotais();
    return novo;
  }

  public marcarComoPago(id: string, dataPagamento?: string): Lancamento | null {
    const index = this.lancamentos.findIndex(l => l.id === id);
    if (index === -1) return null;

    const lanc = this.lancamentos[index];
    if (lanc.status === 'pago') return lanc;

    lanc.status = 'pago';
    lanc.dataPagamento = dataPagamento || new Date().toISOString().split('T')[0];
    lanc.atualizadoEm = new Date().toISOString();

    // Atualiza o saldo da conta associada
    if (lanc.contaId) {
      const conta = this.contas.find(c => c.id === lanc.contaId);
      if (conta) {
        conta.saldoAtual = SaldoService.aplicarEfeitoLancamento(conta, lanc);
      }
    }

    this.logAuditoria('lancamento', lanc.id, 'pagamento', `Marcado como pago: ${lanc.descricao} (R$ ${lanc.valor.toFixed(2)})`);
    this.recalcularTotais();
    return lanc;
  }

  public cancelarLancamento(id: string): Lancamento | null {
    const index = this.lancamentos.findIndex(l => l.id === id);
    if (index === -1) return null;

    const lanc = this.lancamentos[index];
    const estavaPago = lanc.status === 'pago';

    lanc.status = 'cancelado';
    lanc.atualizadoEm = new Date().toISOString();

    // Se estava pago, reverte efeito no saldo
    if (estavaPago && lanc.contaId) {
      const conta = this.contas.find(c => c.id === lanc.contaId);
      if (conta) {
        conta.saldoAtual = SaldoService.reverterEfeitoLancamento(conta, lanc);
      }
    }

    this.logAuditoria('lancamento', lanc.id, 'cancelamento', `Lançamento cancelado e saldo revertido: ${lanc.descricao}`);
    this.recalcularTotais();
    return lanc;
  }

  public excluirLancamento(id: string): boolean {
    const index = this.lancamentos.findIndex(l => l.id === id);
    if (index === -1) return false;

    const lanc = this.lancamentos[index];
    if (lanc.status === 'pago' && lanc.contaId) {
      const conta = this.contas.find(c => c.id === lanc.contaId);
      if (conta) {
        conta.saldoAtual = SaldoService.reverterEfeitoLancamento(conta, lanc);
      }
    }

    this.lancamentos.splice(index, 1);
    this.logAuditoria('lancamento', id, 'exclusao', `Lançamento excluído: ${lanc.descricao}`);
    this.recalcularTotais();
    return true;
  }

  public importarItensFatura(cartaoId: string, faturaId: string, itens: ImportacaoFaturaItem[]): Lancamento[] {
    const criados: Lancamento[] = [];
    const agora = new Date().toISOString();

    itens.filter(i => i.selecionado).forEach(item => {
      const lanc: Lancamento = {
        id: `lanc_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tipo: 'despesa',
        descricao: item.descricao,
        valor: item.valor,
        categoriaId: item.categoriaSugeridaId || 'cat_alimentacao',
        cartaoId,
        faturaId,
        dataCompetencia: item.data,
        dataVencimento: item.data,
        status: 'pendente',
        tags: ['importado-ia'],
        criadoEm: agora,
        atualizadoEm: agora,
      };

      if (item.parcelaAtual && item.totalParcelas) {
        lanc.parcela = {
          numero: item.parcelaAtual,
          total: item.totalParcelas,
          lancamentoPaiId: `fatura_imp_${item.id}`
        };
      }

      this.lancamentos.unshift(lanc);
      criados.push(lanc);
    });

    this.logAuditoria('fatura', faturaId, 'atualizacao', `${criados.length} itens importados via IA para o cartão`);
    this.recalcularTotais();
    return criados;
  }

  private recalcularTotais() {
    // Atualiza valores das faturas somando os lançamentos vinculados a cada uma
    this.faturas.forEach(fat => {
      const soma = this.lancamentos
        .filter(l => l.faturaId === fat.id && l.status !== 'cancelado')
        .reduce((acc, l) => acc + l.valor, 0);
      fat.valorTotal = Math.round(soma * 100) / 100;
      fat.itensCount = this.lancamentos.filter(l => l.faturaId === fat.id).length;
    });

    // Atualiza limites disponíveis dos cartões
    this.cartoes.forEach(cartao => {
      const totalGasto = this.lancamentos
        .filter(l => l.cartaoId === cartao.id && l.status === 'pendente')
        .reduce((acc, l) => acc + l.valor, 0);
      cartao.limiteDisponivel = Math.max(0, cartao.limiteTotal - totalGasto);
    });
  }

  private logAuditoria(entidade: AuditLog['entidade'], entidadeId: string, acao: AuditLog['acao'], detalhes: string) {
    this.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      entidade,
      entidadeId,
      acao,
      detalhes,
      dataHora: new Date().toISOString()
    });
    if (this.auditLogs.length > 50) this.auditLogs.pop();
  }
}
