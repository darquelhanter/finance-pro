/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Conta, Lancamento } from '../../types';

export class SaldoService {
  /**
   * Aplica o efeito de um lançamento sobre uma conta quando ele é marcado como pago/recebido.
   */
  static aplicarEfeitoLancamento(conta: Conta, lancamento: Lancamento): number {
    let novoSaldo = conta.saldoAtual;

    if (lancamento.tipo === 'receita') {
      novoSaldo += lancamento.valor;
    } else if (lancamento.tipo === 'despesa') {
      novoSaldo -= lancamento.valor;
    } else if (lancamento.tipo === 'transferencia') {
      if (lancamento.contaId === conta.id) {
        novoSaldo -= lancamento.valor;
      } else if (lancamento.contaDestinoId === conta.id) {
        novoSaldo += lancamento.valor;
      }
    }

    return Math.round(novoSaldo * 100) / 100;
  }

  /**
   * Reverte o efeito de um lançamento que estava pago e foi cancelado ou excluído.
   */
  static reverterEfeitoLancamento(conta: Conta, lancamento: Lancamento): number {
    let novoSaldo = conta.saldoAtual;

    if (lancamento.tipo === 'receita') {
      novoSaldo -= lancamento.valor;
    } else if (lancamento.tipo === 'despesa') {
      novoSaldo += lancamento.valor;
    } else if (lancamento.tipo === 'transferencia') {
      if (lancamento.contaId === conta.id) {
        novoSaldo += lancamento.valor;
      } else if (lancamento.contaDestinoId === conta.id) {
        novoSaldo -= lancamento.valor;
      }
    }

    return Math.round(novoSaldo * 100) / 100;
  }
}
