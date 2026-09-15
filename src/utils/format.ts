/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StatusLancamento } from '../types';

/**
 * Normaliza uma descrição de lançamento para comparação (trim + minúsculas).
 */
export function normalizarDescricao(descricao?: string): string {
  return (descricao || '').trim().toLowerCase();
}

/**
 * Reduz uma descrição a um slug alfanumérico, usado como parte de chaves de
 * agrupamento de parcelamento (lancamentoPaiId, chaveGrupo).
 */
export function slugificarDescricao(descricao?: string): string {
  return normalizarDescricao(descricao)
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Chave de identidade de um lançamento (descrição normalizada + valor + vencimento),
 * usada tanto para detectar duplicatas exatas quanto para reconciliar itens ao
 * reimportar uma fatura — mantida em um único lugar para as duas checagens não divergirem.
 */
export function construirChaveLancamento(descricao: string, valor: number, dataVencimento?: string): string {
  return `${normalizarDescricao(descricao)}_${valor}_${dataVencimento || ''}`;
}

/**
 * Política única para reconciliar campos ao reimportar um item de fatura contra um
 * lançamento já existente (mesma chave de construirChaveLancamento): dados definidos
 * manualmente pelo usuário no lançamento existente sempre vencem os dados recém-extraídos
 * pela IA. Mantida em um único lugar para as regras de status/categoria/visualização
 * não divergirem ou virarem condicionais ad-hoc espalhadas pelo import.
 */
export function mesclarCamposReimportacao(
  lancamentoExistente: { status?: StatusLancamento; categoriaId?: string; apenasVisualizacao?: boolean } | undefined,
  categoriaSugeridaId: string | undefined,
  deveCriarContaPagar: boolean
): { status: StatusLancamento; categoriaId?: string; apenasVisualizacao: boolean } {
  return {
    status: lancamentoExistente?.status === 'cancelado'
      ? 'cancelado'
      : (deveCriarContaPagar ? 'pago' : (lancamentoExistente?.status || 'pendente')),
    categoriaId: lancamentoExistente?.categoriaId || categoriaSugeridaId,
    apenasVisualizacao: lancamentoExistente?.apenasVisualizacao ?? deveCriarContaPagar,
  };
}

const formatadorDataBr = new Intl.DateTimeFormat('pt-BR');

/**
 * Formata uma data no formato "YYYY-MM-DD" para o padrão brasileiro "DD/MM/AAAA"
 * usando Intl.DateTimeFormat (em vez de split/reverse/join manual espalhado pelo app).
 */
export function formatarDataBr(data?: string | null): string {
  if (!data) return '-';
  const [ano, mes, dia] = data.split('-').map(Number);
  if (!ano || !mes || !dia) return data;
  return formatadorDataBr.format(new Date(ano, mes - 1, dia));
}

/**
 * Formata valores numéricos em moeda Real (BRL) de forma segura contra undefined/null/NaN
 */
export function formatarMoeda(valor?: number | null, incluirSimbolo: boolean = true): string {
  const num = typeof valor === 'number' && !isNaN(valor) ? valor : 0;
  const formatado = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return incluirSimbolo ? `R$ ${formatado}` : formatado;
}

/**
 * Verifica se um lançamento é um item informativo/detalhamento de fatura de cartão de crédito.
 * Itens informativos servem para detalhamento e categorização no extrato,
 * mas NÃO devem somar em duplicidade com a Fatura Consolidada nas Despesas Totais e Contas a Pagar.
 */
export function isItemInformativoFatura(
  lanc: {
    id?: string;
    tipo?: string;
    cartaoId?: string;
    tags?: string[];
    apenasVisualizacao?: boolean;
    descricao?: string;
    status?: string;
  },
  todosLancamentos?: any[]
): boolean {
  // Se for explicitamente boleto, despesa direta ou conta de serviço (ex: Vivo, Copel, Consórcio), NUNCA é item informativo de fatura
  if (lanc.tags?.includes('despesa_direta') || lanc.tags?.includes('boleto') || lanc.tags?.includes('conta_servico')) {
    return false;
  }

  const descLower = (lanc.descricao || '').toLowerCase();
  if (descLower.includes('vivo') || descLower.includes('fibra') || descLower.includes('servopa') || descLower.includes('consórcio') || descLower.includes('consorcio')) {
    return false;
  }

  if (lanc.apenasVisualizacao) return true;
  if (lanc.tags?.includes('item_fatura') || lanc.tags?.includes('detalhamento_cartao')) return true;

  const isFaturaConsolidada = (lanc.tags?.includes('fatura') || descLower.startsWith('fatura ') || descLower.includes('(fatura total)')) && 
    !lanc.tags?.includes('despesa_direta') && 
    !lanc.tags?.includes('boleto');

  // Se este lançamento NÃO é a fatura consolidada, mas está vinculado a um cartão:
  if (!isFaturaConsolidada && lanc.cartaoId) {
    // Se temos a lista completa, verifica se existe a Fatura Consolidada ativa para o mesmo cartão ou período
    if (todosLancamentos && todosLancamentos.length > 0) {
      const temFaturaConsolidada = todosLancamentos.some(
        other => other.id !== lanc.id &&
          other.cartaoId === lanc.cartaoId &&
          (other.tags?.includes('fatura') || (other.descricao || '').toLowerCase().startsWith('fatura ')) &&
          other.status !== 'cancelado'
      );
      if (temFaturaConsolidada) return true;
    }
  }

  return false;
}
