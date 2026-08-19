/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { loginComGoogle, logoutUsuario, observarEstadoAutenticacao } from '../services/firebase/auth.service';
import { inicializarUsuarioSeNovo } from '../services/firebase/firestore.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = observarEstadoAutenticacao(async (currentUser) => {
      try {
        if (currentUser) {
          // Initialize user profile & default collections in Firestore
          await inicializarUsuarioSeNovo(currentUser);
          setUser(currentUser);
        } else {
          setUser(null);
        }
      } catch (err: any) {
        console.error('Erro ao inicializar usuário no Firestore:', err);
        setError('Não foi possível inicializar seu banco de dados individual.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const loggedUser = await loginComGoogle();
      await inicializarUsuarioSeNovo(loggedUser);
      setUser(loggedUser);
    } catch (err: any) {
      console.error('Erro ao logar com Google:', err);
      // Popup closed by user or cancelled is common, don't show scary error
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message || 'Erro ao conectar com sua conta Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await logoutUsuario();
      setUser(null);
    } catch (err: any) {
      console.error('Erro ao sair:', err);
      setError('Erro ao encerrar sessão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginGoogle,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
