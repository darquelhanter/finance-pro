/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  UtensilsCrossed,
  Home,
  Car,
  HeartPulse,
  Gamepad2,
  GraduationCap,
  Briefcase,
  TrendingUp,
  Laptop,
  PlusCircle,
  ShoppingBag,
  Fuel,
  Wifi,
  Smartphone,
  PawPrint,
  Sparkles,
  Coffee,
  Plane,
  Shirt,
  Receipt,
  Film,
  Zap,
  Book,
  Dumbbell,
  PiggyBank,
  Gift,
  Shield,
  CreditCard,
  Wallet,
  Tag,
  DollarSign,
  Tv,
  Scissors,
  Wrench,
  Baby,
  Smile,
  LucideIcon
} from 'lucide-react';

export const ICONES_DISPONIVEIS: { nome: string; label: string; icone: LucideIcon }[] = [
  { nome: 'UtensilsCrossed', label: 'Alimentação / Restaurante', icone: UtensilsCrossed },
  { nome: 'Home', label: 'Moradia / Casa', icone: Home },
  { nome: 'Car', label: 'Transporte / Carro', icone: Car },
  { nome: 'Fuel', label: 'Combustível / Posto', icone: Fuel },
  { nome: 'HeartPulse', label: 'Saúde / Farmácia', icone: HeartPulse },
  { nome: 'Gamepad2', label: 'Lazer / Jogos', icone: Gamepad2 },
  { nome: 'GraduationCap', label: 'Educação / Estudos', icone: GraduationCap },
  { nome: 'Briefcase', label: 'Trabalho / Salário', icone: Briefcase },
  { nome: 'TrendingUp', label: 'Investimentos / Lucro', icone: TrendingUp },
  { nome: 'Laptop', label: 'Tecnologia / Freelance', icone: Laptop },
  { nome: 'ShoppingBag', label: 'Compras / Mercado', icone: ShoppingBag },
  { nome: 'Shirt', label: 'Roupas / Vestuário', icone: Shirt },
  { nome: 'PawPrint', label: 'Pets / Animais', icone: PawPrint },
  { nome: 'Tv', label: 'Streaming / Assinaturas', icone: Tv },
  { nome: 'Sparkles', label: 'Beleza / Cuidados', icone: Sparkles },
  { nome: 'Coffee', label: 'Cafeteria / Lanche', icone: Coffee },
  { nome: 'Plane', label: 'Viagens / Turismo', icone: Plane },
  { nome: 'Film', label: 'Cinema / Cultura', icone: Film },
  { nome: 'Zap', label: 'Energia / Luz', icone: Zap },
  { nome: 'Wifi', label: 'Internet / Telecom', icone: Wifi },
  { nome: 'Smartphone', label: 'Celular / Telefonia', icone: Smartphone },
  { nome: 'Dumbbell', label: 'Academia / Esporte', icone: Dumbbell },
  { nome: 'PiggyBank', label: 'Poupança / Reserva', icone: PiggyBank },
  { nome: 'Gift', label: 'Presentes / Doações', icone: Gift },
  { nome: 'Shield', label: 'Seguros / Garantias', icone: Shield },
  { nome: 'Wrench', label: 'Manutenção / Reparos', icone: Wrench },
  { nome: 'Baby', label: 'Filhos / Bebê', icone: Baby },
  { nome: 'Receipt', label: 'Impostos / Taxas', icone: Receipt },
  { nome: 'PlusCircle', label: 'Outros / Geral', icone: PlusCircle },
];

export const CORES_PRESET = [
  '#f59e0b', // Amarelo/Laranja
  '#ef4444', // Vermelho
  '#3b82f6', // Azul
  '#ec4899', // Rosa
  '#8b5cf6', // Roxo
  '#06b6d4', // Ciano
  '#10b981', // Verde esmeralda
  '#14b8a6', // Teal
  '#6366f1', // Índigo
  '#84cc16', // Lima
  '#f97316', // Laranja escuro
  '#64748b', // Cinza / Slate
];

interface CategoryIconProps {
  nomeIcone?: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  nomeIcone,
  className = 'w-4 h-4',
  size,
}) => {
  const item = ICONES_DISPONIVEIS.find(
    (i) => i.nome.toLowerCase() === (nomeIcone || '').toLowerCase()
  );
  const IconComponent = item ? item.icone : Tag;
  return <IconComponent className={className} size={size} />;
};
