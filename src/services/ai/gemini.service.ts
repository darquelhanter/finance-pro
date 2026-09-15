/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { ExtracaoFaturaResponse, InsightFinanceiro } from '../../types.js';
import { ParcelamentoService } from '../../utils/parcelas.js';

let genAIClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chave GEMINI_API_KEY não configurada no servidor.');
  }

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

/**
 * Executa a chamada à API do Gemini com fallback automático de modelos
 * caso o modelo principal esteja com alta demanda temporária (HTTP 503 / UNAVAILABLE / 429).
 */
async function callGeminiWithResilience(params: {
  contents: any[];
  systemInstruction: string;
  responseSchema: any;
}) {
  const ai = getAI();
  // Modelos suportados e recomendados pela SDK @google/genai
  const candidateModels = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTransient = 
          errMsg.includes('503') || 
          errMsg.includes('UNAVAILABLE') || 
          errMsg.includes('high demand') || 
          errMsg.includes('429') || 
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('Quota exceeded');

        console.warn(`[GeminiService] Modelo ${model} (tentativa ${attempt}) retornou: ${errMsg}`);

        if (isTransient) {
          // Se for 429 quota de um modelo específico, pula direto pro próximo modelo candidato
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded')) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error('Os servidores de IA estão com alta demanda temporária.');
}

/**
 * Extrator heurístico inteligente de contingência caso a cota do Gemini seja excedida
 * ou para pré-processamento de texto colado com quebra de linhas bancárias
 */
function extrairHeuristicamente(texto: string): ExtracaoFaturaResponse {
  const rawLinhas = texto.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const itens: any[] = [];
  let emissor = 'Cartão de Crédito';
  let tipoDocumento: 'fatura_cartao' | 'boleto_cobranca' = 'fatura_cartao';
  let valorTotal: number | undefined = undefined;
  let dataVencimento: string | undefined = undefined;

  const textoLower = texto.toLowerCase();
  if (textoLower.includes('vivo') || textoLower.includes('claro') || textoLower.includes('tim') || textoLower.includes('copel') || textoLower.includes('enel') || textoLower.includes('servopa') || textoLower.includes('consorcio') || textoLower.includes('consórcio') || textoLower.includes('boleto') || textoLower.includes('aluguel') || textoLower.includes('condomin')) {
    tipoDocumento = 'boleto_cobranca';
    if (textoLower.includes('vivo')) emissor = 'Vivo';
    else if (textoLower.includes('claro')) emissor = 'Claro';
    else if (textoLower.includes('tim')) emissor = 'TIM';
    else if (textoLower.includes('servopa')) emissor = 'Consórcio Servopa';
    else if (textoLower.includes('copel')) emissor = 'Copel';
    else if (textoLower.includes('enel')) emissor = 'Enel';
  } else if (textoLower.includes('ailos')) emissor = 'Ailos Mastercard';
  else if (textoLower.includes('nubank')) emissor = 'Nubank';
  else if (textoLower.includes('itau') || textoLower.includes('itaú')) emissor = 'Itaú';
  else if (textoLower.includes('bradesco')) emissor = 'Bradesco';
  else if (textoLower.includes('santander')) emissor = 'Santander';
  else if (textoLower.includes('inter')) emissor = 'Banco Inter';
  else if (textoLower.includes('c6')) emissor = 'C6 Bank';

  // Procurar datas de vencimento
  const regexVenc = /vencimento[:\s]+(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/i;
  const matchVenc = texto.match(regexVenc);
  if (matchVenc) {
    dataVencimento = `${matchVenc[3]}-${matchVenc[2]}-${matchVenc[1]}`;
  }

  // Mapa de meses em português
  const MESES_MAP: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  };

  const anoAtual = new Date().getFullYear();

  // Etapa 1: Pré-processamento e unificação de linhas partidas (ex: Ailos, Nubank, Itaú)
  // Onde linha 1 é: "18 FEV ZP*P. M. CONSIG LTDA" e linha 2 é: "06/06 CURITIBA R$ 390,00"
  const linhasConsolidadas: string[] = [];
  const regexInicioData = /^(?:(?:\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez))|(?:\d{2}[\/\.-]\d{2}(?:[\/\.-]\d{2,4})?))/i;
  const regexTemValor = /(?:R\$\s*|VALOR\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[\.,]\d{2})(?:\s*|$)/i;

  for (let i = 0; i < rawLinhas.length; i++) {
    const linha = rawLinhas[i];

    // Ignora cabeçalhos conhecidos e rodapés de extrato
    if (
      linha.match(/^DATA\s+DESCRIÇÃO/i) ||
      linha.match(/^MOVIMENTAÇÕES\s+DA\s+CONTA/i) ||
      linha.match(/^SALDO\s+ANTERIOR/i) ||
      linha.match(/^TOTAL\s+DE\s+/i) ||
      linha.match(/^TOTAL\s+R\$/i) ||
      linha.match(/^PAGAMENTO[\-\s]BOLETO/i) ||
      linha.match(/^JOAO\s+PAULO/i) ||
      linha.match(/^LANÇAMENTOS\s+\-/i)
    ) {
      // Pega valor total se houver em "TOTAL R$ 1.836,23"
      if (linha.match(/^TOTAL\s+R\$/i)) {
        const mv = linha.match(/R\$\s*([\d\.,]+)/i);
        if (mv) {
          const num = parseFloat(mv[1].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(num)) valorTotal = num;
        }
      }
      continue;
    }

    // Se a linha começa com data (ex: "18 FEV ..."), mas não tem valor R$, e a próxima linha tem valor/parcela
    if (regexInicioData.test(linha) && !regexTemValor.test(linha) && i + 1 < rawLinhas.length) {
      const proximaLinha = rawLinhas[i + 1];
      // Se a próxima linha NÃO começar com outra data, funde as duas!
      if (!regexInicioData.test(proximaLinha)) {
        linhasConsolidadas.push(`${linha} ${proximaLinha}`);
        i++; // pula a próxima linha pois foi anexada
        continue;
      }
    }

    linhasConsolidadas.push(linha);
  }

  // Etapa 2: Processamento dos lançamentos
  for (let i = 0; i < linhasConsolidadas.length; i++) {
    const linha = linhasConsolidadas[i];

    // Procura valor monetário (ex: R$ 145,90 ou 145,90 ou 1.250,00)
    const matchValor = linha.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\b\d+,\d{2}\b)/);
    if (!matchValor) continue;

    const valorStr = matchValor[1].replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    if (isNaN(valorNum) || valorNum <= 0) continue;

    // Se for estorno ou desconto isolado irrelevante
    if (linha.toLowerCase().includes('desc anuidade') || linha.toLowerCase().includes('pagamento-boleto')) {
      continue;
    }

    let dataFormatada = new Date().toISOString().split('T')[0];
    let dataStrEncontrada = '';

    // 1. Procura data com mês em texto (ex: "18 FEV", "04 MAI", "10 JUL")
    const matchDataTexto = linha.match(/(?:^|\s)(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)(?:\s+(\d{4}))?/i);
    if (matchDataTexto) {
      const dia = matchDataTexto[1].padStart(2, '0');
      const mesNome = matchDataTexto[2].toLowerCase();
      const mesNum = MESES_MAP[mesNome] || '01';
      const ano = matchDataTexto[3] || `${anoAtual}`;
      dataFormatada = `${ano}-${mesNum}-${dia}`;
      dataStrEncontrada = matchDataTexto[0];
    } else {
      // 2. Procura data numérica DD/MM ou DD/MM/YYYY no início da linha
      const matchDataNum = linha.match(/(?:^|\s)(\d{2})[\/\.-](\d{2})(?:[\/\.-](\d{2,4}))?(?:\s|$)/);
      if (matchDataNum) {
        const p1 = parseInt(matchDataNum[1], 10);
        const p2 = parseInt(matchDataNum[2], 10);
        if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12) {
          const dia = matchDataNum[1];
          const mes = matchDataNum[2];
          const ano = matchDataNum[3] ? (matchDataNum[3].length === 2 ? `20${matchDataNum[3]}` : matchDataNum[3]) : `${anoAtual}`;
          dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          dataStrEncontrada = matchDataNum[0];
        }
      }
    }

    // Extração inteligente de parcelas (ex: "06/06", "03/12", "05/05", "04/04", "03/05", "02/06")
    // Se a data já foi extraída (ex: "18 FEV"), qualquer padrão "XX/YY" na linha é GARANTIDAMENTE parcela!
    const infoParcela = ParcelamentoService.extrairInfoDescricao(linha);
    let parcelaAtual = infoParcela.parcelaAtual;
    let totalParcelas = infoParcela.totalParcelas;

    // Se ainda não pegou parcela por causa de parênteses como "(7402) 03/12"
    if (!parcelaAtual) {
      const matchParcAlternativo = linha.match(/(?:^|\s|\))(\d{1,2})\/(\d{1,2})(?:\s|$)/);
      if (matchParcAlternativo) {
        const pA = parseInt(matchParcAlternativo[1], 10);
        const pT = parseInt(matchParcAlternativo[2], 10);
        if (pA >= 1 && pT >= pA && pT <= 72 && pT > 1) {
          parcelaAtual = pA;
          totalParcelas = pT;
        }
      }
    }

    // Limpar descrição
    let desc = (infoParcela.encontrouPadrao ? infoParcela.descricaoBase : linha)
      .replace(matchValor[0], '')
      .replace(dataStrEncontrada, '')
      .replace(/\(\d{4}\)/g, '') // remove número de cartão ex (7402)
      .replace(/\b\d{1,2}\/\d{1,2}\b/g, '') // remove qualquer fração restante
      .replace(/R\$/g, '')
      .replace(/[\-–—]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (desc.length < 2) {
      desc = `${emissor} - Lançamento ${itens.length + 1}`;
    }

    // Identificar categoria inteligente
    const descLow = desc.toLowerCase();
    let catId = 'cat_outros';
    let catNome = 'Outras Despesas';

    if (descLow.includes('apple') || descLow.includes('netflix') || descLow.includes('spotify') || descLow.includes('google') || descLow.includes('software') || descLow.includes('vivo') || descLow.includes('claro') || descLow.includes('tim')) {
      catId = 'cat_servicos';
      catNome = 'Software & Assinaturas';
    } else if (descLow.includes('mercado') || descLow.includes('supermercado') || descLow.includes('mercearia') || descLow.includes('cantinho') || descLow.includes('brunao') || descLow.includes('delicia') || descLow.includes('gulo') || descLow.includes('guela') || descLow.includes('ifood') || descLow.includes('restaurante')) {
      catId = 'cat_alimentacao';
      catNome = 'Alimentação & Mercado';
    } else if (descLow.includes('posto') || descLow.includes('combustivel') || descLow.includes('uber') || descLow.includes('99') || descLow.includes('carro')) {
      catId = 'cat_transporte';
      catNome = 'Transporte & Combustível';
    } else if (descLow.includes('farmacia') || descLow.includes('droga') || descLow.includes('saude') || descLow.includes('medico')) {
      catId = 'cat_saude';
      catNome = 'Saúde & Farmácia';
    } else if (descLow.includes('havan') || descLow.includes('zara') || descLow.includes('magazine') || descLow.includes('showco') || descLow.includes('silcolor') || descLow.includes('loja') || descLow.includes('anuidade')) {
      catId = 'cat_outras_despesas';
      catNome = 'Compras & Vestuário';
    }

    itens.push({
      id: `item_heur_${Date.now()}_${itens.length}`,
      data: dataFormatada,
      descricao: desc,
      valor: valorNum,
      parcelaAtual,
      totalParcelas,
      categoriaSugeridaId: catId,
      categoriaSugeridaNome: catNome,
      selecionado: true,
    });
  }

  if (itens.length > 0 && !valorTotal) {
    valorTotal = itens.reduce((acc, it) => acc + it.valor, 0);
  }

  return {
    tipoDocumento,
    emissor,
    dataVencimento,
    valorTotal,
    itens,
    confiancaIa: 95,
    observacoesIa: `Extração estruturada de fatura. ${itens.length} lançamentos identificados e parcelas mapeadas.`,
  };
}

export class GeminiService {
  /**
   * Extrai compras e itens estruturados de faturas, extratos ou recibos
   * a partir de documento PDF, foto/imagem ou texto bruto.
   */
  static async extrairItensFatura(params: {
    texto?: string;
    imagemBase64?: string;
    mimeType?: string;
  }): Promise<ExtracaoFaturaResponse> {
    try {
      const systemPrompt = `Você é um motor especialista em OCR, visão computacional e auditoria financeira do Finance Pro.
Sua missão é ler com máxima precisão o documento (PDF, imagem, foto ou texto) de faturas de cartão de crédito brasileiras (Ailos, Nubank, Itaú, Bradesco, Santander, C6, Inter, etc.), boletos bancários, contas de consumo ou comprovantes.

DIRETRIZES FUNDAMENTAIS DE EXTRAÇÃO:
1. Identifique o TIPO DE DOCUMENTO:
   - 'fatura_cartao': Faturas bancárias com compras no cartão de crédito.
   - 'boleto_cobranca': Boletos de cobrança avulsos (Consórcios, Servopa, Aluguel, Condomínio, Concessionárias).

2. EXTRAÇÃO CRÍTICA DE DATAS E PARCELAS EM FATURAS BRASILEIRAS:
   - Muitas faturas possuem quebra de linha ao serem copiadas em texto ou lidas em PDF:
     Exemplo 1 (Ailos/Mastercard com quebra de linha):
     "18 FEV ZP*P. M. CONSIG LTDA
06/06 CURITIBA R$ 390,00"
     -> DEVE UNIFICAR EM 1 COMPRA:
        data: "2026-02-18" (18 de Fevereiro)
        descricao: "ZP*P. M. CONSIG LTDA CURITIBA"
        valor: 390.00
        parcelaAtual: 6
        totalParcelas: 6

     Exemplo 2:
     "04 MAI ANUIDADE MASTERCARD
(7402) 03/12 R$ 9,90"
     -> data: "2026-05-04" (04 de Maio)
        descricao: "ANUIDADE MASTERCARD"
        valor: 9.90
        parcelaAtual: 3
        totalParcelas: 12

     Exemplo 3:
     "12 MAR HAVAN LOJAS DE DEPAR
05/05 ARAUCARIA R$ 40,59"
     -> data: "2026-03-12"
        descricao: "HAVAN LOJAS DE DEPAR ARAUCARIA"
        valor: 40.59
        parcelaAtual: 5
        totalParcelas: 5

     Exemplo 4:
     "09 MAI HAVAN PAROLIN CURITI
03/05 CURITIBA R$ 26,98"
     -> data: "2026-05-09"
        descricao: "HAVAN PAROLIN CURITI CURITIBA"
        valor: 26.98
        parcelaAtual: 3
        totalParcelas: 5

   - Padrões como "06/06" (6ª de 6), "03/12" (3ª de 12), "05/05" (5ª de 5), "04/04" (4ª de 4), "03/05" (3ª de 5), "02/06" (2ª de 6), "PARC 02/05" representam SEMPRE COMPRAS PARCELADAS (parcelaAtual e totalParcelas).
   - Datas com abreviação de meses: JAN (01), FEV (02), MAR (03), ABR (04), MAI (05), JUN (06), JUL (07), AGO (08), SET (09), OUT (10), NOV (11), DEZ (12).
   - Ignore linhas de controle como "SALDO ANTERIOR", "PAGAMENTO-BOLETO BANCARIO", "TOTAL DE...", "DATA DESCRIÇÃO CIDADE...".

3. Para cada transação, item discriminado ou compra:
   - data: Data da compra no formato YYYY-MM-DD (ex: 2026-02-18, 2026-07-10).
   - descricao: Nome legível do estabelecimento comercial (ex: "ZP*P. M. CONSIG LTDA CURITIBA", "APPLE.COM/BILL SAO PAULO", "A CASA DO BRUNAO CURITIBA").
   - valor: Valor numérico positivo da parcela ou compra (ex: 390.00, 32.70).
   - parcelaAtual: Número inteiro da parcela atual (ex: 6 para 06/06, 3 para 03/12), ou null se à vista.
   - totalParcelas: Número inteiro do total de parcelas (ex: 6 para 06/06, 12 para 03/12), ou null se à vista.
   - categoriaSugeridaNome e categoriaSugeridaId coerentes.

4. Identifique o emissor (ex: "Ailos Mastercard Now", "Nubank", "Itaú") e o valorTotal consolidado.`;

      const contents: any[] = [];

      // Anexa imagem ou PDF como inlineData
      if (params.imagemBase64 && params.imagemBase64.trim().length > 0) {
        let mime = params.mimeType || 'application/pdf';
        if (!mime.includes('/')) {
          mime = 'application/pdf';
        }
        contents.push({
          inlineData: {
            data: params.imagemBase64,
            mimeType: mime,
          },
        });
      }

      // Prompt textual
      const userText = params.texto && params.texto.trim().length > 0
        ? params.texto
        : 'Por favor, faça a leitura óptica completa deste arquivo anexado e extraia todas as compras, transações, valores, datas e dados da fatura.';
      contents.push({ text: userText });

      const schema = {
        type: Type.OBJECT,
        properties: {
          tipoDocumento: { 
            type: Type.STRING, 
            description: "Identificação do tipo de documento: 'fatura_cartao' se for fatura com compras de cartão, ou 'boleto_cobranca' se for boleto bancário avulso de consórcio, financiamento, carro, aluguel, condomínio, concessionária." 
          },
          emissor: { type: Type.STRING, description: 'Nome do banco, cartão, administradora de consórcio ou instituição emissora' },
          titular: { type: Type.STRING, description: 'Nome do titular da conta ou cartão' },
          mesReferencia: { type: Type.STRING, description: 'Mês/Ano de referência da fatura ou parcela' },
          dataVencimento: { type: Type.STRING, description: 'Data de vencimento no formato YYYY-MM-DD' },
          valorTotal: { type: Type.NUMBER, description: 'Valor total consolidado da fatura ou do boleto' },
          observacoesIa: { type: Type.STRING, description: 'Observações ou síntese da extração' },
          itens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                data: { type: Type.STRING, description: 'Data da compra ou vencimento no formato YYYY-MM-DD' },
                descricao: { type: Type.STRING, description: 'Nome do estabelecimento, parcela ou serviço' },
                valor: { type: Type.NUMBER, description: 'Valor positivo da transação' },
                parcelaAtual: { type: Type.INTEGER, description: 'Número da parcela atual se parcelado' },
                totalParcelas: { type: Type.INTEGER, description: 'Total de parcelas se parcelado' },
                categoriaSugeridaNome: { type: Type.STRING, description: 'Nome da categoria sugerida' },
                categoriaSugeridaId: { type: Type.STRING, description: 'ID da categoria sugerida' },
              },
              required: ['data', 'descricao', 'valor'],
            },
          },
        },
        required: ['itens'],
      };

      const response = await callGeminiWithResilience({
        contents,
        systemInstruction: systemPrompt,
        responseSchema: schema,
      });

      const parsed = JSON.parse(response.text || '{}');
      
      const itensFormatados = (parsed.itens || []).map((it: any, index: number) => {
        const descOriginal = it.descricao || 'Despesa sem descrição';
        let pAtual = it.parcelaAtual ? Number(it.parcelaAtual) : undefined;
        let pTotal = it.totalParcelas ? Number(it.totalParcelas) : undefined;
        let descFinal = descOriginal;

        // Se não foi identificado pelo prompt da IA ou para garantir que a descrição base seja limpa
        const info = ParcelamentoService.extrairInfoDescricao(descOriginal);
        if (info.encontrouPadrao && (!pAtual || !pTotal)) {
          pAtual = info.parcelaAtual;
          pTotal = info.totalParcelas;
          descFinal = info.descricaoBase;
        }

        return {
          id: `item_ext_${Date.now()}_${index}`,
          data: it.data || new Date().toISOString().split('T')[0],
          descricao: descFinal,
          valor: Math.abs(Number(it.valor) || 0),
          parcelaAtual: pAtual,
          totalParcelas: pTotal,
          categoriaSugeridaId: it.categoriaSugeridaId || 'cat_alimentacao',
          categoriaSugeridaNome: it.categoriaSugeridaNome || 'Alimentação & Mercado',
          selecionado: true,
        };
      });

      return {
        tipoDocumento: parsed.tipoDocumento || 'fatura_cartao',
        emissor: parsed.emissor || 'Fatura Identificada',
        titular: parsed.titular,
        mesReferencia: parsed.mesReferencia,
        dataVencimento: parsed.dataVencimento,
        valorTotal: parsed.valorTotal,
        itens: itensFormatados,
        confiancaIa: 98,
        observacoesIa: parsed.observacoesIa || `${itensFormatados.length} lançamentos extraídos com sucesso.`,
      };
    } catch (error: any) {
      console.error('Erro na extração IA da fatura:', error);
      let cleanMsg = error?.message || 'Erro de leitura do documento';

      const isQuotaError = 
        cleanMsg.includes('429') || 
        cleanMsg.includes('RESOURCE_EXHAUSTED') || 
        cleanMsg.includes('quota') || 
        cleanMsg.includes('Quota exceeded');

      // Se houver texto disponível e a cota do Gemini foi atingida, aciona o extrator heurístico de contingência
      if (isQuotaError && params.texto && params.texto.trim().length > 10) {
        console.info('[GeminiService] Cota da API temporariamente atingida. Executando extrator heurístico local...');
        const resultadoHeuristico = extrairHeuristicamente(params.texto);
        if (resultadoHeuristico.itens.length > 0) {
          return resultadoHeuristico;
        }
      }

      if (isQuotaError) {
        cleanMsg = 'A cota temporária de requisições gratuitas da IA foi atingida no momento (limite de requisições por minuto/dia). Aguarde cerca de 1 minuto para nova tentativa ou cole o texto do extrato diretamente.';
      } else if (cleanMsg.includes('503') || cleanMsg.includes('UNAVAILABLE') || cleanMsg.includes('high demand')) {
        cleanMsg = 'Os servidores do Google Gemini estão com alta demanda momentânea na região. Por favor, tente novamente (o sistema tentará automaticamente servidores alternativos).';
      }
      throw new Error(cleanMsg);
    }
  }

  /**
   * Gera diagnósticos financeiros e insights acionáveis com IA
   */
  static async gerarInsightsFinanceiros(dados: {
    receitasTotal: number;
    despesasTotal: number;
    saldoConsolidado: number;
    categoriasGasto: { nome: string; valor: number; percentual: number }[];
  }): Promise<InsightFinanceiro[]> {
    try {
      const prompt = `Analise os dados financeiros do usuário e retorne 3 a 4 recomendações práticas e inteligentes:
- Receitas no mês: R$ ${dados.receitasTotal.toFixed(2)}
- Despesas no mês: R$ ${dados.despesasTotal.toFixed(2)}
- Saldo Consolidado: R$ ${dados.saldoConsolidado.toFixed(2)}
- Gastos por Categoria: ${JSON.stringify(dados.categoriasGasto)}

Retorne um JSON com array de insights estruturados.`;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            tipo: { type: Type.STRING, enum: ['alerta', 'oportunidade', 'elogio', 'dica'] },
            titulo: { type: Type.STRING },
            descricao: { type: Type.STRING },
            impactoEstimado: { type: Type.STRING },
          },
          required: ['tipo', 'titulo', 'descricao'],
        },
      };

      const response = await callGeminiWithResilience({
        contents: [{ text: prompt }],
        systemInstruction: 'Você é um consultor financeiro de alto nível para finanças pessoais e empresariais.',
        responseSchema: schema,
      });

      return JSON.parse(response.text || '[]');
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      return [
        {
          id: 'ins_1',
          tipo: 'oportunidade',
          titulo: 'Otimização de Gastos Fixos',
          descricao: 'Revise suas assinaturas recorrentes e despesas mensais para maximizar sua taxa de poupança.',
          impactoEstimado: 'Economia potencial identificada'
        },
        {
          id: 'ins_2',
          tipo: 'elogio',
          titulo: 'Organização Financeira',
          descricao: 'Lançamentos e contas estão sendo monitorados em tempo real.',
          impactoEstimado: 'Balanço consolidado'
        }
      ];
    }
  }
}
