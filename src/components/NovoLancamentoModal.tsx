/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Layers, 
  Repeat, 
  FileText, 
  Calendar, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { Conta, CartaoCredito, Categoria, FrequenciaRecorrencia, TipoLancamento } from '../types';
import { LancamentoService } from '../services/domain/lancamento.service';
import { RecorrenciaService } from '../services/domain/recorrencia.service';

interface NovoLancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contas: Conta[];
  cartoes: CartaoCredito[];
  categorias: Categoria[];
  onCriarSimples: (dto: any) => void;
  onCriarParcelado: (dto: any) => void;
  onCriarRecorrente: (dto: any) => void;
}

export const NovoLancamentoModal: React.FC<NovoLancamentoModalProps> = ({
  isOpen,
  onClose,
  contas,
  cartoes,
  categorias,
  onCriarSimples,
  onCriarParcelado,
  onCriarRecorrente,
}) => {
  const hoje = new Date().toISOString().split('T')[0];

  // Mode: 'simples' | 'parcelado' | 'recorrente'
  const [modo, setModo] = useState<'simples' | 'parcelado' | 'recorrente'>('simples');
  
  // Common Form State
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id || 'cat_alimentacao');
  const [meioPagamento, setMeioPagamento] = useState<'conta' | 'cartao'>('conta');
  const [contaId, setContaId] = useState(contas[0]?.id || '');
  const [cartaoId, setCartaoId] = useState(cartoes[0]?.id || '');
  const [dataCompetencia, setDataCompetencia] = useState(hoje);
  const [dataVencimento, setDataVencimento] = useState(hoje);
  const [status, setStatus] = useState<'pago' | 'pendente'>('pendente');
  const [observacoes, setObservacoes] = useState('');

  // Parcelado State
  const [totalParcelas, setTotalParcelas] = useState(3);

  // Recorrente State
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>('mensal');
  const [ajustaFimMes, setAjustaFimMes] = useState(true);

  // Computed Installment Simulation
  const parcelasSimuladas = useMemo(() => {
    const v = parseFloat(valor) || 0;
    if (v <= 0 || totalParcelas <= 1) return [];

    const valores = LancamentoService.calcularDivisaoParcelas(v, totalParcelas);
    const datas = RecorrenciaService.gerarProjecaoDatas(dataVencimento, 'mensal', totalParcelas);

    return valores.map((val, idx) => ({
      numero: idx + 1,
      total: totalParcelas,
      valor: val,
      data: datas[idx] || dataVencimento,
    }));
  }, [valor, totalParcelas, dataVencimento]);

  // Computed Recurring Projection
  const projecaoRecorrencia = useMemo(() => {
    return RecorrenciaService.gerarProjecaoDatas(dataVencimento, frequencia, 4);
  }, [dataVencimento, frequencia]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor);
    if (!descricao || isNaN(valorNum) || valorNum <= 0) return;

    const baseDTO = {
      tipo,
      descricao,
      valor: valorNum,
      categoriaId,
      contaId: meioPagamento === 'conta' ? contaId : undefined,
      cartaoId: meioPagamento === 'cartao' ? cartaoId : undefined,
      dataCompetencia,
      dataVencimento,
      status,
      observacoes,
    };

    if (modo === 'simples') {
      onCriarSimples(baseDTO);
    } else if (modo === 'parcelado') {
      onCriarParcelado({
        ...baseDTO,
        numeroParcelas: totalParcelas,
      });
    } else if (modo === 'recorrente') {
      const [, , diaOriginal] = dataVencimento.split('-').map(Number);
      onCriarRecorrente({
        ...baseDTO,
        recorrencia: {
          frequencia,
          diaVencimento: diaOriginal,
          ajustaFimMes,
        },
      });
    }

    onClose();
  };

  return (
    <div id="modal-novo-lancamento" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div>
            <h2 className="text-lg font-bold text-white">Criar Novo Lançamento</h2>
            <p className="text-xs text-slate-400">Motor de regras do Finance Pro</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setModo('simples')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              modo === 'simples'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Simples</span>
          </button>

          <button
            type="button"
            onClick={() => { setModo('parcelado'); setMeioPagamento('cartao'); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              modo === 'parcelado'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Parcelado (Nx)</span>
          </button>

          <button
            type="button"
            onClick={() => setModo('recorrente')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              modo === 'recorrente'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Recorrente</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Tipo (Receita vs Despesa) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('despesa')}
              className={`py-2 rounded-xl font-semibold transition-all ${
                tipo === 'despesa'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-950/50 text-slate-400 border border-slate-800'
              }`}
            >
              - Despesa (Saída)
            </button>
            <button
              type="button"
              onClick={() => setTipo('receita')}
              className={`py-2 rounded-xl font-semibold transition-all ${
                tipo === 'receita'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-slate-950/50 text-slate-400 border border-slate-800'
              }`}
            >
              + Receita (Entrada)
            </button>
          </div>

          {/* Descrição & Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-slate-300 font-medium">Descrição *</label>
              <input
                id="input-form-descricao"
                type="text"
                required
                placeholder="Ex: Compra Mercado, Aluguel, Consultoria..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Valor Total (R$) *</label>
              <input
                id="input-form-valor"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Categoria</label>
            <select
              id="select-form-categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {categorias
                .filter((c) => (tipo === 'receita' ? c.tipo === 'receita' : c.tipo === 'despesa'))
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
            </select>
          </div>

          {/* Meio de Pagamento (Conta vs Cartão) */}
          <div className="space-y-2">
            <label className="text-slate-300 font-medium">Forma de Pagamento / Origem</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMeioPagamento('conta')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  meioPagamento === 'conta'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Conta Bancária</span>
              </button>

              <button
                type="button"
                onClick={() => setMeioPagamento('cartao')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  meioPagamento === 'cartao'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 font-semibold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Cartão de Crédito</span>
              </button>
            </div>

            {meioPagamento === 'conta' ? (
              <select
                id="select-form-conta"
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 mt-1"
              >
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (Saldo: R$ {c.saldoAtual.toFixed(2)})
                  </option>
                ))}
              </select>
            ) : (
              <select
                id="select-form-cartao"
                value={cartaoId}
                onChange={(e) => setCartaoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 mt-1"
              >
                {cartoes.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.nome} (Limite Disp: R$ {car.limiteDisponivel.toFixed(2)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Competência</label>
              <input
                id="input-form-competencia"
                type="date"
                value={dataCompetencia}
                onChange={(e) => setDataCompetencia(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Vencimento Base</label>
              <input
                id="input-form-vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* CONFIGURAÇÃO ESPECÍFICA: PARCELADO */}
          {modo === 'parcelado' && (
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Divisão de Parcelas
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total de Vezes:</span>
                  <select
                    id="select-form-parcelas"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-950 border border-indigo-700/50 rounded-lg text-indigo-200 font-bold"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24, 36, 48].map((n) => (
                      <option key={n} value={n}>
                        {n}x parcelas
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {parcelasSimuladas.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] text-slate-400">Simulação de rateio com acerto de centavos na 1ª parcela:</p>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {parcelasSimuladas.map((p) => (
                      <div key={p.numero} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 text-[11px] font-mono">
                        <span className="text-slate-300">Parcela {p.numero}/{p.total} • Venc: {p.data.split('-').reverse().join('/')}</span>
                        <span className="text-indigo-300 font-bold">R$ {p.valor.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONFIGURAÇÃO ESPECÍFICA: RECORRENTE */}
          {modo === 'recorrente' && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Repeat className="w-4 h-4" />
                  Regras de Recorrência
                </span>
                <select
                  id="select-form-frequencia"
                  value={frequencia}
                  onChange={(e) => setFrequencia(e.target.value as any)}
                  className="px-2.5 py-1 bg-slate-950 border border-amber-700/50 rounded-lg text-amber-200 font-medium"
                >
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                  <option value="bimestral">Bimestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-[11px]">
                <input
                  type="checkbox"
                  checked={ajustaFimMes}
                  onChange={(e) => setAjustaFimMes(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Ajustar automaticamente datas em meses com menos de 31 dias (ex: 28 de Fev)</span>
              </label>

              <div className="pt-1">
                <span className="text-[11px] text-slate-400">Projeção das próximas ocorrências calculadas:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {projecaoRecorrencia.map((dt, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-950 text-amber-300 font-mono text-[10px]">
                      {dt.split('-').reverse().join('/')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Status Inicial */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="font-semibold text-slate-200 block">Status de Liquidação</span>
              <span className="text-[11px] text-slate-400">
                {status === 'pago' ? 'Já foi pago/recebido (atualizará saldo da conta imediatamente)' : 'Ficará como pendente até a data'}
              </span>
            </div>
            <button
              type="button"
              id="toggle-status-pago"
              onClick={() => setStatus(status === 'pago' ? 'pendente' : 'pago')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                status === 'pago'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {status === 'pago' ? 'Pago / Recebido' : 'Pendente'}
            </button>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancelar
            </button>

            <button
              id="btn-submit-novo-lancamento"
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold shadow-lg shadow-emerald-950/50 transition-all"
            >
              Criar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
