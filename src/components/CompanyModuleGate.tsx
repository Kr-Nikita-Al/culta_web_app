import React from 'react';
import {useCompanies} from '../context/CompaniesContext';
import {useSelectedCompany} from '../context/SelectedCompanyContext';

export type CompanyModule = 'orders' | 'reservations' | 'images';
export function useCompanyModules() {
    const {companies} = useCompanies();
    const {selectedCompany} = useSelectedCompany();
    const company = companies.find(c=>c.company_id === selectedCompany);
    return {orders: company?.orders_enabled !== false, reservations: company?.reservations_enabled !== false,
        images: company?.images_enabled !== false};
}
export default function CompanyModuleGate({module,children}:{module:CompanyModule;children:React.ReactNode}) {
    const modules = useCompanyModules();
    return modules[module] ? <>{children}</> : <section className="workspace-card"><h2 className="section-title">Раздел отключён</h2><p>Администратор может включить его в настройках инфраструктуры компании.</p></section>;
}
