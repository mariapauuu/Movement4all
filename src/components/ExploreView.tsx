import { useEffect, useState } from 'react';
import {
  Calendar,
  Compass,
  MapPin,
  Navigation,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { HERO_RUNNING_IMAGE, getSportImage } from '../lib/sportMedia.ts';
import {
  LOCATION_PRESETS,
  SPORT_LIST,
  SPORTS,
  formatLevelRange,
  getStatusLabel,
  isValidSport,
  parseLevelInput,
  utcIsoToBogotaParts,
} from '../shared/sports.ts';
import type { SelfUser, SportId, WorkoutSummary } from '../shared/types.ts';
import { LocationPicker } from './LocationPicker.tsx';
import { SmartImage } from './SmartImage.tsx';

export interface SearchFiltersState {
  sport: SportId | 'all';
  date: string;
  level: string;
  refLabel: string;
  refLat: number;
  refLng: number;
  refSource: 'home' | 'custom' | 'guest_default';
  maxDistanceKm: string;
}

export interface CreatePrefill {
  sport?: SportId;
  date?: string;
  municipality?: string;
  meetingLat?: number;
  meetingLng?: number;
  levelTarget?: string;
}

interface ExploreViewProps {
  user: SelfUser | null;
  filters: SearchFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<SearchFiltersState>>;
  onSelectWorkout: (workoutId: string, refLat: number, refLng: number) => void;
  onCreateFromEmpty: (prefill: CreatePrefill) => void;
  onGoToProfile: () => void;
}

export function ExploreView({
  user,
  filters,
  setFilters,
  onSelectWorkout,
  onCreateFromEmpty,
  onGoToProfile,
}: ExploreViewProps) {
  const defaultPreset = LOCATION_PRESETS[0];

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [draftLocation, setDraftLocation] = useState({
    lat: filters.refLat,
    lng: filters.refLng,
    label: filters.refLabel,
  });

  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState(false);

  // Sync to user's Casa automatically when signing in if user hasn't picked a custom location
  useEffect(() => {
    if (user && filters.refSource === 'guest_default') {
      setFilters((prev) => ({
        ...prev,
        refLabel: `Casa (${user.homeLabel})`,
        refLat: user.homeLat,
        refLng: user.homeLng,
        refSource: 'home',
        maxDistanceKm: String(user.maxTravelKm),
      }));
    } else if (!user && filters.refSource === 'home') {
      setFilters((prev) => ({
        ...prev,
        refLabel: defaultPreset.label,
        refLat: defaultPreset.lat,
        refLng: defaultPreset.lng,
        refSource: 'guest_default',
      }));
    }
  }, [user]);

  const fetchWorkouts = async (currentFilters: SearchFiltersState, showPast: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentFilters.sport !== 'all') params.set('sport', currentFilters.sport);
      if (currentFilters.date) params.set('date', currentFilters.date);
      if (currentFilters.sport !== 'all' && currentFilters.level.trim()) {
        params.set('level', currentFilters.level.trim());
      }
      params.set('refLat', String(currentFilters.refLat));
      params.set('refLng', String(currentFilters.refLng));
      if (currentFilters.maxDistanceKm.trim()) {
        params.set('maxDistanceKm', currentFilters.maxDistanceKm.trim());
      }
      if (showPast) {
        params.set('includePast', '1');
      }

      const data = await apiRequest<{ workouts: WorkoutSummary[] }>(
        `/api/workouts?${params.toString()}`
      );
      setWorkouts(data.workouts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos cargar los entrenamientos disponibles.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts(filters, includePast);
  }, [
    filters.sport,
    filters.date,
    filters.level,
    filters.refLat,
    filters.refLng,
    filters.maxDistanceKm,
    includePast,
    user?.id,
  ]);

  const handleUseHome = () => {
    if (!user) {
      onGoToProfile();
      return;
    }
    setFilters((prev) => ({
      ...prev,
      refLabel: `Casa (${user.homeLabel})`,
      refLat: user.homeLat,
      refLng: user.homeLng,
      refSource: 'home',
      maxDistanceKm: String(user.maxTravelKm),
    }));
  };

  const handleOpenChangeLocation = () => {
    setDraftLocation({
      lat: filters.refLat,
      lng: filters.refLng,
      label: filters.refSource === 'home' && user ? user.homeLabel : filters.refLabel,
    });
    setLocationModalOpen(true);
  };

  const handleConfirmLocation = () => {
    setFilters((prev) => ({
      ...prev,
      refLat: draftLocation.lat,
      refLng: draftLocation.lng,
      refLabel: draftLocation.label || 'Ubicación personalizada en el mapa',
      refSource: 'custom',
    }));
    setLocationModalOpen(false);
  };

  const handleResetFilters = () => {
    setIncludePast(false);
    setFilters({
      sport: 'all',
      date: '',
      level: '',
      refLabel: user ? `Casa (${user.homeLabel})` : defaultPreset.label,
      refLat: user ? user.homeLat : defaultPreset.lat,
      refLng: user ? user.homeLng : defaultPreset.lng,
      refSource: user ? 'home' : 'guest_default',
      maxDistanceKm: user ? String(user.maxTravelKm) : '50',
    });
  };

  const selectedSportDef =
    filters.sport !== 'all' && isValidSport(filters.sport)
      ? SPORTS[filters.sport]
      : null;

  return (
    <div className="space-y-8">
      {/* Compact Editorial Hero + Immediate Search Engine */}
      <section className="bg-[#151515] text-[#F6F5F1] border-b border-[#151515]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-[#FF5A1F]">
                  Entrenamientos grupales autogestionados
                </p>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[0.95] text-balance">
                  Encuentra con quién moverte
                </h1>
                <p className="text-sm sm:text-base text-[#F6F5F1]/80 max-w-2xl leading-relaxed">
                  Busca salidas de running, ciclismo de montaña, ciclismo de ruta o aguas abiertas según tu ritmo, fecha y punto de referencia. Sin tarifas ni rankings.
                </p>
              </div>

              {/* Search Panel */}
              <div className="bg-[#F6F5F1] text-[#151515] p-4 sm:p-5 border border-[#E6E4DF] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Sport */}
                  <div>
                    <label
                      htmlFor="filter-sport"
                      className="block text-xs font-semibold text-[#151515]/80 mb-1"
                    >
                      Deporte
                    </label>
                    <select
                      id="filter-sport"
                      value={filters.sport}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          sport: e.target.value as SportId | 'all',
                          level: '',
                        }))
                      }
                      className="w-full h-10 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
                    >
                      <option value="all">Todos los deportes</option>
                      {SPORT_LIST.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label
                      htmlFor="filter-date"
                      className="block text-xs font-semibold text-[#151515]/80 mb-1"
                    >
                      Fecha (Colombia)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id="filter-date"
                        type="date"
                        value={filters.date}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, date: e.target.value }))
                        }
                        className="w-full h-10 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
                      />
                      {filters.date && (
                        <button
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, date: '' }))
                          }
                          aria-label="Limpiar fecha"
                          className="h-10 px-2.5 border border-[#E6E4DF] bg-white hover:border-[#151515] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expected Level */}
                  <div>
                    <label
                      htmlFor="filter-level"
                      className="block text-xs font-semibold text-[#151515]/80 mb-1"
                    >
                      {selectedSportDef
                        ? `Nivel esperado (${selectedSportDef.unit})`
                        : 'Nivel esperado'}
                    </label>
                    <input
                      id="filter-level"
                      type="text"
                      disabled={!selectedSportDef}
                      value={filters.level}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, level: e.target.value }))
                      }
                      placeholder={
                        selectedSportDef
                          ? `Ej. ${selectedSportDef.exampleTarget}`
                          : 'Elige un deporte primero'
                      }
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-[#E6E4DF] focus:border-[#151515] disabled:bg-[#E6E4DF]/50 disabled:text-[#151515]/50"
                    />
                    {selectedSportDef &&
                      filters.level.trim() !== '' &&
                      parseLevelInput(filters.level, selectedSportDef.id) === null && (
                        <p className="text-[11px] text-red-700 mt-1">
                          Formato inválido. Ej: {selectedSportDef.exampleTarget}
                        </p>
                      )}
                  </div>
                </div>

                {/* Location Row + Max Distance */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[#E6E4DF]">
                  <div className="sm:col-span-8 space-y-1.5">
                    <span className="block text-xs font-semibold text-[#151515]/80">
                      Ubicación de referencia para buscar
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6E4DF] text-sm w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
                        <MapPin
                          className="w-4 h-4 text-[#FF5A1F] shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium">
                          {filters.refLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenChangeLocation}
                        className="h-10 px-3 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Cambiar ubicación
                      </button>
                      <button
                        type="button"
                        onClick={handleUseHome}
                        className="h-10 px-3 text-xs font-semibold border border-[#151515] text-[#151515] bg-white hover:bg-[#E6E4DF]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Usar Casa
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label
                      htmlFor="filter-distance"
                      className="block text-xs font-semibold text-[#151515]/80 mb-1.5"
                    >
                      Distancia máx. al encuentro (km)
                    </label>
                    <input
                      id="filter-distance"
                      type="number"
                      min={1}
                      max={500}
                      value={filters.maxDistanceKm}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          maxDistanceKm: e.target.value,
                        }))
                      }
                      placeholder="Sin límite"
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-[#E6E4DF] focus:border-[#151515]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Editorial Media Column */}
            <div className="lg:col-span-5 relative overflow-hidden min-h-[220px] lg:min-h-0 border border-white/10">
              <SmartImage
                src={HERO_RUNNING_IMAGE}
                alt="Grupo de deportistas aficionados corriendo juntos al amanecer"
                className="w-full h-full object-cover"
                fallbackLabel="Comunidad Movement4all"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
              />
              <div className="absolute bottom-4 left-4 right-4 text-[#F6F5F1]">
                <p className="font-display text-2xl font-bold leading-tight">
                  Ritmo compatible, cero presión competitiva
                </p>
                <p className="text-xs text-[#F6F5F1]/85 mt-1">
                  Inscríbete hasta 8 horas antes y coordina el encuentro directo en el chat del grupo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Header & List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E4DF] pb-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#151515]">
              Entrenamientos disponibles
            </h2>
            <p className="text-xs sm:text-sm text-[#151515]/70 mt-0.5">
              {loading
                ? 'Buscando grupos compatibles...'
                : `${workouts.length} ${workouts.length === 1 ? 'entrenamiento encontrado' : 'entrenamientos encontrados'} · Distancia aproximada en línea recta desde tu punto de referencia`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#151515]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(e) => setIncludePast(e.target.checked)}
                className="w-4 h-4 accent-[#FF5A1F]"
              />
              Mostrar entrenamientos ya realizados
            </label>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs font-semibold border border-[#E6E4DF] bg-white hover:border-[#151515] transition-colors cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-4 bg-white border border-red-300 text-red-900 text-sm flex items-center justify-between gap-4"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchWorkouts(filters, includePast)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#151515] text-[#F6F5F1] cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white border border-[#E6E4DF] overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#E6E4DF]" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-36 bg-[#E6E4DF]" />
                  <div className="h-6 w-3/4 bg-[#E6E4DF]" />
                  <div className="h-4 w-full bg-[#E6E4DF]" />
                  <div className="h-10 w-full bg-[#E6E4DF]" />
                </div>
              </div>
            ))}
          </div>
        ) : workouts.length === 0 ? (
          <div className="bg-white border border-[#E6E4DF] p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
            <Compass className="w-10 h-10 mx-auto text-[#FF5A1F]" aria-hidden="true" />
            <h3 className="font-display text-3xl font-bold text-[#151515]">
              No hay entrenamientos con estos filtros
            </h3>
            <p className="text-sm text-[#151515]/75 leading-relaxed">
              Puedes ampliar la distancia máxima de búsqueda, probar otra fecha o proponer tú mismo este entrenamiento para que otros deportistas cercanos se sumen.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  onCreateFromEmpty({
                    sport: filters.sport !== 'all' ? filters.sport : undefined,
                    date: filters.date || undefined,
                    meetingLat: filters.refLat,
                    meetingLng: filters.refLng,
                    levelTarget: filters.level || undefined,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Crear entrenamiento
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2.5 text-sm font-semibold border border-[#E6E4DF] hover:border-[#151515] transition-colors cursor-pointer"
              >
                Ver todos los disponibles
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.map((w) => {
              const sportDef = SPORTS[w.sport];
              const startParts = utcIsoToBogotaParts(w.startAt);
              const statusLabel = getStatusLabel(w.status);

              return (
                <article
                  key={w.id}
                  className="bg-white border border-[#E6E4DF] flex flex-col justify-between transition-colors hover:border-[#151515]"
                >
                  <div>
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#E6E4DF]">
                      <SmartImage
                        src={getSportImage(w.sport)}
                        alt={`${sportDef.label}: ${w.title}`}
                        className="w-full h-full object-cover"
                        fallbackLabel={sportDef.label}
                      />
                    </div>

                    <div className="p-5 space-y-3">
                      {/* Clean unboxed metadata kicker */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#151515]/75">
                        <span className="text-[#FF5A1F]">{sportDef.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{statusLabel}</span>
                        {w.isEnrolled && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#151515]">Ya estás inscrito</span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-2xl font-bold leading-tight text-[#151515]">
                        {w.title}
                      </h3>

                      <div className="space-y-1.5 text-sm text-[#151515]/80">
                        <p className="flex items-start gap-2">
                          <Calendar
                            className="w-4 h-4 mt-0.5 shrink-0 text-[#151515]/55"
                            aria-hidden="true"
                          />
                          <span className="tabular-nums">
                            {startParts.formattedDateTime}
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <MapPin
                            className="w-4 h-4 mt-0.5 shrink-0 text-[#151515]/55"
                            aria-hidden="true"
                          />
                          <span>
                            <strong className="font-semibold text-[#151515]">
                              {w.municipality}
                            </strong>{' '}
                            — {w.meetingPoint}
                          </span>
                        </p>
                        {w.approxDistanceKm !== null && (
                          <p className="flex items-center gap-2 text-xs text-[#151515]/65">
                            <Navigation
                              className="w-3.5 h-3.5 shrink-0 text-[#FF5A1F]"
                              aria-hidden="true"
                            />
                            <span className="font-mono tabular-nums">
                              ~{w.approxDistanceKm} km en línea recta (aprox.)
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#E6E4DF] grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="block text-[#151515]/60">
                            Distancia del entrenamiento
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-sm text-[#151515]">
                            {w.distanceKm} km
                          </span>
                        </div>
                        <div>
                          <span className="block text-[#151515]/60">
                            Nivel esperado
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-sm text-[#151515]">
                            {formatLevelRange(w.levelMin, w.levelMax, w.sport)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-[#E6E4DF] bg-[#F6F5F1]/60 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#151515]/80 tabular-nums">
                      <Users className="w-4 h-4 text-[#151515]/60" aria-hidden="true" />
                      {w.participantCount}{' '}
                      {w.participantCount === 1 ? 'inscrito' : 'inscritos'}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        onSelectWorkout(w.id, filters.refLat, filters.refLng)
                      }
                      className="px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Ver detalles
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Change Reference Location Modal */}
      {locationModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-location-title"
        >
          <div className="bg-[#F6F5F1] border border-[#151515] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="modal-location-title"
                  className="font-display text-2xl font-bold text-[#151515]"
                >
                  Cambiar ubicación de búsqueda
                </h3>
                <p className="text-xs text-[#151515]/75 mt-0.5">
                  Esto actualiza solo tu búsqueda actual (por ejemplo, si estás de viaje) sin modificar tu ubicación habitual de Casa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                aria-label="Cerrar selector"
                className="p-2 border border-[#E6E4DF] hover:border-[#151515] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label
                htmlFor="custom-ref-label"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Nombre de referencia (opcional)
              </label>
              <input
                id="custom-ref-label"
                type="text"
                value={draftLocation.label}
                onChange={(e) =>
                  setDraftLocation((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="Ej. Hotel en Guatapé, Visita a Marinilla..."
                className="w-full h-10 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
            </div>

            <LocationPicker
              lat={draftLocation.lat}
              lng={draftLocation.lng}
              label={draftLocation.label}
              onChange={(next) =>
                setDraftLocation((prev) => ({
                  lat: next.lat,
                  lng: next.lng,
                  label: next.label || prev.label || 'Punto en el mapa',
                }))
              }
            />

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E6E4DF]">
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold border border-[#E6E4DF] bg-white hover:border-[#151515] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="px-5 py-2 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
              >
                Aplicar ubicación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
