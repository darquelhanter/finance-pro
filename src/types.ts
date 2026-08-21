/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TipoConta = 'corrente' | 'poupanca' | 'investimento' | 'carteira_digital' | 'dinheiro';

export type TipoLancamento = 'receita' | 'despesa' | 'transferencia';

export type StatusLancamento = 'pendente' | 'pago' | 'cancelado';

export type FrequenciaRecorrencia = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export interface Conta {
  id: string;
  userId?: string;
  nome: string;
  instituicao: string;
  tipo: TipoConta;
  saldoInicial: number;
  saldoAtual: number;
  cor: string;
  icone?: string;
  ativa: boolean;
  criadaEm: string;
}

export interface CartaoCredito {
  id: string;
  userId?: string;
  nome: string;
  bandeira: 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outro';
  limiteTotal: number;
  limiteDisponivel: number;
  diaFechamento: number;
  diaVencimento: number;
  contaDebitoPadraoId?: string;
  cor: string;
  ultimosDigitos: string;
  ativo: boolean;
}

export interface FaturaCartao {
  id: string;
  userId?: string;
  cartaoId: string;
  mesReferencia: number; // 1-12
  anoReferencia: number;
  dataFechamento: string;
  dataVencimento: string;
  valorTotal: string | number;
  status: 'aberta' | 'fechada' | 'paga' | 'atrasada';
  itensCount?: number;
}

export interface Categoria {
  id: string;
  userId?: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  icone: string;
  orcamentoMensal?: number;
  descricao?: string;
}

export interface RecorrenciaConfig {
  frequencia: FrequenciaRecorrencia;
  diaVencimento: number;
  ajustaFimMes: boolean;
  totalOcorrencias?: number; // undefined = infinito
  ocorrenciaAtual?: number;
  dataFim?: string;
}

export interface ParcelaInfo {
  numero: number;
  total: number;
  lancamentoPaiId: string;
}

export interface Lancamento {
  id: string;
  userId?: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  valorOriginal?: number;
  valorPago?: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  categoriaId: string;
  contaId?: string;
  cartaoId?: string;
  faturaId?: string;
  contaDestinoId?: string; // para transferências
  dataCompetencia: string; // YYYY-MM-DD
  dataVencimento: string; // YYYY-MM-DD
  dataPagamento?: string; // YYYY-MM-DD se pago
  status: StatusLancamento;
  observacoes?: string;
  tags?: string[];
  apenasVisualizacao?: boolean; // Se true, é item informativo de fatura/extrato e não duplica despesa financeira da fatura
  parcela?: ParcelaInfo;
  recorrencia?: RecorrenciaConfig;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosPagamento {
  lancamentoId: string;
  dataPagamento: string;
  contaId?: string;
  valorOriginal: number;
  valorPago: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  entidade: 'lancamento' | 'conta' | 'cartao' | 'fatura' | 'categoria';
  entidadeId: string;
  acao: 'criacao' | 'atualizacao' | 'exclusao' | 'pagamento' | 'cancelamento';
  detalhes: string;
  dataHora: string;
}

export interface ImportacaoFaturaItem {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  categoriaSugeridaId?: string;
  categoriaSugeridaNome?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  selecionado: boolean;
}

export interface ExtracaoFaturaResponse {
  tipoDocumento?: 'fatura_cartao' | 'boleto_cobranca' | 'comprovante_pix' | string;
  emissor?: string;
  titular?: string;
  mesReferencia?: string;
  dataVencimento?: string;
  valorTotal?: number;
  itens: ImportacaoFaturaItem[];
  confiancaIa: number;
  observacoesIa?: string;
}

export interface DashboardResumo {
  saldoTotalConsolidado: number;
  receitasMes: number;
  despesasMes: number;
  saldoPrevistoMes: number;
  saldoPrevistoFinalMes?: number;
  faturasAbertasTotal: number;
  lancamentosPendentesCount: number;
  despesasPorCategoria: {
    categoriaId: string;
    categoriaNome: string;
    cor: string;
    valor: number;
    percentual: number;
  }[];
  fluxoMensal: {
    mes: string;
    receitas: number;
    despesas: number;
  }[];
  proximosVencimentos: Lancamento[];
}

export interface InsightFinanceiro {
  id: string;
  tipo: 'alerta' | 'oportunidade' | 'elogio' | 'dica';
  titulo: string;
  descricao: string;
  impactoEstimado?: string;
  categoriaId?: string;
}
