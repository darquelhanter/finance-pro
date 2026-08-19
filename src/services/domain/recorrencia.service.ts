/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FrequenciaRecorrencia } from '../../types';

export class RecorrenciaService {
  /**
   * Calcula a próxima data de vencimento com base na frequência e dia base,
   * tratando com precisão variações de fim de mês (ex: dia 31 em fevereiro ou abril).
   */
  static calcularProximaData(dataAtualStr: string, frequencia: FrequenciaRecorrencia, diaBaseOriginal?: number): string {
    const [ano, mes, dia] = dataAtualStr.split('-').map(Number);
    const dataAtual = new Date(ano, mes - 1, dia);
    const diaAlvo = diaBaseOriginal || dia;

    let novaData: Date;

    switch (frequencia) {
      case 'semanal':
        novaData = new Date(dataAtual.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;

      case 'quinzenal':
        novaData = new Date(dataAtual.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;

      case 'mensal': {
        const proximoMes = mes; // mes - 1 + 1 = mes
        const ultimoDiaDoProximoMes = new Date(ano, proximoMes + 1, 0).getDate();
        const diaEfetivo = Math.min(diaAlvo, ultimoDiaDoProximoMes);
        novaData = new Date(ano, proximoMes, diaEfetivo);
        break;
      }

      case 'bimestral': {
        const proximoMes = mes + 1;
        const ultimoDia = new Date(ano, proximoMes + 1, 0).getDate();
        const diaEfetivo = Math.min(diaAlvo, ultimoDia);
        novaData = new Date(ano, proximoMes, diaEfetivo);
        break;
      }

      case 'trimestral': {
        const proximoMes = mes + 2;
        const ultimoDia = new Date(ano, proximoMes + 1, 0).getDate();
        const diaEfetivo = Math.min(diaAlvo, ultimoDia);
        novaData = new Date(ano, proximoMes, diaEfetivo);
        break;
      }

      case 'semestral': {
        const proximoMes = mes + 5;
        const ultimoDia = new Date(ano, proximoMes + 1, 0).getDate();
        const diaEfetivo = Math.min(diaAlvo, ultimoDia);
        novaData = new Date(ano, proximoMes, diaEfetivo);
        break;
      }

      case 'anual': {
        const proximoAno = ano + 1;
        const ultimoDia = new Date(proximoAno, mes, 0).getDate();
        const diaEfetivo = Math.min(diaAlvo, ultimoDia);
        novaData = new Date(proximoAno, mes - 1, diaEfetivo);
        break;
      }

      default:
        novaData = new Date(dataAtual.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    return this.formatarData(novaData);
  }

  /**
   * Gera uma lista de datas futuras projetadas para visualização do usuário.
   */
  static gerarProjecaoDatas(dataInicialStr: string, frequencia: FrequenciaRecorrencia, totalOcorrencias: number = 6): string[] {
    const datas: string[] = [];
    let dataCursor = dataInicialStr;
    const [, , diaOriginal] = dataInicialStr.split('-').map(Number);

    for (let i = 0; i < totalOcorrencias; i++) {
      datas.push(dataCursor);
      dataCursor = this.calcularProximaData(dataCursor, frequencia, diaOriginal);
    }

    return datas;
  }

  static formatarData(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
