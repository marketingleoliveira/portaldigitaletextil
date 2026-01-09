export type AppRole = 'admin' | 'gerente' | 'vendedor' | 'dev' | 'criacao';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile | null;
  role: AppRole | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Subcategory {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  created_at: string;
  category?: Category;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  commercial_conditions: string | null;
  image_url: string | null;
  catalog_url: string | null;
  technical_sheet_url: string | null;
  category_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visibility?: AppRole[];
  category?: Category;
}

export interface ProductVisibility {
  id: string;
  product_id: string;
  visible_to_role: AppRole;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  visible_to_roles: AppRole[];
  created_by: string | null;
  created_at: string;
}

export interface AccessLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
}

export interface FileItem {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  subcategory_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_external_link?: boolean;
  visibility?: AppRole[];
  subcategory?: Subcategory;
}

export interface FileVisibility {
  id: string;
  file_id: string;
  visible_to_role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  dev: 'Desenvolvedor',
  admin: 'Diretor',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  criacao: 'Criação',
};

export const ROLE_COLORS: Record<AppRole, string> = {
  dev: 'bg-role-dev',
  admin: 'bg-role-admin',
  gerente: 'bg-role-gerente',
  vendedor: 'bg-role-vendedor',
  criacao: 'bg-role-criacao',
};

// Helper to check if role has full access (dev or admin/diretor)
export const hasFullAccess = (role: AppRole | null | undefined): boolean => {
  return role === 'dev' || role === 'admin';
};

// Helper to check if role is manager or above
export const isManagerOrAbove = (role: AppRole | null | undefined): boolean => {
  return role === 'dev' || role === 'admin' || role === 'gerente';
};

// Brazilian states/regions for vendedor subcargo
export const REGIONS = [
  { value: 'INTERNO', label: 'Vendedor Interno', isSpecial: true },
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
] as const;

export type Region = typeof REGIONS[number]['value'];

// Helper to check if a region has access to all regions (Vendedor Interno)
export const hasAllRegionsAccess = (region: string | null | undefined): boolean => {
  return region === 'INTERNO';
};
