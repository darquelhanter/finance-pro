/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  ArrowRight, 
  Layers, 
  Trash2, 
  Edit2, 
  FileCheck,
  RefreshCw,
  Zap,
  Info
} from 'lucide-react';
import { CartaoCredito, Categoria, ImportacaoFaturaItem, ExtracaoFaturaResponse } from '../types';
import { formatarMoeda } from '../utils/format';

interface ImportacaoFaturaViewProps {
  cartoes?: CartaoCredito[];
  categorias?: Categoria[];
  onImportarLote: (cartaoId: string, faturaId: string, itens: ImportacaoFaturaItem[]) => Promise<void>;
  onNavigateTab: (tab: string) => void;
}

const EXEMPLOS_FATURA = [
  {
    nome: 'Fatura Nubank (Exemplo Real)',
    texto: `FATURA NUBANK - MASTERCARD BLACK
Titular: Gabriel Santos
Vencimento: 05/09/2026
Valor Total: R$ 1.847,90

Lançamentos:
12/08/2026 - IFOOD *RESTAURANTE - R$ 89,40
14/08/2026 - POSTO IPIRANGA COMBUSTIVEL - R$ 220,00
16/08/2026 - AMAZON.COM.BR LIVROS - R$ 145,00
18/08/2026 - NETFLIX.COM MENSALIDADE - R$ 55,90
20/08/2026 - DROGASIL FARMACIA - R$ 98,50
22/08/2026 - ZARA BRASIL (02/05) - R$ 239,10
24/08/2026 - SAM'S CLUB MERCADO - R$ 1.000,00`
  },
  {
    nome: 'Extrato Itaú Cartão (Exemplo)',
    texto: `Extrato Cartão Itaú Visa Infinite
Vencimento: 22/08/2026
Total Fatura: R$ 3.120,45

02/08 - APPLE STORE BR (03/10) R$ 849,90
05/08 - UBER *TRIP SAO PAULO R$ 38,70
08/08 - SUPERMERCADO ST MARCHE R$ 412,30
11/08 - HOSP SAMARITANO CONSULTA R$ 650,00
15/08 - KALUNGA MATERIAL ESCRITORIO R$ 189,55
19/08 - RESTAURANTE FASANO R$ 980,00`
  }
];

export const ImportacaoFaturaView: React.FC<ImportacaoFaturaViewProps> = ({
  cartoes = [],
  categorias = [],
  onImportarLote,
  onNavigateTab,
}) => {
  const [faturaTexto, setFaturaTexto] = useState(EXEMPLOS_FATURA[0].texto);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState(cartoes[0]?.id || '');
  
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [resultadoExtracao, setResultadoExtracao] = useState<ExtracaoFaturaResponse | null>(null);
  const [itensParaImportar, setItensParaImportar] = useState<ImportacaoFaturaItem[]>([]);
  const [sucessoImportacao, setSucessoImportacao] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagemPreview(result);
      // Remove data:image/...;base64, prefix for API
      const base64Data = result.split(',')[1];
      setImagemBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessarIa = async () => {
    setCarregandoIa(true);
    setErroMsg(null);
    setSucessoImportacao(false);

    try {
      const res = await fetch('/api/ia/extrair-fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: faturaTexto,
          imagemBase64: imagemBase64 || undefined,
        }),
      });

      if (!res.ok) throw new Error('Falha ao processar fatura com a IA');
      const data: ExtracaoFaturaResponse = await res.json();
      setResultadoExtracao(data);
      setItensParaImportar(data.itens || []);
    } catch (err: any) {
      setErroMsg(err.message || 'Erro inesperado na extração');
    } finally {
      setCarregandoIa(false);
    }
  };

  const toggleSelecionarItem = (id: string) => {
    setItensParaImportar((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selecionado: !it.selecionado } : it))
    );
  };

  const handleUpdateItemCategoria = (id: string, catId: string) => {
    const cat = (categorias || []).find((c) => c.id === catId);
    setItensParaImportar((prev) =>
      prev.map((it) => (it.id === id ? { ...it, categoriaSugeridaId: catId, categoriaSugeridaNome: cat?.nome } : it))
    );
  };

  const handleConfirmarImportacao = async () => {
    const targetCartao = cartaoSelecionadoId || cartoes[0]?.id;
    if (!targetCartao || itensParaImportar.length === 0) return;
    setCarregandoIa(true);
    try {
      await onImportarLote(targetCartao, 'fat_nubank_atual', itensParaImportar);
      setSucessoImportacao(true);
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao importar itens');
    } finally {
      setCarregandoIa(false);
    }
  };

  const totalSelecionado = itensParaImportar
    .filter((i) => i.selecionado)
    .reduce((acc, i) => acc + (typeof i.valor === 'number' && !isNaN(i.valor) ? i.valor : 0), 0);

  return (
    <div id="importacao-fatura-view" className="space-y-6 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-indigo-950/60 p-6 rounded-2xl border border-teal-800/40 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>OCR & Extração Inteligente Gemini 3.7 Flash</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Importação Automatizada de Fatura & Comprovantes
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Cole o texto do extrato/fatura ou faça upload do comprovante. A inteligência artificial identificará cada compra, data, valor, parcelamento e categoria sugerida com isolamento de erro por item.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Cartão Destino:</span>
            <select
              id="select-cartao-importacao"
              value={cartaoSelecionadoId || (cartoes[0]?.id || '')}
              onChange={(e) => setCartaoSelecionadoId(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-teal-500"
            >
              {cartoes.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.nome} (•••• {car.ultimosDigitos})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input / Upload Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Paste / Upload (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-400" />
                Texto da Fatura ou Extrato
              </span>

              {/* Sample Switcher */}
              <div className="flex items-center gap-1">
                {EXEMPLOS_FATURA.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { setFaturaTexto(ex.texto); setImagemPreview(null); setImagemBase64(null); }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                  >
                    Exemplo {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="textarea-fatura-texto"
              rows={9}
              placeholder="Cole aqui o texto da fatura copiado do app do seu banco (Nubank, Itaú, C6, etc.)..."
              value={faturaTexto}
              onChange={(e) => setFaturaTexto(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500/50 resize-none"
            ></textarea>

            {/* File upload alternative */}
            <div className="border border-dashed border-slate-700/80 rounded-xl p-3 bg-slate-950/40 text-center">
              <input
                type="file"
                id="file-upload-fatura"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="file-upload-fatura" className="cursor-pointer flex flex-col items-center justify-center gap-1">
                <UploadCloud className="w-5 h-5 text-teal-400" />
                <span className="text-xs text-slate-300 font-medium">Ou clique para anexar imagem / foto da fatura</span>
                <span className="text-[10px] text-slate-500">PNG, JPG, PDF até 10MB</span>
              </label>
              {imagemPreview && (
                <div className="mt-2 text-xs text-emerald-400 flex items-center justify-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Imagem carregada e pronta para OCR
                </div>
              )}
            </div>
          </div>

          <button
            id="btn-processar-fatura-ia"
            onClick={handleProcessarIa}
            disabled={carregandoIa || (!faturaTexto && !imagemBase64)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-500 hover:from-teal-500 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-950/50 transition-all cursor-pointer"
          >
            {carregandoIa ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processando itens com IA Gemini 3.7...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Extrair & Estruturar Lançamentos com IA</span>
              </>
            )}
          </button>
        </div>

        {/* Right Panel: Extracted Items Table (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Lançamentos Detectados
              </h2>
              {resultadoExtracao && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Emissor: <span className="text-slate-200 font-semibold">{resultadoExtracao.emissor}</span> • {resultadoExtracao.itens?.length || 0} itens extraídos
                </p>
              )}
            </div>

            {itensParaImportar.length > 0 && (
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Selecionado:</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {formatarMoeda(totalSelecionado)}
                </span>
              </div>
            )}
          </div>

          {/* Body Table / Empty State */}
          <div className="flex-1 my-3 overflow-y-auto max-h-[360px] pr-1">
            {itensParaImportar.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Sparkles className="w-10 h-10 mx-auto text-slate-700" />
                <p className="text-xs text-slate-400">Nenhum item extraído ainda.</p>
                <p className="text-[11px] text-slate-500">Clique em "Extrair & Estruturar Lançamentos com IA" para analisar o texto ou imagem da fatura.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 space-y-1">
                {itensParaImportar.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      item.selecionado ? 'bg-slate-950/60' : 'opacity-40 bg-slate-950/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        onChange={() => toggleSelecionarItem(item.id)}
                        className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-xs truncate flex items-center gap-1.5">
                          <span>{item.descricao}</span>
                          {item.parcelaAtual && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                              {item.parcelaAtual}/{item.totalParcelas}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{item.data ? item.data.split('-').reverse().join('/') : '-'}</span>
                          <span>•</span>
                          <select
                            value={item.categoriaSugeridaId}
                            onChange={(e) => handleUpdateItemCategoria(item.id, e.target.value)}
                            className="bg-slate-900 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 focus:outline-none"
                          >
                            {(categorias || []).filter(c => c.tipo === 'despesa').map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono font-bold text-xs text-rose-400">
                      - {formatarMoeda(item.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Success Banner */}
          {sucessoImportacao && (
            <div className="p-3 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Lançamentos importados com sucesso para o cartão!
              </span>
              <button 
                onClick={() => onNavigateTab('lancamentos')}
                className="underline font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Ver Lançamentos
              </button>
            </div>
          )}

          {/* Error Banner */}
          {erroMsg && (
            <div className="p-3 mb-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{erroMsg}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {itensParaImportar.filter(i => i.selecionado).length} de {itensParaImportar.length} selecionados
            </span>

            <button
              id="btn-confirmar-importacao-lote"
              onClick={handleConfirmarImportacao}
              disabled={carregandoIa || itensParaImportar.filter(i => i.selecionado).length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar & Importar para o Cartão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
