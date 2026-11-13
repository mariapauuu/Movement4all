import { useEffect, useState } from 'react';
import { apiRequest, setOnUnauthorizedCallback } from './lib/api.ts';
import { LOCATION_PRESETS } from './shared/sports.ts';
import type { SelfUser } from './shared/types.ts';
import { CommunityView } from './components/CommunityView.tsx';
import { CreateWorkoutView } from './components/CreateWorkoutView.tsx';
import {
  ExploreView,
  type CreatePrefill,
  type SearchFiltersState,
} from './components/ExploreView.tsx';
import { MyRoutesView } from './components/MyRoutesView.tsx';
import { Navbar, type AppView } from './components/Navbar.tsx';
import { ProfileAuthView } from './components/ProfileAuthView.tsx';
import { WorkoutDetailView } from './components/WorkoutDetailView.tsx';

interface SelectedWorkoutState {
  id: string;
  refLat?: number;
  refLng?: number;
  initialTab?: 'details' | 'participants' | 'chat';
  justCreated?: boolean;
  returnTo: AppView;
}

export default function App() {
  const [user, setUser] = useState<SelfUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeView, setActiveView] = useState<AppView>('explore');
  const [selectedWorkout, setSelectedWorkout] = useState<SelectedWorkoutState | null>(null);
  const [createPrefill, setCreatePrefill] = useState<CreatePrefill | null>(null);
  const [memoryWorkoutId, setMemoryWorkoutId] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFiltersState>({
    sport: 'all',
    date: '',
    level: '',
    refLabel: LOCATION_PRESETS[0].label,
    refLat: LOCATION_PRESETS[0].lat,
    refLng: LOCATION_PRESETS[0].lng,
    refSource: 'guest_default',
    maxDistanceKm: '50',
  });

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      setUser(null);
    });
    let active = true;
    apiRequest<{ user: SelfUser | null }>('/api/auth/me')
      .then((res) => {
        if (active) setUser(res.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
      setOnUnauthorizedCallback(null);
    };
  }, []);

  const navigateTo = (view: AppView) => {
    setSelectedWorkout(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenWorkout = (
    id: string,
    returnTo: AppView,
    options?: {
      refLat?: number;
      refLng?: number;
      initialTab?: 'details' | 'participants' | 'chat';
      justCreated?: boolean;
    }
  ) => {
    setSelectedWorkout({
      id,
      returnTo,
      refLat: options?.refLat,
      refLng: options?.refLng,
      initialTab: options?.initialTab,
      justCreated: options?.justCreated,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F1] text-[#151515]">
      <Navbar activeView={activeView} user={user} onNavigate={navigateTo} />

      <main className="flex-1">
        {!authChecked ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse">
            <div className="h-56 bg-[#E6E4DF]" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-64 bg-[#E6E4DF]" />
              <div className="h-64 bg-[#E6E4DF]" />
              <div className="h-64 bg-[#E6E4DF]" />
            </div>
          </div>
        ) : selectedWorkout ? (
          <WorkoutDetailView
            workoutId={selectedWorkout.id}
            refLat={selectedWorkout.refLat}
            refLng={selectedWorkout.refLng}
            initialTab={selectedWorkout.initialTab}
            justCreated={selectedWorkout.justCreated}
            user={user}
            onBack={() => {
              const target = selectedWorkout.returnTo;
              setSelectedWorkout(null);
              setActiveView(target);
            }}
            onGoToAuth={() => {
              setSelectedWorkout(null);
              setActiveView('profile');
            }}
            onGoToRoutes={() => {
              setSelectedWorkout(null);
              setActiveView('routes');
            }}
          />
        ) : activeView === 'explore' ? (
          <ExploreView
            user={user}
            filters={searchFilters}
            setFilters={setSearchFilters}
            onSelectWorkout={(id, refLat, refLng) =>
              handleOpenWorkout(id, 'explore', { refLat, refLng })
            }
            onCreateFromEmpty={(prefill) => {
              setCreatePrefill(prefill);
              navigateTo('create');
            }}
            onGoToProfile={() => navigateTo('profile')}
          />
        ) : activeView === 'create' ? (
          <CreateWorkoutView
            user={user}
            prefill={createPrefill}
            onGoToAuth={() => navigateTo('profile')}
            onCreated={(workoutId) => {
              setCreatePrefill(null);
              handleOpenWorkout(workoutId, 'routes', {
                initialTab: 'details',
                justCreated: true,
              });
            }}
          />
        ) : activeView === 'routes' ? (
          <MyRoutesView
            user={user}
            onGoToAuth={() => navigateTo('profile')}
            onGoToExplore={() => navigateTo('explore')}
            onOpenWorkout={(id, initialTab) =>
              handleOpenWorkout(id, 'routes', { initialTab })
            }
            onShareMemoryForWorkout={(workoutId) => {
              setMemoryWorkoutId(workoutId);
              navigateTo('community');
            }}
          />
        ) : activeView === 'community' ? (
          <CommunityView
            user={user}
            preselectedWorkoutId={memoryWorkoutId}
            onClearPreselected={() => setMemoryWorkoutId(null)}
            onGoToAuth={() => navigateTo('profile')}
            onGoToExplore={() => navigateTo('explore')}
          />
        ) : (
          <ProfileAuthView
            user={user}
            onAuthChange={(nextUser) => setUser(nextUser)}
            onExploreAfterAuth={() => navigateTo('explore')}
          />
        )}
      </main>

      <footer className="border-t border-[#E6E4DF] bg-[#F6F5F1] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#151515]/70">
          <div className="space-y-1">
            <p className="font-display text-lg font-bold text-[#151515]">Movement4all</p>
            <p>
              Encuentra con quién moverte · Running, ciclismo de montaña, ciclismo de ruta y aguas abiertas.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 font-semibold text-[#151515]">
            <button
              type="button"
              onClick={() => navigateTo('explore')}
              className="hover:text-[#FF5A1F] cursor-pointer"
            >
              Explorar
            </button>
            <button
              type="button"
              onClick={() => navigateTo('create')}
              className="hover:text-[#FF5A1F] cursor-pointer"
            >
              Crear entrenamiento
            </button>
            <button
              type="button"
              onClick={() => navigateTo('routes')}
              className="hover:text-[#FF5A1F] cursor-pointer"
            >
              Tus rutas programadas
            </button>
            <button
              type="button"
              onClick={() => navigateTo('community')}
              className="hover:text-[#FF5A1F] cursor-pointer"
            >
              Comunidad
            </button>
            <button
              type="button"
              onClick={() => navigateTo('profile')}
              className="hover:text-[#FF5A1F] cursor-pointer"
            >
              Mi perfil
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
