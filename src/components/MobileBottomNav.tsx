/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Plus,
  CreditCard,
  PieChart,
  Sparkles,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNovoLancamento: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNovoLancamento,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto relative">
        {/* Dashboard */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'dashboard'
              ? 'text-emerald-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Início</span>
        </button>

        {/* Lançamentos */}
        <button
          onClick={() => setCurrentTab('lancamentos')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'lancamentos'
              ? 'text-emerald-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowLeftRight className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Extrato</span>
        </button>

        {/* Center Quick Add Floating Button */}
        <button
          id="btn-mobile-quick-add"
          onClick={onOpenNovoLancamento}
          className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-950/80 border-2 border-slate-950 active:scale-95 transition-all cursor-pointer"
          aria-label="Novo Lançamento"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Contas & Cartões */}
        <button
          onClick={() => setCurrentTab('contas_cartoes')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'contas_cartoes'
              ? 'text-emerald-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Cartões</span>
        </button>

        {/* Importação IA / Insights */}
        <button
          onClick={() => setCurrentTab('importacao_ia')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'importacao_ia'
              ? 'text-teal-300 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5 text-teal-400" />
          <span className="text-[10px]">Faturas IA</span>
        </button>
      </div>
    </nav>
  );
};
