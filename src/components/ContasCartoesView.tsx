/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  PlusCircle, 
  Landmark, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  X,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Conta, CartaoCredito } from '../types';
import { formatarMoeda } from '../utils/format';

interface ContasCartoesViewProps {
  contas?: Conta[];
  cartoes?: CartaoCredito[];
  onCriarConta: (conta: any) => void;
  onCriarCartao: (cartao: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ContasCartoesView: React.FC<ContasCartoesViewProps> = ({
  contas = [],
  cartoes = [],
  onCriarConta,
  onCriarCartao,
  onNavigateTab,
}) => {
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);

  // Form Conta
  const [nomeConta, setNomeConta] = useState('');
  const [instituicaoConta, setInstituicaoConta] = useState('');
  const [tipoConta, setTipoConta] = useState<'corrente' | 'poupanca' | 'investimento' | 'dinheiro'>('corrente');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [corConta, setCorConta] = useState('#10b981');

  // Form Cartão
  const [nomeCartao, setNomeCartao] = useState('');
  const [bandeiraCartao, setBandeiraCartao] = useState<'visa' | 'mastercard' | 'elo' | 'amex'>('mastercard');
  const [limiteTotal, setLimiteTotal] = useState('');
  const [diaFechamento, setDiaFechamento] = useState(25);
  const [diaVencimento, setDiaVencimento] = useState(5);
  const [ultimosDigitos, setUltimosDigitos] = useState('');
  const [corCartao, setCorCartao] = useState('#8b5cf6');

  const handleSalvarConta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeConta) return;
    onCriarConta({
      nome: nomeConta,
      instituicao: instituicaoConta || nomeConta,
      tipo: tipoConta,
      saldoInicial: parseFloat(saldoInicial) || 0,
      cor: corConta,
    });
    setModalContaAberto(false);
    setNomeConta('');
    setSaldoInicial('');
  };

  const handleSalvarCartao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCartao) return;
    onCriarCartao({
      nome: nomeCartao,
      bandeira: bandeiraCartao,
      limiteTotal: parseFloat(limiteTotal) || 5000,
      diaFechamento,
      diaVencimento,
      ultimosDigitos: ultimosDigitos || '1234',
      cor: corCartao,
    });
    setModalCartaoAberto(false);
    setNomeCartao('');
    setLimiteTotal('');
    setUltimosDigitos('');
  };

  return (
    <div id="contas-cartoes-view" className="space-y-8 animate-fadeIn">
      
      {/* SECTION 1: CONTAS BANCÁRIAS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Contas Bancárias & Carteiras
            </h2>
            <p className="text-xs text-slate-400">Origem de saldos com atualização transacional automática</p>
          </div>

          <button
            id="btn-abrir-modal-conta"
            onClick={() => setModalContaAberto(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Conta</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {contas.map((conta) => (
            <div
              key={conta.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conta.cor || '#10b981' }}></div>
                    <span className="text-xs font-medium text-slate-400 capitalize">{conta.tipo}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                    Ativa
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">{conta.nome}</h3>
                <p className="text-xs text-slate-400">{conta.instituicao}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Saldo Disponível</span>
                <span className={`text-xl font-bold font-mono ${
                  (conta.saldoAtual ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatarMoeda(conta.saldoAtual)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: CARTÕES DE CRÉDITO */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              Cartões de Crédito & Faturas
            </h2>
            <p className="text-xs text-slate-400">Controle de limites disponíveis, data de fechamento e vencimento</p>
          </div>

          <button
            id="btn-abrir-modal-cartao"
            onClick={() => setModalCartaoAberto(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Cartão</span>
          </button>
        </div>

        {/* Banner de Acesso à Análise de Parcelamentos & Faturas Futuras */}
        {onNavigateTab && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Projeção de Faturas Futuras & Dívidas Parceladas
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Novo</span>
                </h4>
                <p className="text-xs text-slate-300">
                  Saiba quando os parcelamentos terminam e quanto de limite/orçamento será liberado mês a mês (sem duplicar suas despesas atuais).
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('faturas_parcelamentos')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-950"
            >
              <span>Abrir Painel de Parcelamentos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cartoes.map((cartao) => {
            const limiteTotalNum = cartao.limiteTotal || 1;
            const limiteDispNum = cartao.limiteDisponivel ?? 0;
            const gasto = Math.max(0, limiteTotalNum - limiteDispNum);
            const percentualGasto = Math.min(100, Math.round((gasto / limiteTotalNum) * 100));
            
            return (
              <div
                key={cartao.id}
                className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar of the Card */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cartao.cor || '#8b5cf6' }}></div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        {cartao.bandeira}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">•••• {cartao.ultimosDigitos}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{cartao.nome}</h3>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3 py-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Fecha todo dia:</span>
                      <span className="text-white font-bold text-sm">Dia {cartao.diaFechamento}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Vence todo dia:</span>
                      <span className="text-amber-400 font-bold text-sm">Dia {cartao.diaVencimento}</span>
                    </div>
                  </div>
                </div>

                {/* Limits & Progress */}
                <div className="pt-4 mt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Limite Utilizado ({percentualGasto}%)</span>
                    <span className="text-indigo-300 font-bold">
                      {formatarMoeda(gasto)}
                    </span>
                  </div>

                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentualGasto > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-teal-500 to-indigo-500'
                      }`}
                      style={{ width: `${percentualGasto}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Disponível: <strong className="text-emerald-400 font-mono">{formatarMoeda(cartao.limiteDisponivel)}</strong></span>
                    <span>Total: {formatarMoeda(cartao.limiteTotal)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nova Conta */}
      {modalContaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-nova-conta-title" className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 id="modal-nova-conta-title" className="text-base font-bold text-white">Adicionar Conta Bancária</h3>
              <button onClick={() => setModalContaAberto(false)} title="Fechar" aria-label="Fechar" className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarConta} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="input-nome-conta" className="text-slate-300 font-medium">Nome da Conta *</label>
                <input
                  id="input-nome-conta"
                  type="text"
                  required
                  placeholder="Ex: Banco Inter PJ, Bradesco…"
                  value={nomeConta}
                  onChange={(e) => setNomeConta(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="select-tipo-conta" className="text-slate-300 font-medium">Tipo</label>
                  <select
                    id="select-tipo-conta"
                    value={tipoConta}
                    onChange={(e) => setTipoConta(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="investimento">Investimentos</option>
                    <option value="dinheiro">Dinheiro / Caixa</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="input-saldo-inicial" className="text-slate-300 font-medium">Saldo Inicial (R$)</label>
                  <input
                    id="input-saldo-inicial"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalContaAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Cartão */}
      {modalCartaoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-novo-cartao-title" className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 id="modal-novo-cartao-title" className="text-base font-bold text-white">Adicionar Cartão de Crédito</h3>
              <button onClick={() => setModalCartaoAberto(false)} title="Fechar" aria-label="Fechar" className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarCartao} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="input-nome-cartao" className="text-slate-300 font-medium">Nome do Cartão *</label>
                <input
                  id="input-nome-cartao"
                  type="text"
                  required
                  placeholder="Ex: C6 Carbon Mastercard Black…"
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="select-bandeira-cartao" className="text-slate-300 font-medium">Bandeira</label>
                  <select
                    id="select-bandeira-cartao"
                    value={bandeiraCartao}
                    onChange={(e) => setBandeiraCartao(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
                  >
                    <option value="mastercard">Mastercard</option>
                    <option value="visa">Visa</option>
                    <option value="elo">Elo</option>
                    <option value="amex">Amex</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="input-limite-total" className="text-slate-300 font-medium">Limite Total (R$)</label>
                  <input
                    id="input-limite-total"
                    type="number"
                    step="0.01"
                    placeholder="10000,00"
                    value={limiteTotal}
                    onChange={(e) => setLimiteTotal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="input-dia-fechamento" className="text-slate-300 font-medium">Fechamento</label>
                  <input
                    id="input-dia-fechamento"
                    type="number"
                    min="1"
                    max="31"
                    value={diaFechamento}
                    onChange={(e) => setDiaFechamento(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="input-dia-vencimento" className="text-slate-300 font-medium">Vencimento</label>
                  <input
                    id="input-dia-vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="input-ultimos-digitos" className="text-slate-300 font-medium">Final Dígitos</label>
                  <input
                    id="input-ultimos-digitos"
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={ultimosDigitos}
                    onChange={(e) => setUltimosDigitos(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalCartaoAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Salvar Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
