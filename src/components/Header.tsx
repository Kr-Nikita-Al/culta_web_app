import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg'

const Header: React.FC = () => {
    const { token, logout } = useAuth();

    return (
        <header className="bg-coffee-dark text-white p-4 flex justify-between items-center">
            <Link to="/" className="flex items-center">
                <img src={logo} alt="Cafe Logo" className="h-10 mr-3" />
                <span className="text-xl font-semibold">CoffeeStaff</span>
            </Link>

            {token && (
                <button
                    onClick={logout}
                    className="bg-amber-700 hover:bg-amber-800 py-2 px-4 rounded transition"
                >
                    Выйти
                </button>
            )}
        </header>
    );
};

export default Header;