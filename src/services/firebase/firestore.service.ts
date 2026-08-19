/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase.config';
import { handleFirestoreError, OperationType } from './error.handler';
import {
  Conta,
  CartaoCredito,
  Categoria,
  Lancamento,
  FaturaCartao,
  AuditLog,
  DashboardResumo,
} from '../../types';

const CATEGORIAS_PADRAO: Omit<Categoria, 'id'>[] = [
  { nome: 'Alimentação & Mercado', tipo: 'despesa', cor: '#f59e0b', icone: 'UtensilsCrossed', orcamentoMensal: 1500, descricao: 'Supermercado, restaurantes e delivery' },
  { nome: 'Moradia & Contas', tipo: 'despesa', cor: '#ef4444', icone: 'Home', orcamentoMensal: 2500, descricao: 'Aluguel, condomínio, luz, água e internet' },
  { nome: 'Transporte & Combustível', tipo: 'despesa', cor: '#3b82f6', icone: 'Car', orcamentoMensal: 800, descricao: 'Combustível, transporte público, apps e manutenção' },
  { nome: 'Saúde & Farmácia', tipo: 'despesa', cor: '#ec4899', icone: 'HeartPulse', orcamentoMensal: 500, descricao: 'Consultas, exames, medicamentos e plano de saúde' },
  { nome: 'Lazer & Entretenimento', tipo: 'despesa', cor: '#8b5cf6', icone: 'Gamepad2', orcamentoMensal: 600, descricao: 'Passeios, streaming, viagens e hobbies' },
  { nome: 'Educação & Cursos', tipo: 'despesa', cor: '#06b6d4', icone: 'GraduationCap', orcamentoMensal: 400, descricao: 'Faculdade, livros e especializações' },
  { nome: 'Salário & Pró-labore', tipo: 'receita', cor: '#10b981', icone: 'Briefcase', descricao: 'Renda principal e recebimentos de trabalho' },
  { nome: 'Rendimentos & Investimentos', tipo: 'receita', cor: '#14b8a6', icone: 'TrendingUp', descricao: 'Dividendos, juros e lucros' },
  { nome: 'Serviços & Freelance', tipo: 'receita', cor: '#6366f1', icone: 'Laptop', descricao: 'Projetos extras e consultorias' },
  { nome: 'Outras Receitas', tipo: 'receita', cor: '#84cc16', icone: 'PlusCircle', descricao: 'Entradas diversas e reembolsos' },
];

/**
 * Ensures user document and initial default accounts/categories exist in Firestore
 */
export async function inicializarUsuarioSeNovo(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // Create user profile document
      await setDoc(userDocRef, {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Usuário',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString(),
      });

      const batch = writeBatch(db);

      // Seed initial accounts
      const conta1Id = `acc_${Date.now()}_1`;
      const conta1Ref = doc(db, 'users', user.uid, 'contas', conta1Id);
      const conta1: Conta & { userId: string } = {
        id: conta1Id,
        userId: user.uid,
        nome: 'Conta Corrente Principal',
        instituicao: 'Banco Principal',
        tipo: 'corrente',
        saldoInicial: 0,
        saldoAtual: 0,
        cor: '#10b981',
        ativa: true,
        criadaEm: new Date().toISOString(),
      };
      batch.set(conta1Ref, conta1);

      const conta2Id = `acc_${Date.now()}_2`;
      const conta2Ref = doc(db, 'users', user.uid, 'contas', conta2Id);
      const conta2: Conta & { userId: string } = {
        id: conta2Id,
        userId: user.uid,
        nome: 'Carteira / Dinheiro',
        instituicao: 'Espécie',
        tipo: 'dinheiro',
        saldoInicial: 0,
        saldoAtual: 0,
        cor: '#f59e0b',
        ativa: true,
        criadaEm: new Date().toISOString(),
      };
      batch.set(conta2Ref, conta2);

      // Seed standard categories
      CATEGORIAS_PADRAO.forEach((cat, index) => {
        const catId = `cat_${Date.now()}_${index}`;
        const catRef = doc(db, 'users', user.uid, 'categorias', catId);
        const novaCat: Categoria & { userId: string } = {
          ...cat,
          id: catId,
          userId: user.uid,
        };
        batch.set(catRef, novaCat);
      });

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

// ----------------------------------------------------
// SUBSCRIPTIONS (REAL-TIME PER-USER ISOLATION)
// ----------------------------------------------------

export function subscribeContas(userId: string, callback: (contas: Conta[]) => void): Unsubscribe {
  const path = `users/${userId}/contas`;
  const colRef = collection(db, 'users', userId, 'contas');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const lista: Conta[] = snapshot.docs.map((docSnap) => docSnap.data() as Conta);
      callback(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCartoes(userId: string, callback: (cartoes: CartaoCredito[]) => void): Unsubscribe {
  const path = `users/${userId}/cartoes`;
  const colRef = collection(db, 'users', userId, 'cartoes');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const lista: CartaoCredito[] = snapshot.docs.map((docSnap) => docSnap.data() as CartaoCredito);
      callback(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCategorias(userId: string, callback: (categorias: Categoria[]) => void): Unsubscribe {
  const path = `users/${userId}/categorias`;
  const colRef = collection(db, 'users', userId, 'categorias');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const lista: Categoria[] = snapshot.docs.map((docSnap) => docSnap.data() as Categoria);
      callback(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeLancamentos(userId: string, callback: (lancamentos: Lancamento[]) => void): Unsubscribe {
  const path = `users/${userId}/lancamentos`;
  const colRef = collection(db, 'users', userId, 'lancamentos');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const lista: Lancamento[] = snapshot.docs.map((docSnap) => docSnap.data() as Lancamento);
      // Sort newest first
      lista.sort((a, b) => new Date(b.dataVencimento || b.dataCompetencia).getTime() - new Date(a.dataVencimento || a.dataCompetencia).getTime());
      callback(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeFaturas(userId: string, callback: (faturas: FaturaCartao[]) => void): Unsubscribe {
  const path = `users/${userId}/faturas`;
  const colRef = collection(db, 'users', userId, 'faturas');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const lista: FaturaCartao[] = snapshot.docs.map((docSnap) => docSnap.data() as FaturaCartao);
      callback(lista);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ----------------------------------------------------
// MUTATION OPERATIONS (STRICTLY SCOPED BY USER ID)
// ----------------------------------------------------

export async function salvarLancamento(userId: string, lancamento: Lancamento): Promise<void> {
  const path = `users/${userId}/lancamentos/${lancamento.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'lancamentos', lancamento.id);
    const dataWithUser = {
      ...lancamento,
      userId,
      atualizadoEm: new Date().toISOString(),
    };
    await setDoc(docRef, dataWithUser, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function excluirLancamento(userId: string, lancamentoId: string): Promise<void> {
  const path = `users/${userId}/lancamentos/${lancamentoId}`;
  try {
    const docRef = doc(db, 'users', userId, 'lancamentos', lancamentoId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function salvarConta(userId: string, conta: Conta): Promise<void> {
  const path = `users/${userId}/contas/${conta.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'contas', conta.id);
    await setDoc(docRef, { ...conta, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function excluirConta(userId: string, contaId: string): Promise<void> {
  const path = `users/${userId}/contas/${contaId}`;
  try {
    const docRef = doc(db, 'users', userId, 'contas', contaId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function salvarCartao(userId: string, cartao: CartaoCredito): Promise<void> {
  const path = `users/${userId}/cartoes/${cartao.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'cartoes', cartao.id);
    await setDoc(docRef, { ...cartao, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function excluirCartao(userId: string, cartaoId: string): Promise<void> {
  const path = `users/${userId}/cartoes/${cartaoId}`;
  try {
    const docRef = doc(db, 'users', userId, 'cartoes', cartaoId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function salvarCategoria(userId: string, categoria: Categoria): Promise<void> {
  const path = `users/${userId}/categorias/${categoria.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'categorias', categoria.id);
    await setDoc(docRef, { ...categoria, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function excluirCategoria(userId: string, categoriaId: string): Promise<void> {
  const path = `users/${userId}/categorias/${categoriaId}`;
  try {
    const docRef = doc(db, 'users', userId, 'categorias', categoriaId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function salvarFatura(userId: string, fatura: FaturaCartao): Promise<void> {
  const path = `users/${userId}/faturas/${fatura.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'faturas', fatura.id);
    await setDoc(docRef, { ...fatura, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function registrarAuditLog(userId: string, log: Omit<AuditLog, 'id' | 'dataHora'>): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/auditLogs/${logId}`;
  try {
    const docRef = doc(db, 'users', userId, 'auditLogs', logId);
    const fullLog: AuditLog & { userId: string } = {
      ...log,
      id: logId,
      userId,
      dataHora: new Date().toISOString(),
    };
    await setDoc(docRef, fullLog);
  } catch (error) {
    // Non-blocking log catch
    console.warn('Falha ao gravar audit log no Firestore:', error);
  }
}

/**
 * Clear user data if requested
 */
export async function limparDadosUsuario(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    const lancamentosSnap = await getDocs(collection(db, 'users', userId, 'lancamentos'));
    const faturasSnap = await getDocs(collection(db, 'users', userId, 'faturas'));

    const batch = writeBatch(db);
    lancamentosSnap.docs.forEach((d) => batch.delete(d.ref));
    faturasSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Recalculate dashboard summary from real-time Firestore collections
 */
export function calcularResumoFinanceiro(
  contas: Conta[],
  cartoes: CartaoCredito[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  faturas: FaturaCartao[]
): DashboardResumo {
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  // Consolidated total balance of active accounts
  const saldoTotalConsolidado = (contas || [])
    .filter(c => c.ativa)
    .reduce((acc, c) => acc + (Number(c.saldoAtual) || 0), 0);

  // Month transactions
  const lancamentosMes = (lancamentos || []).filter(l => {
    if (l.status === 'cancelado') return false;
    const dataRef = new Date(l.dataCompetencia || l.dataVencimento || hoje);
    return dataRef.getMonth() + 1 === mesAtual && dataRef.getFullYear() === anoAtual;
  });

  const receitasMes = lancamentosMes
    .filter(l => l.tipo === 'receita' && l.status === 'pago')
    .reduce((acc, l) => acc + (Number(l.valor) || 0), 0);

  const despesasMes = lancamentosMes
    .filter(l => l.tipo === 'despesa' && l.status === 'pago')
    .reduce((acc, l) => acc + (Number(l.valor) || 0), 0);

  const saldoPrevistoMes = saldoTotalConsolidado + (receitasMes - despesasMes);

  const faturasAbertasTotal = (faturas || [])
    .filter(f => f.status === 'aberta' || f.status === 'atrasada')
    .reduce((acc, f) => acc + (Number(f.valorTotal) || 0), 0);

  const lancamentosPendentesCount = (lancamentos || [])
    .filter(l => l.status === 'pendente').length;

  // Expenses grouped by category
  const mapCategorias: Record<string, number> = {};
  lancamentosMes
    .filter(l => l.tipo === 'despesa')
    .forEach(l => {
      mapCategorias[l.categoriaId] = (mapCategorias[l.categoriaId] || 0) + Number(l.valor || 0);
    });

  const totalDespesasGerais = Object.values(mapCategorias).reduce((a, b) => a + b, 0) || 1;

  const despesasPorCategoria = Object.entries(mapCategorias).map(([catId, valor]) => {
    const cat = categorias.find(c => c.id === catId);
    return {
      categoriaId: catId,
      categoriaNome: cat ? cat.nome : 'Outros',
      cor: cat ? cat.cor : '#94a3b8',
      valor,
      percentual: Math.round((valor / totalDespesasGerais) * 100),
    };
  }).sort((a, b) => b.valor - a.valor);

  // Monthly flow (last 6 months)
  const fluxoMensal = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anoAtual, mesAtual - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const nomeMes = d.toLocaleDateString('pt-BR', { month: 'short' });

    const lDoMes = (lancamentos || []).filter(l => {
      if (l.status === 'cancelado') return false;
      const dl = new Date(l.dataCompetencia || l.dataVencimento || hoje);
      return dl.getMonth() + 1 === m && dl.getFullYear() === y;
    });

    const rec = lDoMes.filter(l => l.tipo === 'receita').reduce((a, b) => a + Number(b.valor || 0), 0);
    const desp = lDoMes.filter(l => l.tipo === 'despesa').reduce((a, b) => a + Number(b.valor || 0), 0);

    fluxoMensal.push({
      mes: nomeMes.toUpperCase().replace('.', ''),
      receitas: rec,
      despesas: desp,
    });
  }

  // Upcoming due dates (next 7 days or pending)
  const proximosVencimentos = (lancamentos || [])
    .filter(l => l.status === 'pendente')
    .slice(0, 5);

  return {
    saldoTotalConsolidado,
    receitasMes,
    despesasMes,
    saldoPrevistoMes,
    saldoPrevistoFinalMes: saldoPrevistoMes,
    faturasAbertasTotal,
    lancamentosPendentesCount,
    despesasPorCategoria,
    fluxoMensal,
    proximosVencimentos,
  };
}
