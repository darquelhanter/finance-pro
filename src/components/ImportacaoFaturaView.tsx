/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  FileCheck,
  RefreshCw,
  File as FileIcon,
  X,
  Send,
  Calendar,
  DollarSign,
  Receipt
} from 'lucide-react';
import { CartaoCredito, Categoria, ImportacaoFaturaItem, ExtracaoFaturaResponse } from '../types';
import { formatarMoeda } from '../utils/format';

interface ImportacaoFaturaViewProps {
  cartoes?: CartaoCredito[];
  categorias?: Categoria[];
  onImportarLote: (
    cartaoId: string, 
    faturaId: string, 
    itens: ImportacaoFaturaItem[], 
    opcoes?: {
      tipoDocumento?: string;
      nomeEmissor?: string;
      dataVencimento?: string;
      criarContaPagar?: boolean;
      valorTotalFatura?: number;
      categoriaContaPagarId?: string;
    }
  ) => Promise<void>;
  onNavigateTab: (tab: string) => void;
}

const EXEMPLOS_FATURA = [
  {
    nome: 'Nubank (Exemplo)',
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
    nome: 'Itaú (Exemplo)',
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
  // Input method mode: 'arquivo' (default) or 'texto'
  const [modoEntrada, setModoEntrada] = useState<'arquivo' | 'texto'>('arquivo');
  
  // File upload states
  const [arquivoSelecionado, setArquivoSelecionado] = useState<{
    nome: string;
    tamanho: string;
    tipo: string;
  } | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Text state
  const [faturaTexto, setFaturaTexto] = useState('');
  
  // Target credit card
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState(cartoes[0]?.id || '');
  
  // IA Extraction states
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [importandoItens, setImportandoItens] = useState(false);
  const [resultadoExtracao, setResultadoExtracao] = useState<ExtracaoFaturaResponse | null>(null);
  const [itensParaImportar, setItensParaImportar] = useState<ImportacaoFaturaItem[]>([]);
  const [sucessoImportacao, setSucessoImportacao] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Contas a Pagar states
  const [tipoDocumento, setTipoDocumento] = useState<'fatura_cartao' | 'boleto_cobranca'>('fatura_cartao');
  const [criarContaPagar, setCriarContaPagar] = useState(true);
  const [dataVencimentoFatura, setDataVencimentoFatura] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [valorTotalContaPagar, setValorTotalContaPagar] = useState<string>('');
  const [categoriaContaPagarId, setCategoriaContaPagarId] = useState<string>('');

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const compressImageIfNeeded = (dataUrl: string, mime: string): Promise<{ base64: string; preview: string; mime: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1800;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            base64: dataUrl.split(',')[1] || '',
            preview: dataUrl,
            mime,
          });
          return;
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          base64: compressedDataUrl.split(',')[1] || '',
          preview: compressedDataUrl,
          mime: 'image/jpeg',
        });
      };
      img.onerror = () => {
        resolve({
          base64: dataUrl.split(',')[1] || '',
          preview: dataUrl,
          mime,
        });
      };
      img.src = dataUrl;
    });
  };

  const processarArquivo = (file: File) => {
    setErroMsg(null);
    setSucessoImportacao(false);
    setResultadoExtracao(null);
    setItensParaImportar([]);

    const fileNameLower = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg') || fileNameLower.endsWith('.png') || fileNameLower.endsWith('.webp');
    const isText = file.type.startsWith('text/') || fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.ofx');

    let detectedMime = file.type;
    if (!detectedMime || detectedMime === '') {
      if (isPdf) detectedMime = 'application/pdf';
      else if (fileNameLower.endsWith('.png')) detectedMime = 'image/png';
      else if (fileNameLower.endsWith('.webp')) detectedMime = 'image/webp';
      else detectedMime = 'image/jpeg';
    }

    setArquivoSelecionado({
      nome: file.name,
      tamanho: formatFileSize(file.size),
      tipo: isPdf ? 'PDF' : isImage ? 'Imagem' : 'Documento',
    });

    if (isText) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setFaturaTexto(text);
        setImagemPreview(null);
        setImagemBase64(null);
      };
      reader.readAsText(file);
    } else if (isImage) {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawDataUrl = reader.result as string;
        const compressed = await compressImageIfNeeded(rawDataUrl, detectedMime);
        setImagemPreview(compressed.preview);
        setImagemBase64(compressed.base64);
        setMimeType(compressed.mime);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagemPreview(null);
        const base64Data = result.split(',')[1] || '';
        setImagemBase64(base64Data);
        setMimeType(detectedMime);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processarArquivo(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processarArquivo(file);
  };

  const handleRemoverArquivo = () => {
    setArquivoSelecionado(null);
    setImagemPreview(null);
    setImagemBase64(null);
    setResultadoExtracao(null);
    setItensParaImportar([]);
    setErroMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEnviarParaIa = async () => {
    setCarregandoIa(true);
    setErroMsg(null);
    setSucessoImportacao(false);

    try {
      const payload: any = {};
      if (modoEntrada === 'arquivo' && imagemBase64) {
        payload.imagemBase64 = imagemBase64;
        payload.mimeType = mimeType;
        if (faturaTexto.trim()) payload.texto = faturaTexto;
      } else if (faturaTexto.trim()) {
        payload.texto = faturaTexto;
      } else if (imagemBase64) {
        payload.imagemBase64 = imagemBase64;
        payload.mimeType = mimeType;
      } else {
        throw new Error('Por favor, anexe um arquivo ou digite o texto da fatura.');
      }

      let res: Response;
      try {
        res = await fetch('/api/ia/extrair-fatura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (netErr: any) {
        throw new Error('Falha de conexão com o servidor. Verifique sua rede e tente novamente.');
      }

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch (jsonErr) {
          data = null;
        }
      } else {
        const rawText = await res.text();
        data = { error: rawText };
      }

      if (!res.ok) {
        let msg = data?.error || `Erro de processamento (HTTP ${res.status})`;
        if (typeof msg === 'string' && (msg.includes('upstream') || msg.includes('timeout') || res.status === 504 || res.status === 502)) {
          msg = 'O processamento levou mais tempo que o esperado. Tente reenviar ou cole o texto da fatura.';
        }
        throw new Error(msg);
      }

      if (!data) {
        throw new Error('O servidor não retornou dados estruturados válidos.');
      }
      
      setResultadoExtracao(data);
      const itemsList = data.itens || [];
      setItensParaImportar(itemsList);

      // Auto-detect destination card based on emissor or text
      const emissorLido = (data.emissor || '').trim();
      if (emissorLido) {
        const cartaoExistente = cartoes.find(c => 
          c.nome.toLowerCase().includes(emissorLido.toLowerCase()) || 
          emissorLido.toLowerCase().includes(c.nome.toLowerCase())
        );
        if (cartaoExistente) {
          setCartaoSelecionadoId(cartaoExistente.id);
        } else {
          setCartaoSelecionadoId(`novo_cartao__${emissorLido}`);
        }
      }

      // Auto-detect document type
      if (data.tipoDocumento === 'boleto_cobranca') {
        setTipoDocumento('boleto_cobranca');
      } else if (itemsList.length === 1) {
        const itemLower = (itemsList[0]?.descricao || '').toLowerCase();
        if (itemLower.includes('servopa') || itemLower.includes('consórcio') || itemLower.includes('consorcio') || itemLower.includes('boleto')) {
          setTipoDocumento('boleto_cobranca');
        } else {
          setTipoDocumento('fatura_cartao');
        }
      } else {
        setTipoDocumento('fatura_cartao');
      }

      // Auto pre-populate invoice due date and total
      if (data.dataVencimento) {
        setDataVencimentoFatura(data.dataVencimento);
      }
      if (data.valorTotal && !isNaN(Number(data.valorTotal))) {
        setValorTotalContaPagar(Number(data.valorTotal).toFixed(2));
      } else {
        const sum = itemsList.reduce((acc: number, it: any) => acc + (Number(it.valor) || 0), 0);
        setValorTotalContaPagar(sum > 0 ? sum.toFixed(2) : '');
      }

      if (!itemsList || itemsList.length === 0) {
        setErroMsg('A IA realizou a leitura mas não identificou transações ou despesas legíveis neste documento.');
      }
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

  const totalSelecionado = itensParaImportar
    .filter((i) => i.selecionado)
    .reduce((acc, i) => acc + (typeof i.valor === 'number' && !isNaN(i.valor) ? i.valor : 0), 0);

  // Sync total when items selection changes if not manually set
  useEffect(() => {
    if (itensParaImportar.length > 0 && (!valorTotalContaPagar || valorTotalContaPagar === '0.00')) {
      setValorTotalContaPagar(totalSelecionado.toFixed(2));
    }
  }, [totalSelecionado, itensParaImportar.length]);

  const handleConfirmarImportacao = async () => {
    const selecionados = itensParaImportar.filter((i) => i.selecionado);
    if (selecionados.length === 0) {
      setErroMsg('Por favor, marque pelo menos um lançamento para importar.');
      return;
    }

    const targetCartao = cartaoSelecionadoId || cartoes[0]?.id || 'cartao_auto';
    setImportandoItens(true);
    setErroMsg(null);

    const valorFinal = valorTotalContaPagar && !isNaN(Number(valorTotalContaPagar)) 
      ? Number(valorTotalContaPagar) 
      : totalSelecionado;

    try {
      await onImportarLote(
        targetCartao,
        'fat_atual',
        selecionados,
        {
          tipoDocumento: tipoDocumento,
          nomeEmissor: resultadoExtracao?.emissor || 'Cartão de Crédito',
          dataVencimento: dataVencimentoFatura,
          criarContaPagar: criarContaPagar,
          valorTotalFatura: valorFinal,
          categoriaContaPagarId: categoriaContaPagarId || undefined,
        }
      );
      setSucessoImportacao(true);
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao importar itens para o cartão.');
    } finally {
      setImportandoItens(false);
    }
  };

  const temArquivoPronto = Boolean(imagemBase64 || arquivoSelecionado);
  const temTextoPronto = Boolean(faturaTexto.trim().length > 10);
  const podeEnviar = (modoEntrada === 'arquivo' && temArquivoPronto) || (modoEntrada === 'texto' && temTextoPronto) || temArquivoPronto || temTextoPronto;

  return (
    <div id="importacao-fatura-view" className="space-y-6 pb-36 md:pb-12 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-indigo-950/60 p-6 rounded-2xl border border-teal-800/40 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>OCR & Leitor Inteligente de Faturas e Comprovantes</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Importação Automatizada por Inteligência Artificial
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Anexe uma foto do seu comprovante, fatura em PDF ou print de aplicativo. O motor Gemini lê as compras, gera os lançamentos detalhados e cria a Conta a Pagar com valor total e vencimento.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('lancamentos')}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              Ver Lançamentos & Contas a Pagar
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload (Left) + Results List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Input & Document Upload (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          
          <div className="space-y-4">
            
            {/* Input Mode Selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Origem do Documento
              </span>
              <div className="p-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setModoEntrada('arquivo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    modoEntrada === 'arquivo'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Foto / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModoEntrada('texto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    modoEntrada === 'texto'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Texto Copiado</span>
                </button>
              </div>
            </div>

            {/* TAB 1: FILE UPLOAD (DRAG & DROP + BUTTON) */}
            {modoEntrada === 'arquivo' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp,text/plain,.ofx,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="input-fatura-arquivo"
                />

                {!arquivoSelecionado ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? 'border-teal-400 bg-teal-500/10 scale-[1.01]'
                        : 'border-slate-800 hover:border-teal-500/50 bg-slate-950/50 hover:bg-slate-950'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mx-auto mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Clique para escolher ou arraste o arquivo aqui
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Suporta <b>PDF de faturas, prints de tela, fotos de comprovantes</b> (PNG, JPG, PDF até 15MB)
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
                      <span>Procurar no dispositivo</span>
                    </div>
                  </div>
                ) : (
                  /* File Attached Card */
                  <div className="bg-slate-950 border border-teal-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                          {imagemPreview ? (
                            <img src={imagemPreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <FileIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{arquivoSelecionado.nome}</p>
                          <p className="text-[11px] text-slate-400">{arquivoSelecionado.tamanho} • {arquivoSelecionado.tipo}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemoverArquivo}
                        title="Remover arquivo"
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Arquivo pronto! Clique em <b>Enviar e Extrair com IA</b> abaixo.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TEXT INPUT */}
            {modoEntrada === 'texto' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Texto do extrato ou fatura:</span>
                  <div className="flex items-center gap-1">
                    {EXEMPLOS_FATURA.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFaturaTexto(ex.texto)}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                      >
                        {ex.nome}
                      </button>
                    ))}
                    {faturaTexto && (
                      <button
                        type="button"
                        onClick={() => setFaturaTexto('')}
                        className="px-2 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-[10px] text-rose-300 transition-colors cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  id="textarea-fatura-texto"
                  rows={8}
                  placeholder="Cole aqui o texto copiado do app do seu banco ou fatura (Nubank, Itaú, Santander, C6, etc.)..."
                  value={faturaTexto}
                  onChange={(e) => setFaturaTexto(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500/50 resize-none"
                />
              </div>
            )}

          </div>

          {/* SEND BUTTON (PROMINENT AND CLEAR) */}
          <button
            id="btn-processar-fatura-ia"
            type="button"
            onClick={handleEnviarParaIa}
            disabled={carregandoIa || !podeEnviar}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-950/60 transition-all cursor-pointer mt-4"
          >
            {carregandoIa ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Processando Leitura com IA...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-slate-950" />
                <span>Enviar e Extrair Lançamentos com IA</span>
              </>
            )}
          </button>

        </div>

        {/* Right Panel: Extracted Items Table (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          
          {/* Header */}
          <div className="space-y-3 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Lançamentos Identificados
                </h2>
                {resultadoExtracao ? (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Emissor: <span className="text-teal-300 font-semibold">{resultadoExtracao.emissor}</span> • {resultadoExtracao.itens?.length || 0} compras encontradas
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Os itens identificados pela IA aparecerão aqui para conferência
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

            {/* Tipo de Documento: Fatura Cartão vs Boleto Avulso */}
            {itensParaImportar.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Classificação do Documento:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoDocumento('fatura_cartao')}
                    className={`p-2 rounded-lg text-left text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      tipoDocumento === 'fatura_cartao'
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-teal-400 shrink-0" />
                    <div>
                      <span className="block">Fatura de Cartão</span>
                      <span className="text-[10px] font-normal text-slate-400 block">Total a Pagar + Compras no Extrato</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoDocumento('boleto_cobranca')}
                    className={`p-2 rounded-lg text-left text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      tipoDocumento === 'boleto_cobranca'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Receipt className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <span className="block">Boleto / Consórcio / Carro</span>
                      <span className="text-[10px] font-normal text-slate-400 block">Conta a Pagar Real Direta</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Destination Card Selector Bar (only for credit card invoices) */}
            {itensParaImportar.length > 0 && tipoDocumento === 'fatura_cartao' && (
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="font-semibold">Cartão de destino dos lançamentos:</span>
                  </div>
                  {resultadoExtracao?.emissor && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
                      Detectado: {resultadoExtracao.emissor}
                    </span>
                  )}
                </div>
                
                <select
                  value={cartaoSelecionadoId || ''}
                  onChange={(e) => setCartaoSelecionadoId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {resultadoExtracao?.emissor && !cartoes.some(c => c.nome.toLowerCase().includes(resultadoExtracao.emissor.toLowerCase())) && (
                    <option value={`novo_cartao__${resultadoExtracao.emissor}`}>
                      ✨ Criar novo cartão exclusivo: {resultadoExtracao.emissor}
                    </option>
                  )}
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (Final {c.ultimosDigitos})
                    </option>
                  ))}
                  {(!cartoes || cartoes.length === 0) && (
                    <option value="cartao_auto">
                      {resultadoExtracao?.emissor ? `Criar Cartão: ${resultadoExtracao.emissor}` : 'Criar Cartão de Crédito'}
                    </option>
                  )}
                </select>

                <p className="text-[11px] text-slate-400">
                  💡 Os itens importados e a fatura consolidada serão associados <b>exclusivamente</b> ao cartão selecionado, mantendo outras faturas (como Ailos, Bradesco, etc.) totalmente separadas.
                </p>
              </div>
            )}

            {/* CONTAS A PAGAR CONFIGURATION SECTION */}
            {itensParaImportar.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-teal-500/30 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-teal-300">
                    <input
                      type="checkbox"
                      checked={criarContaPagar}
                      onChange={(e) => setCriarContaPagar(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span>Gerar registro em Contas a Pagar (Total da Fatura)</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                    Total: {formatarMoeda(Number(valorTotalContaPagar) || totalSelecionado)}
                  </span>
                </div>

                {criarContaPagar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                        <span>Data de Vencimento da Fatura:</span>
                      </label>
                      <input
                        type="date"
                        value={dataVencimentoFatura}
                        onChange={(e) => setDataVencimentoFatura(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Valor Total da Conta a Pagar:</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={valorTotalContaPagar}
                          onChange={(e) => setValorTotalContaPagar(e.target.value)}
                          placeholder={(totalSelecionado).toFixed(2)}
                          className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body Table / Empty State */}
          <div className="flex-1 my-2 overflow-y-auto max-h-[380px] pr-1">
            {carregandoIa ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-10 h-10 animate-spin text-teal-400 mx-auto" />
                <p className="text-sm font-bold text-white">Lendo arquivo e estruturando compras...</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  A IA Gemini está identificando datas, estabelecimentos, valores, parcelas e categorias.
                </p>
              </div>
            ) : itensParaImportar.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-3">
                <Sparkles className="w-12 h-12 mx-auto text-slate-700" />
                <p className="text-sm font-medium text-slate-300">Nenhum item extraído no momento</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Carregue um arquivo (PDF, foto do comprovante ou print) ao lado e clique no botão <b>"Enviar e Extrair Lançamentos com IA"</b>.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 space-y-1">
                {itensParaImportar.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      item.selecionado ? 'bg-slate-950/80 border border-slate-800' : 'opacity-40 bg-slate-950/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        onChange={() => toggleSelecionarItem(item.id)}
                        className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0 cursor-pointer w-4 h-4"
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
                            className="bg-slate-900 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700 focus:outline-none cursor-pointer"
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
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Lançamentos importados e <b>Conta a Pagar criada com vencimento em {dataVencimentoFatura.split('-').reverse().join('/')}</b>!
                </span>
              </span>
              <button 
                type="button"
                onClick={() => onNavigateTab('lancamentos')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
              >
                Ver em Contas a Pagar
              </button>
            </div>
          )}

          {/* Error Banner */}
          {erroMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{erroMsg}</span>
              </div>
              <button
                type="button"
                onClick={handleEnviarParaIa}
                disabled={carregandoIa}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-[11px] font-semibold text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Action Footer with Confirmation Button */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {itensParaImportar.filter(i => i.selecionado).length} de {itensParaImportar.length} compras selecionadas
            </span>

            <button
              id="btn-confirmar-importacao-lote"
              type="button"
              onClick={handleConfirmarImportacao}
              disabled={importandoItens || carregandoIa || itensParaImportar.filter(i => i.selecionado).length === 0}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer active:scale-95"
            >
              {importandoItens ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Importando & Gerando Conta a Pagar...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Confirmar & Gerar Conta a Pagar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
