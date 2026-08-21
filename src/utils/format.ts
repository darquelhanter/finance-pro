/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  if (lanc.apenasVisualizacao) return true;
  if (lanc.tags?.includes('item_fatura') || lanc.tags?.includes('detalhamento_cartao')) return true;

  const descLower = (lanc.descricao || '').toLowerCase();
  const isFaturaConsolidada = lanc.tags?.includes('fatura') || 
    lanc.tags?.includes('contas-a-pagar') || 
    descLower.startsWith('fatura ') || 
    descLower.includes('(fatura total)');

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
