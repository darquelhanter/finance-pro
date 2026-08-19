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
