/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  WalletCards, 
  PlusCircle, 
  Sparkles, 
  LayoutDashboard, 
  ArrowLeftRight, 
  CreditCard, 
  PieChart, 
  Lightbulb,
  FileCode2,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Smartphone,
  Tags,
  Layers
} from 'lucide-react';
import { formatarMoeda } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNovoLancamento: () => void;
  onOpenSqlModal: () => void;
  onOpenCategoriasModal?: () => void;
  saldoConsolidado?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNovoLancamento,
  onOpenSqlModal,
  onOpenCategoriasModal,
  saldoConsolidado = 0,
}) => {
  const { user, logout } = useAuth();
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const menuUsuarioRef = useRef<HTMLDivElement>(null);

  const fecharMenuUsuario = useCallback(() => setMenuUsuarioAberto(false), []);
  useEscapeKey(menuUsuarioAberto, fecharMenuUsuario);

  useEffect(() => {
    if (!menuUsuarioAberto) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuUsuarioRef.current && !menuUsuarioRef.current.contains(e.target as Node)) {
        setMenuUsuarioAberto(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuUsuarioAberto]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
    { id: 'faturas_parcelamentos', label: 'Faturas & Parcelas', icon: Layers },
    { id: 'contas_cartoes', label: 'Contas & Cartões', icon: CreditCard },
    { id: 'importacao_ia', label: 'Importação IA', icon: Sparkles, highlight: true },
    { id: 'orcamentos', label: 'Orçamentos', icon: PieChart },
    { id: 'insights', label: 'Consultor IA', icon: Lightbulb },
  ];

  const saldo = saldoConsolidado ?? 0;

  return (
    <header id="app-header" className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Project Title */}
          <button
            type="button"
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950/50 text-white font-bold shrink-0">
              <WalletCards className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight">Finance Pro</span>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Firebase Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Saldo: <span className={saldo >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {formatarMoeda(saldo)}
                </span>
              </p>
            </div>
          </button>

          {/* Desktop Navigation Tabs */}
          <nav id="nav-tabs" className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/70">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-950/50'
                      : tab.highlight
                      ? 'text-teal-300 hover:text-teal-200 hover:bg-teal-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab.highlight && !isActive ? 'text-teal-400' : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Buttons & User Menu */}
          <div className="flex items-center gap-2">
            {onOpenCategoriasModal && (
              <button
                id="btn-gerenciar-categorias-navbar"
                onClick={onOpenCategoriasModal}
                title="Gerenciar Categorias (Criar, Editar, Renomear, Excluir e Mesclar)"
                aria-label="Gerenciar Categorias"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Tags className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Categorias</span>
              </button>
            )}

            <button
              id="btn-sql-schema"
              onClick={onOpenSqlModal}
              title="Visualizar Script PostgreSQL"
              aria-label="Visualizar Script SQL"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">SQL</span>
            </button>

            <button
              id="btn-novo-lancamento"
              onClick={onOpenNovoLancamento}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Lançamento</span>
              <span className="sm:hidden">Novo</span>
            </button>

            {/* User Profile dropdown */}
            {user && (
              <div className="relative" ref={menuUsuarioRef}>
                <button
                  id="btn-user-menu"
                  onClick={() => setMenuUsuarioAberto(!menuUsuarioAberto)}
                  aria-label="Menu do usuário"
                  aria-haspopup="true"
                  aria-expanded={menuUsuarioAberto}
                  className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all text-xs text-slate-300 cursor-pointer"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg object-cover ring-1 ring-emerald-500/30"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-500/30">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                    </div>
                  )}
                  <span className="hidden md:inline-block max-w-[100px] truncate font-medium text-slate-200">
                    {user.displayName?.split(' ')[0] || 'Usuário'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {menuUsuarioAberto && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl p-3 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onClick={() => setMenuUsuarioAberto(false)}
                  >
                    <div className="px-2 py-2 mb-2 border-b border-slate-800">
                      <p className="text-xs font-semibold text-white truncate">{user.displayName || 'Usuário'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Banco Individual Isolado
                      </span>
                    </div>

                    {onOpenCategoriasModal && (
                      <button
                        onClick={onOpenCategoriasModal}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 transition-colors font-medium cursor-pointer mb-1"
                      >
                        <Tags className="w-4 h-4 text-indigo-400" />
                        <span>Gerenciar Categorias</span>
                      </button>
                    )}

                    <button
                      onClick={() => logout()}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair da conta</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Medium/Tablet Navigation Row */}
        <div className="hidden md:flex lg:hidden items-center justify-start overflow-x-auto py-2 gap-1 border-t border-slate-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

