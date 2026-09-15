/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lancamento, CartaoCredito, Categoria } from '../types.js';
import { slugificarDescricao } from './format.js';
import { RecorrenciaService } from '../services/domain/recorrencia.service.js';

export interface CompraParceladaAgrupada {
  id: string;
  descricaoBase: string;
  cartaoId?: string;
  categoriaId?: string;
  valorParcela: number;
  valorTotalOriginal: number;
  totalParcelas: number;
  parcelasPagas: number;
  parcelasRestantes: number;
  saldoDevedor: number;
  proximaData?: string;
  dataTermino?: string;
  mesTerminoFormatado?: string;
  mesesAteTermino?: number;
  itens: Lancamento[];
  concluida: boolean;
}

export interface ProjecaoMesFuturo {
  anoMes: string; // '2026-09'
  rotuloMes: string; // 'Set/2026'
  mes: number;
  ano: number;
  valorTotal: number;
  itens: {
    lancamentoId?: string;
    descricao: string;
    valor: number;
    numeroParcela?: number;
    totalParcelas?: number;
    cartaoId?: string;
    categoriaId?: string;
    isUltimaParcela: boolean;
    compraPaiId?: string;
  }[];
  itensFinalizando: {
    descricao: string;
    valorLiberado: number;
    cartaoId?: string;
  }[];
  valorTotalLiberadoProximoMes: number;
}

export class ParcelamentoService {
  /**
   * Extrai a descrição base e o índice de parcelas caso esteja em qualquer posição da string:
   * Exemplos suportados:
   * - "61326619Maria 05/06 CURITIBA" -> desc: "61326619Maria CURITIBA", atual: 5, total: 6
   * - "PARC.FACIL 03/12 40,04" -> desc: "PARC.FACIL", atual: 3, total: 12
   * - "ZARA BRASIL (02/05)" -> desc: "ZARA BRASIL", atual: 2, total: 5
   * - "APPLE STORE - PARC 03/10" -> desc: "APPLE STORE", atual: 3, total: 10
   * - "MAGALU 01 DE 10" -> desc: "MAGALU", atual: 1, total: 10
   * - "CURSO INGLES 04-12" -> desc: "CURSO INGLES", atual: 4, total: 12
   */
  static extrairInfoDescricao(descricao: string): {
    descricaoBase: string;
    parcelaAtual?: number;
    totalParcelas?: number;
    encontrouPadrao: boolean;
  } {
    if (!descricao) {
      return { descricaoBase: '', encontrouPadrao: false };
    }

    const texto = descricao.trim();

    // 1. Padrão explícito com palavra "parcela" ou "parc" (ex: "PARC 05/06", "PARC.FACIL 03/12", "PARCELA 2 DE 5")
    const regexParc = /(?:parc(?:ela|\.facil|\.)?)\s*[:\-\s]?\s*[\(\[]?(\d{1,2})\s*(?:\/|de|-)\s*(\d{1,2})[\)\]]?/i;
    const matchParc = texto.match(regexParc);
    if (matchParc && matchParc[1] && matchParc[2]) {
      const pAtual = parseInt(matchParc[1], 10);
      const pTotal = parseInt(matchParc[2], 10);
      if (pAtual >= 1 && pTotal >= pAtual && pTotal <= 72 && pTotal > 1) {
        const descLimpa = texto.replace(matchParc[0], '').replace(/\s{2,}/g, ' ').replace(/[\-–—\s]+$/, '').replace(/^[\-–—\s]+/, '').trim();
        return {
          descricaoBase: descLimpa || texto,
          parcelaAtual: pAtual,
          totalParcelas: pTotal,
          encontrouPadrao: true,
        };
      }
    }

    // 2. Padrão com parênteses ou colchetes: (05/06) ou [03/12] ou (5/6) ou (05 de 06)
    const regexParenteses = /[\(\[]\s*(\d{1,2})\s*(?:\/|de|-)\s*(\d{1,2})\s*[\)\]]/i;
    const matchParenteses = texto.match(regexParenteses);
    if (matchParenteses && matchParenteses[1] && matchParenteses[2]) {
      const pAtual = parseInt(matchParenteses[1], 10);
      const pTotal = parseInt(matchParenteses[2], 10);
      if (pAtual >= 1 && pTotal >= pAtual && pTotal <= 72 && pTotal > 1) {
        const descLimpa = texto.replace(matchParenteses[0], '').replace(/\s{2,}/g, ' ').replace(/[\-–—\s]+$/, '').replace(/^[\-–—\s]+/, '').trim();
        return {
          descricaoBase: descLimpa || texto,
          parcelaAtual: pAtual,
          totalParcelas: pTotal,
          encontrouPadrao: true,
        };
      }
    }

    // 3. Padrão solto no meio ou final: "05/06" ou "03/12" ou "05 de 06" ou "5/10"
    // Regex com limites de palavra ou espaços para evitar pegar datas completas como 12/08/2026
    const regexSolto = /(?:^|\s+)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})(?:\s+|$)/i;
    const matchSolto = texto.match(regexSolto);
    if (matchSolto && matchSolto[1] && matchSolto[2]) {
      const pAtual = parseInt(matchSolto[1], 10);
      const pTotal = parseInt(matchSolto[2], 10);
      // Validação para garantir que não seja mês/dia invertido ou data completa
      // Em parcelas, pAtual <= pTotal e pTotal > 1 e pTotal <= 72
      if (pAtual >= 1 && pTotal >= pAtual && pTotal <= 72 && pTotal > 1) {
        // Remove a fração da descrição mantendo o restante
        const descLimpa = texto.replace(matchSolto[0], ' ').replace(/\s{2,}/g, ' ').replace(/[\-–—\s]+$/, '').replace(/^[\-–—\s]+/, '').trim();
        return {
          descricaoBase: descLimpa || texto,
          parcelaAtual: pAtual,
          totalParcelas: pTotal,
          encontrouPadrao: true,
        };
      }
    }

    return {
      descricaoBase: texto,
      encontrouPadrao: false,
    };
  }

  /**
   * Identifica lançamentos que possuem padrão de parcela na descrição
   * mas ainda não possuem a propriedade `parcela` estruturada no banco de dados.
   */
  static identificarLancamentosNaoEstruturados(lancamentos: Lancamento[]): {
    lancamento: Lancamento;
    descricaoLimpa: string;
    parcelaAtual: number;
    totalParcelas: number;
  }[] {
    const naoEstruturados: {
      lancamento: Lancamento;
      descricaoLimpa: string;
      parcelaAtual: number;
      totalParcelas: number;
    }[] = [];

    for (const lanc of lancamentos) {
      // Ignora lançamentos cancelados ou que já possuem estrutura completa
      if (lanc.status === 'cancelado') continue;
      
      const jaEstruturado = lanc.parcela && lanc.parcela.numero && lanc.parcela.total && lanc.parcela.total > 1;
      if (jaEstruturado) continue;

      const info = this.extrairInfoDescricao(lanc.descricao);
      if (info.encontrouPadrao && info.parcelaAtual && info.totalParcelas) {
        naoEstruturados.push({
          lancamento: lanc,
          descricaoLimpa: info.descricaoBase,
          parcelaAtual: info.parcelaAtual,
          totalParcelas: info.totalParcelas,
        });
      }
    }

    return naoEstruturados;
  }

  /**
   * Agrupa e calcula o status consolidado de todas as compras parceladas do usuário
   */
  static agruparComprasParceladas(
    lancamentos: Lancamento[],
    cartaoIdFiltro?: string
  ): CompraParceladaAgrupada[] {
    const gruposMap = new Map<string, Lancamento[]>();

    // Filtra apenas despesas ou itens de cartão/parcelados não cancelados
    const lancamentosRelevantes = (lancamentos || []).filter((l) => {
      if (l.status === 'cancelado') return false;
      if (l.tipo !== 'despesa') return false;
      if (cartaoIdFiltro && l.cartaoId !== cartaoIdFiltro) return false;
      return true;
    });

    // Calcula a descrição/parcela extraída de cada lançamento uma única vez e reaproveita
    // abaixo (agrupamento, ordenação e detecção da parcela mais avançada) em vez de
    // re-parsear a mesma descrição com regex repetidamente.
    const infoCache = new Map<string, ReturnType<typeof ParcelamentoService.extrairInfoDescricao>>();
    for (const lanc of lancamentosRelevantes) {
      infoCache.set(lanc.id, this.extrairInfoDescricao(lanc.descricao));
    }

    for (const lanc of lancamentosRelevantes) {
      let chaveGrupo = '';

      const { descricaoBase, parcelaAtual, totalParcelas } = infoCache.get(lanc.id)!;
      const numParc = lanc.parcela?.numero || parcelaAtual;
      const totParc = lanc.parcela?.total || totalParcelas;
      const nomeLimpo = slugificarDescricao(descricaoBase || lanc.descricao);

      if (lanc.parcela?.lancamentoPaiId) {
        chaveGrupo = `pai_${lanc.parcela.lancamentoPaiId}`;
      } else if (totParc && totParc > 1) {
        chaveGrupo = `parc_${nomeLimpo}_${lanc.cartaoId || 'geral'}_${totParc}`;
      }

      if (chaveGrupo) {
        if (!gruposMap.has(chaveGrupo)) {
          gruposMap.set(chaveGrupo, []);
        }
        gruposMap.get(chaveGrupo)!.push(lanc);
      }
    }

    const resultado: CompraParceladaAgrupada[] = [];
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    for (const [chave, itens] of gruposMap.entries()) {
      // Ordena itens por vencimento ou número de parcela
      itens.sort((a, b) => {
        const numA = a.parcela?.numero || infoCache.get(a.id)?.parcelaAtual || 0;
        const numB = b.parcela?.numero || infoCache.get(b.id)?.parcelaAtual || 0;
        if (numA !== numB) return numA - numB;
        return (a.dataVencimento || '').localeCompare(b.dataVencimento || '');
      });

      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const descricaoBase = infoCache.get(primeiro.id)?.descricaoBase;

      const totalParcelasDetectado =
        itens.reduce((max, i) => {
          const tot = i.parcela?.total || infoCache.get(i.id)?.totalParcelas || 0;
          return Math.max(max, tot);
        }, 0) ||
        primeiro.parcela?.total ||
        infoCache.get(primeiro.id)?.totalParcelas ||
        itens.length;

      const valorParcela = Number(ultimo.valor || primeiro.valor) || 0;
      const valorTotalOriginal = valorParcela * totalParcelasDetectado;

      // O número de parcela mais recente que o usuário já alcançou/faturou nesta fatura ou no banco (ex: 04/04 -> 4, 05/05 -> 5, 02/06 -> 2)
      const { item: itemMaisRecente, numero: maxParcelaRegistrada } = this.encontrarItemMaisAvancado(itens, infoCache);

      const parcelasPagasCount = itens.filter((i) => i.status === 'pago').length;
      
      // Quantas parcelas já foram faturadas / pagas até a data do lançamento mais recente
      const pagas = Math.min(
        totalParcelasDetectado,
        Math.max(maxParcelaRegistrada || 1, parcelasPagasCount)
      );

      const restantes = Math.max(0, totalParcelasDetectado - pagas);
      const saldoDevedor = restantes * valorParcela;

      const dataRef = itemMaisRecente.dataVencimento || itemMaisRecente.dataCompetencia || hoje.toISOString().split('T')[0];
      let dataTermino = dataRef;

      // Projeta a data final de quitação com base no número de parcelas restantes,
      // reaproveitando o RecorrenciaService (já trata corretamente o ajuste de fim de mês).
      if (restantes > 0 && dataRef) {
        const datasProjetadas = RecorrenciaService.gerarProjecaoDatas(dataRef, 'mensal', restantes + 1);
        dataTermino = datasProjetadas[datasProjetadas.length - 1];
      }

      let mesTerminoFormatado = '';
      let mesesAteTermino = 0;
      if (restantes === 0) {
        mesTerminoFormatado = 'Quitada';
        mesesAteTermino = 0;
      } else if (dataTermino) {
        const [anoTerm, mesTerm] = dataTermino.split('-').map(Number);
        const dObj = new Date(anoTerm, mesTerm - 1, 1);
        mesTerminoFormatado = dObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        
        mesesAteTermino = (anoTerm - anoAtual) * 12 + (mesTerm - mesAtual);
      }

      resultado.push({
        id: chave,
        descricaoBase: descricaoBase || primeiro.descricao,
        cartaoId: primeiro.cartaoId,
        categoriaId: primeiro.categoriaId,
        valorParcela,
        valorTotalOriginal,
        totalParcelas: totalParcelasDetectado,
        parcelasPagas: pagas,
        parcelasRestantes: restantes,
        saldoDevedor,
        proximaData: dataRef,
        dataTermino,
        mesTerminoFormatado,
        mesesAteTermino: Math.max(0, mesesAteTermino),
        itens,
        concluida: restantes === 0,
      });
    }

    // Ordena: compras ativas primeiro com maior saldo devedor, depois concluídas
    resultado.sort((a, b) => {
      if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
      return b.saldoDevedor - a.saldoDevedor;
    });

    return resultado;
  }

  /**
   * Encontra, dentro de um grupo de itens de uma mesma compra parcelada, o item com o
   * maior número de parcela já registrado — usado tanto para agrupar quanto para projetar
   * meses futuros, para que as duas visões nunca divirjam sobre qual é "a parcela mais recente".
   */
  private static encontrarItemMaisAvancado(
    itens: Lancamento[],
    infoCache?: Map<string, ReturnType<typeof ParcelamentoService.extrairInfoDescricao>>
  ): { item: Lancamento; numero: number } {
    let numeroMax = 0;
    let itemEscolhido = itens[0];
    for (const it of itens) {
      const info = infoCache?.get(it.id) ?? this.extrairInfoDescricao(it.descricao);
      const numero = it.parcela?.numero || info.parcelaAtual || 1;
      if (numero >= numeroMax) {
        numeroMax = numero;
        itemEscolhido = it;
      }
    }
    return { item: itemEscolhido, numero: numeroMax };
  }

  /**
   * Gera a projeção mensal detalhada para os próximos N meses (ex: 12 ou 24 meses)
   */
  static gerarProjecaoMeses(
    lancamentos: Lancamento[],
    comprasAgrupadas: CompraParceladaAgrupada[],
    mesesAFrente: number = 12,
    cartaoIdFiltro?: string
  ): ProjecaoMesFuturo[] {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    const projecoes: ProjecaoMesFuturo[] = [];

    for (let i = 0; i < mesesAFrente; i++) {
      const dataMes = new Date(anoAtual, mesAtual - 1 + i, 1);
      const m = dataMes.getMonth() + 1;
      const y = dataMes.getFullYear();
      const anoMes = `${y}-${String(m).padStart(2, '0')}`;
      const rotuloMes = dataMes.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

      const itensDoMes: ProjecaoMesFuturo['itens'] = [];
      const itensFinalizando: ProjecaoMesFuturo['itensFinalizando'] = [];
      const idsProcessados = new Set<string>();

      // 1. Procura lançamentos específicos já salvos no banco para este mês
      const lancamentosBanco = (lancamentos || []).filter((l) => {
        if (l.status === 'cancelado') return false;
        if (l.tipo !== 'despesa') return false;
        if (cartaoIdFiltro && l.cartaoId !== cartaoIdFiltro) return false;

        const dataRef = l.dataVencimento || l.dataCompetencia;
        if (!dataRef) return false;
        const [la, lm] = dataRef.split('-').map(Number);
        return la === y && lm === m;
      });

      for (const lb of lancamentosBanco) {
        const { descricaoBase, parcelaAtual, totalParcelas } = this.extrairInfoDescricao(lb.descricao);
        const pNum = lb.parcela?.numero || parcelaAtual;
        const pTot = lb.parcela?.total || totalParcelas;
        const isUltima = pNum && pTot ? pNum === pTot : false;

        itensDoMes.push({
          lancamentoId: lb.id,
          descricao: lb.descricao,
          valor: Number(lb.valor) || 0,
          numeroParcela: pNum,
          totalParcelas: pTot,
          cartaoId: lb.cartaoId,
          categoriaId: lb.categoriaId,
          isUltimaParcela: isUltima,
          compraPaiId: lb.parcela?.lancamentoPaiId,
        });

        idsProcessados.add(lb.id);

        if (isUltima) {
          itensFinalizando.push({
            descricao: descricaoBase || lb.descricao,
            valorLiberado: Number(lb.valor) || 0,
            cartaoId: lb.cartaoId,
          });
        }
      }

      // 2. Se houver compras parceladas cujas parcelas futuras ainda não estão gravadas individualmente no banco,
      // nós projetamos matematicamente com base no plano de parcelas
      for (const grupo of comprasAgrupadas) {
        if (grupo.concluida) continue;
        if (cartaoIdFiltro && grupo.cartaoId !== cartaoIdFiltro) continue;

        // Verifica se já tem algum item desse grupo processado pelo banco neste mês específico
        const jaTemNoBanco = grupo.itens.some((it) => idsProcessados.has(it.id));
        if (jaTemNoBanco) continue;

        // Projeta as parcelas futuras restantes a partir da data de referência do último lançamento faturado
        if (grupo.itens.length > 0 && grupo.parcelasRestantes > 0) {
          const { item: itemUltimo, numero: maxParcNum } = this.encontrarItemMaisAvancado(grupo.itens);

          const dataRef = itemUltimo.dataVencimento || itemUltimo.dataCompetencia || hoje.toISOString().split('T')[0];
          const [anoRef, mesRef] = dataRef.split('-').map(Number);

          // Diferença em meses entre o mês analisado (y, m) e o mês da última parcela registrada (anoRef, mesRef)
          const deltaMeses = (y - anoRef) * 12 + (m - mesRef);

          // Se este mês da projeção está no futuro em relação à última parcela faturada
          if (deltaMeses > 0) {
            const numParcelaProjetada = maxParcNum + deltaMeses;

            // Se a parcela projetada não ultrapassa o total de parcelas do contrato
            if (numParcelaProjetada <= grupo.totalParcelas) {
              const isUltima = numParcelaProjetada === grupo.totalParcelas;

              itensDoMes.push({
                descricao: `${grupo.descricaoBase} (${String(numParcelaProjetada).padStart(2, '0')}/${String(grupo.totalParcelas).padStart(2, '0')})`,
                valor: grupo.valorParcela,
                numeroParcela: numParcelaProjetada,
                totalParcelas: grupo.totalParcelas,
                cartaoId: grupo.cartaoId,
                categoriaId: grupo.categoriaId,
                isUltimaParcela: isUltima,
                compraPaiId: grupo.id,
              });

              if (isUltima) {
                itensFinalizando.push({
                  descricao: grupo.descricaoBase,
                  valorLiberado: grupo.valorParcela,
                  cartaoId: grupo.cartaoId,
                });
              }
            }
          }
        }
      }

      const valorTotal = itensDoMes.reduce((acc, it) => acc + it.valor, 0);
      const valorTotalLiberadoProximoMes = itensFinalizando.reduce((acc, it) => acc + it.valorLiberado, 0);

      projecoes.push({
        anoMes,
        rotuloMes: rotuloMes.toUpperCase().replace('.', ''),
        mes: m,
        ano: y,
        valorTotal,
        itens: itensDoMes,
        itensFinalizando,
        valorTotalLiberadoProximoMes,
      });
    }

    return projecoes;
  }

  /**
   * Simula o impacto de uma nova compra parcelada no orçamento futuro
   */
  static simularNovaCompra(
    projecoesAtuais: ProjecaoMesFuturo[],
    novaCompra: {
      descricao: string;
      valorTotal: number;
      numeroParcelas: number;
      mesInicioIndex: number; // 0 = mês atual, 1 = próximo mês, etc.
      cartaoId?: string;
    }
  ): {
    projecoesSimuladas: {
      anoMes: string;
      rotuloMes: string;
      valorOriginal: number;
      valorNovo: number;
      diferenca: number;
      parcelaNovaValor: number;
      isMesDeAlivio: boolean;
      saldoCompensadoPeloAlivio: number;
    }[];
    impactoTotal: number;
    valorParcelaNova: number;
    mesTerminoSimulacao: string;
  } {
    const totalParcelas = Math.max(1, novaCompra.numeroParcelas);
    const valorParcelaNova = Number((novaCompra.valorTotal / totalParcelas).toFixed(2));
    
    let mesTerminoSimulacao = '';

    const projecoesSimuladas = projecoesAtuais.map((proj, idx) => {
      const parcelaIndex = idx - novaCompra.mesInicioIndex;
      let adicionaParcela = false;

      if (parcelaIndex >= 0 && parcelaIndex < totalParcelas) {
        adicionaParcela = true;
        if (parcelaIndex === totalParcelas - 1) {
          mesTerminoSimulacao = proj.rotuloMes;
        }
      }

      const valorNovo = proj.valorTotal + (adicionaParcela ? valorParcelaNova : 0);
      const diferenca = adicionaParcela ? valorParcelaNova : 0;
      const isMesDeAlivio = proj.itensFinalizando.length > 0;
      const saldoCompensadoPeloAlivio = proj.valorTotalLiberadoProximoMes;

      return {
        anoMes: proj.anoMes,
        rotuloMes: proj.rotuloMes,
        valorOriginal: proj.valorTotal,
        valorNovo,
        diferenca,
        parcelaNovaValor: adicionaParcela ? valorParcelaNova : 0,
        isMesDeAlivio,
        saldoCompensadoPeloAlivio,
      };
    });

    return {
      projecoesSimuladas,
      impactoTotal: novaCompra.valorTotal,
      valorParcelaNova,
      mesTerminoSimulacao: mesTerminoSimulacao || projecoesAtuais[projecoesAtuais.length - 1]?.rotuloMes || '',
    };
  }
}
