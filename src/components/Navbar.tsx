import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { SelfUser } from '../shared/types.ts';

export type AppView =
  | 'explore'
  | 'create'
  | 'routes'
  | 'community'
  | 'profile';

interface NavbarProps {
  activeView: AppView;
  user: SelfUser | null;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'explore', label: 'Explorar' },
  { id: 'create', label: 'Crear entrenamiento' },
  { id: 'routes', label: 'Tus rutas programadas' },
  { id: 'community', label: 'Comunidad' },
  { id: 'profile', label: 'Mi perfil' },
];

export function Navbar({ activeView, user, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (view: AppView) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  const firstName = user ? user.name.split(' ')[0] : '';

  return (
    <header className="sticky top-0 z-40 bg-[#F6F5F1]/95 backdrop-blur-sm border-b border-[#E6E4DF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('explore')}
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#151515] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Movement4all
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navegación principal"
          className="hidden lg:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-1.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#151515]'
                    : 'text-[#151515]/65 hover:text-[#151515]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-[#FF5A1F]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action + mobile drawer toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('profile')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user ? `Hola, ${firstName}` : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 border border-[#E6E4DF] text-[#151515] hover:border-[#151515] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#E6E4DF] bg-[#F6F5F1] px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#151515] text-[#F6F5F1]'
                    : 'text-[#151515] hover:bg-[#E6E4DF]/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleSelect('profile')}
            className="w-full text-left px-3 py-2.5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] cursor-pointer sm:hidden"
          >
            {user ? `Mi cuenta (${firstName})` : 'Iniciar sesión o registrarme'}
          </button>
        </div>
      )}
    </header>
  );
}
