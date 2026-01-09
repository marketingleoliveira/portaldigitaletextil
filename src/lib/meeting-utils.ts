import { AppRole, ROLE_LABELS } from "@/types/auth";

// Role color classes for meeting display
export const ROLE_TEXT_COLORS: Record<AppRole, string> = {
  dev: 'text-fuchsia-400',
  admin: 'text-violet-400', 
  gerente: 'text-blue-400',
  vendedor: 'text-emerald-400',
};

// Extract role from participant name (format: "Name (Role)")
export const extractRoleFromName = (userName: string): { name: string; role: string | null; isGuest: boolean } => {
  const match = userName.match(/^(.+?)\s*\((.+)\)$/);
  if (match) {
    const role = match[2];
    const isGuest = role === 'Convidado';
    return { name: match[1].trim(), role, isGuest };
  }
  return { name: userName, role: null, isGuest: false };
};

// Get role color class from role label
export const getRoleColorClass = (roleLabel: string): string => {
  const roleMap: Record<string, string> = {
    'Desenvolvedor': ROLE_TEXT_COLORS.dev,
    'Diretor': ROLE_TEXT_COLORS.admin,
    'Gerente': ROLE_TEXT_COLORS.gerente,
    'Vendedor': ROLE_TEXT_COLORS.vendedor,
    'Convidado': 'text-amber-400',
  };
  return roleMap[roleLabel] || 'text-gray-400';
};

// Format participant display name with colored role
export const formatParticipantName = (userName: string): { displayName: string; roleLabel: string | null; roleColorClass: string } => {
  const { name, role, isGuest } = extractRoleFromName(userName);
  
  if (role) {
    return {
      displayName: name,
      roleLabel: role,
      roleColorClass: getRoleColorClass(role),
    };
  }
  
  return {
    displayName: userName,
    roleLabel: null,
    roleColorClass: '',
  };
};
