export interface LoginData {
    username: string;
    password: string;
}

export interface UserRole {
    company_id: string;
    role: string;
    company_name?: string; // Добавим опциональное поле, если сервер его возвращает
}

// Для роли с дополнительной информацией о компании
export interface RoleWithCompany extends UserRole {
    company_name?: string;
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

export interface Screen {
    screen_id: string;
}



export interface CompanyResponse {
    company_id: string;
    company_name: string;
    address: string;
    phone: string;
    email: string;
    is_active: boolean;
    order_number: number;
    basic_screen_id: string;
    group_id: number;
    image_picture_id: string;
    image_icon_id: string;
    age_limit: boolean;
    work_state: boolean;
    creator_id: string;
    updater_id: string;
    time_created: string;
    time_updated: string;
    start_time: string;
    over_time: string;
    screens: Screen[];
}

export interface CompaniesListResponse {
    companies: Company[];
}

// Удалим старый тип Company или переименуем его
export interface Company extends CompanyResponse {}

// Обновим интерфейс UserInfo
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
    roles?: UserRole[]; // Добавим опциональное поле для ролей
}