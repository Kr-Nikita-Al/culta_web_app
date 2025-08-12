export interface LoginData {
    username: string;
    password: string;
}

export interface UserRole {
    id: number;
    name: string;
    description: string;
}

export interface AuthContextType {
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
}

export interface UserRole {
    company_id: string;
    role: string;
}

export interface Company {
    company_id: string;
    company_name: string;
    address: string;
    phone: string;
    email: string;
    is_active: boolean;
    // Остальные поля при необходимости
}

export interface CompanyResponse {
    companies: Company[];
}

export interface UserRole {
    company_id: string;
    role: string;
}

// Для роли с дополнительной информацией о компании
export interface RoleWithCompany extends UserRole {
    company_name?: string;
}