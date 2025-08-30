export interface LoginData {
    username: string;
    password: string;
}

export interface UserRole {
    company_id: string;
    role: string;
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

export interface OAuthProvider {
    id: string;
    name: string;
    icon: string;
    authUrl: string;
}

export interface OAuthResponse {
    token: string;
    user: any;
}

export interface UserInfo {
    user_id: string;
    name: string;
    surname: string;
    phone: string;
    email: string;
    is_active: boolean;
    creator_id: string;
    updater_id: string;
    time_created: string;
    time_updated: string;
}

export interface LoginData {
    username: string;
    password: string;
}


export interface AuthContextType {
    token: string | null;
    userId: string | null;
    userInfo: UserInfo | null;
    login: (token: string, userId: string) => void; // Изменено на 2 параметра
    logout: () => void;
    updateUserInfo: (userInfo: UserInfo) => void;
}

export interface LoginResponse {
    token: string;
    userId: string;
}

// Добавим к существующим типам
export interface EnhancedUserInfo extends UserInfo {
    roles?: RoleWithCompany[];
    companies?: Company[];
}

export interface ApiResponse<T> {
    data: T;
    status: number;
    message?: string;
}

export interface EmailCheckResponse {
    Success: boolean;
}

// Добавим тип для создания пользователя
export interface CreateUserRequest {
    name: string;
    surname: string;
    phone: string;
    email: string;
    password: string;
}