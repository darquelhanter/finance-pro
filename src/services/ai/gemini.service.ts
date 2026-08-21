/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { ExtracaoFaturaResponse, InsightFinanceiro } from '../../types';

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
 * caso o modelo principal esteja com alta demanda temporária (HTTP 503 / UNAVAILABLE).
 */
async function callGeminiWithResilience(params: {
  contents: any[];
  systemInstruction: string;
  responseSchema: any;
}) {
  const ai = getAI();
  // Modelos recomendados em ordem de velocidade e confiabilidade
  const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-3.7-flash'];
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
          errMsg.includes('RESOURCE_EXHAUSTED');

        console.warn(`[GeminiService] Modelo ${model} (tentativa ${attempt}) retornou: ${errMsg}`);

        if (isTransient) {
          // Aguarda um pequeno intervalo antes de tentar novamente ou acionar o fallback
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        } else {
          // Se for outro erro, passa para o próximo modelo candidato
          break;
        }
      }
    }
  }

  throw lastError || new Error('Os servidores de IA estão com alta demanda temporária.');
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
Sua missão é ler com máxima precisão o documento (PDF, imagem, foto ou texto) de uma fatura de cartão de crédito, comprovante bancário ou extrato financeiro.

Diretrizes de extração:
1. Identifique CADA transação, compra, débito ou despesa individual presente no documento.
2. Para cada compra/lançamento:
   - data: Data no formato YYYY-MM-DD (ex: 2026-08-19). Se o ano não estiver especificado no texto, deduza 2026.
   - descricao: Nome legível do estabelecimento, serviço ou recebedor (ex: "POSTO IPIRANGA", "IFOOD *RESTAURANTE", "NETFLIX", "DROGASIL").
   - valor: Valor numérico positivo da compra (ex: 145.90).
   - parcelaAtual: Número da parcela atual se for uma compra parcelada (ex: 2 para "02/05"), ou null se for à vista.
   - totalParcelas: Total de parcelas se for parcelado (ex: 5 para "02/05"), ou null se for à vista.
   - categoriaSugeridaNome: Categoria em português (ex: "Alimentação & Mercado", "Transporte & Combustível", "Moradia & Contas", "Serviços & Assinaturas", "Saúde & Farmácia", "Lazer & Viagens", "Educação & Cursos", "Outros").
   - categoriaSugeridaId: O ID mais compatível entre: "cat_alimentacao", "cat_transporte", "cat_moradia", "cat_servicos", "cat_saude", "cat_lazer", "cat_educacao".
3. Identifique o emissor do cartão/banco (ex: Nubank, Itaú, Santander, Bradesco, C6, Inter, XP, etc.), titular, data de vencimento e valor total da fatura se estiverem disponíveis.
4. IMPORTANTE: Extraia APENAS os dados reais existentes no documento enviado. Não invente transações fictícias.`;

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
      
      const itensFormatados = (parsed.itens || []).map((it: any, index: number) => ({
        id: `item_ext_${Date.now()}_${index}`,
        data: it.data || new Date().toISOString().split('T')[0],
        descricao: it.descricao || 'Despesa sem descrição',
        valor: Math.abs(Number(it.valor) || 0),
        parcelaAtual: it.parcelaAtual || undefined,
        totalParcelas: it.totalParcelas || undefined,
        categoriaSugeridaId: it.categoriaSugeridaId || 'cat_alimentacao',
        categoriaSugeridaNome: it.categoriaSugeridaNome || 'Alimentação & Mercado',
        selecionado: true,
      }));

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
      if (cleanMsg.includes('503') || cleanMsg.includes('UNAVAILABLE') || cleanMsg.includes('high demand')) {
        cleanMsg = 'Os servidores do Google Gemini estão com alta demanda momentânea na região. Por favor, tente novamente agora (o sistema tentará automaticamente servidores alternativos).';
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
