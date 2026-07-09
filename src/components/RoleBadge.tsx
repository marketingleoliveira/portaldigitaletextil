import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AppRole, ROLE_LABELS } from '@/types/auth';
import { Shield, UserCog, User, Code, Palette, Megaphone, BadgeCheck, Wallet, Crown } from 'lucide-react';

interface RoleBadgeProps {
  role: AppRole;
  region?: string | null;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, region, showIcon = true, size = 'md' }) => {
  const icons: Record<AppRole, React.ElementType> = {
    dev: Code,
    admin: Shield,
    gerente: UserCog,
    vendedor: User,
    criacao: Palette,
    sdr: User,
    marketing: Megaphone,
    qualidade: BadgeCheck,
    financeiro: Wallet,
    diretoria: Crown,
  };

  const Icon = icons[role];
  
  // Map roles to badge variants (criacao uses secondary as fallback)
  const roleToVariant: Record<AppRole, string> = {
    dev: "dev",
    admin: "admin",
    gerente: "gerente",
    vendedor: "vendedor",
    criacao: "criacao",
    sdr: "secondary",
    marketing: "secondary",
    qualidade: "secondary",
    financeiro: "secondary",
    diretoria: "admin",
  };

  // For vendedor with region, show "Vendedor SP" format
  // Special case for INTERNO region - display as "Vendedor Interno"
  const getDisplayLabel = () => {
    if (role !== 'vendedor' || !region) return ROLE_LABELS[role];
    if (region === 'INTERNO') return 'Vendedor Interno';
    return `${ROLE_LABELS[role]} ${region}`;
  };

  const displayLabel = getDisplayLabel();

  return (
    <Badge variant={roleToVariant[role] as any} className={size === 'sm' ? 'text-xs px-2 py-0.5' : ''}>
      {showIcon && Icon && <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} mr-1`} />}
      {displayLabel}
    </Badge>
  );
};

export default RoleBadge;
