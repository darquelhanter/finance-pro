/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lancamento, ParcelaInfo, RecorrenciaConfig, StatusLancamento, TipoLancamento } from '../../types';
import { RecorrenciaService } from './recorrencia.service';

export interface CriarLancamentoDTO {
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  categoriaId: string;
  contaId?: string;
  cartaoId?: string;
  faturaId?: string;
  contaDestinoId?: string;
  dataCompetencia: string;
  dataVencimento: string;
  dataPagamento?: string;
  status?: StatusLancamento;
  observacoes?: string;
  tags?: string[];
}

export interface CriarParceladoDTO extends CriarLancamentoDTO {
  numeroParcelas: number;
  intervaloMeses?: number;
}

export interface CriarRecorrenteDTO extends CriarLancamentoDTO {
  recorrencia: RecorrenciaConfig;
}

export class LancamentoService {
  /**
   * Divide o valor total em N parcelas distribuindo qualquer diferença de centavos na 1ª parcela.
   * Exemplo: R$ 100,00 em 3x => [33.34, 33.33, 33.33] (soma exata = 100.00).
   */
  static calcularDivisaoParcelas(valorTotal: number, totalParcelas: number): number[] {
    if (totalParcelas <= 1) return [valorTotal];

    const valorBaseCentavos = Math.floor((valorTotal * 100) / totalParcelas);
    const restoCentavos = Math.round(valorTotal * 100) - (valorBaseCentavos * totalParcelas);

    const parcelas: number[] = [];
    for (let i = 0; i < totalParcelas; i++) {
      const centavos = valorBaseCentavos + (i === 0 ? restoCentavos : 0);
      parcelas.push(centavos / 100);
    }

    return parcelas;
  }

  /**
   * Cria múltiplos lançamentos vinculados para uma compra parcelada.
   */
  static gerarLancamentosParcelados(dto: CriarParceladoDTO, idPaiBase?: string): Lancamento[] {
    const totalParcelas = Math.max(1, dto.numeroParcelas);
    const valoresParcelas = this.calcularDivisaoParcelas(dto.valor, totalParcelas);
    const lancamentoPaiId = idPaiBase || `lanc_pai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const agora = new Date().toISOString();

    const lancamentos: Lancamento[] = [];
    let dataVencimentoCursor = dto.dataVencimento;
    const [, , diaOriginal] = dto.dataVencimento.split('-').map(Number);

    for (let i = 0; i < totalParcelas; i++) {
      const numParcela = i + 1;
      const valorParcela = valoresParcelas[i];

      const parcelaInfo: ParcelaInfo = {
        numero: numParcela,
        total: totalParcelas,
        lancamentoPaiId,
      };

      const lancamento: Lancamento = {
        id: `lanc_${Date.now()}_${numParcela}_${Math.random().toString(36).substring(2, 6)}`,
        tipo: dto.tipo,
        descricao: `${dto.descricao} (${numParcela}/${totalParcelas})`,
        valor: valorParcela,
        categoriaId: dto.categoriaId,
        contaId: dto.contaId,
        cartaoId: dto.cartaoId,
        faturaId: dto.faturaId,
        contaDestinoId: dto.contaDestinoId,
        dataCompetencia: dto.dataCompetencia,
        dataVencimento: dataVencimentoCursor,
        dataPagamento: (numParcela === 1 && dto.status === 'pago') ? (dto.dataPagamento || dto.dataVencimento) : undefined,
        status: (numParcela === 1 && dto.status === 'pago') ? 'pago' : 'pendente',
        observacoes: dto.observacoes,
        tags: dto.tags,
        parcela: parcelaInfo,
        criadoEm: agora,
        atualizadoEm: agora,
      };

      lancamentos.push(lancamento);

      // Avança a data para o próximo mês
      dataVencimentoCursor = RecorrenciaService.calcularProximaData(dataVencimentoCursor, 'mensal', diaOriginal);
    }

    return lancamentos;
  }

  /**
   * Cria o primeiro lançamento recorrente configurado para expansão futura.
   */
  static gerarLancamentoRecorrente(dto: CriarRecorrenteDTO): Lancamento {
    const agora = new Date().toISOString();
    return {
      id: `lanc_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tipo: dto.tipo,
      descricao: dto.descricao,
      valor: dto.valor,
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
      recorrencia: {
        ...dto.recorrencia,
        ocorrenciaAtual: 1,
      },
      criadoEm: agora,
      atualizadoEm: agora,
    };
  }
}
