/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Database, FileCode2, Terminal } from 'lucide-react';
import { fetchAutenticado } from '../services/firebase/auth.service';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ isOpen, onClose }) => {
  const [sqlContent, setSqlContent] = useState<string>('Carregando script SQL…');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAutenticado('/api/schema-sql')
        .then((res) => res.text())
        .then((data) => setSqlContent(data))
        .catch(() => setSqlContent('-- Erro ao carregar script SQL'));
    }
  }, [isOpen]);

  useEscapeKey(isOpen, onClose);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div id="modal-sql-schema" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-sql-schema-title" className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-sql-schema-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Schema PostgreSQL (DDL & Triggers)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  schema_financepro.sql
                </span>
              </h2>
              <p className="text-xs text-slate-400">Estrutura relacional com chaves estrangeiras, índices e triggers de auditoria</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              {copiado ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span role="status" aria-live="polite">{copiado ? 'Copiado!' : 'Copiar SQL'}</span>
            </button>

            <button
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 bg-slate-950 overflow-y-auto flex-1 font-mono text-xs text-emerald-400/90 leading-relaxed select-all">
          <pre className="whitespace-pre-wrap">{sqlContent}</pre>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            Compatível com PostgreSQL 14+, Supabase, Cloud SQL e Neon
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
