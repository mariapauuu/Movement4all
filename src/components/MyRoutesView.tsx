import { useEffect, useState } from 'react';
import { Calendar, Camera, MapPin, MessageSquare } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import {
  SPORTS,
  formatLevelRange,
  getStatusLabel,
  utcIsoToBogotaParts,
} from '../shared/sports.ts';
import type { SelfUser, WorkoutSummary } from '../shared/types.ts';

interface MyRoutesViewProps {
  user: SelfUser | null;
  onGoToAuth: () => void;
  onGoToExplore: () => void;
  onOpenWorkout: (workoutId: string, initialTab?: 'details' | 'chat') => void;
  onShareMemoryForWorkout: (workoutId: string) => void;
}

export function MyRoutesView({
  user,
  onGoToAuth,
  onGoToExplore,
  onOpenWorkout,
  onShareMemoryForWorkout,
}: MyRoutesViewProps) {
  const [upcoming, setUpcoming] = useState<WorkoutSummary[]>([]);
  const [past, setPast] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        upcoming: WorkoutSummary[];
        past: WorkoutSummary[];
      }>('/api/my-routes');
      setUpcoming(data.upcoming);
      setPast(data.past);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos cargar tus rutas programadas.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-[#E6E4DF] p-8 space-y-4">
          <p className="text-xs font-semibold text-[#FF5A1F]">Agenda personal</p>
          <h1 className="font-display text-4xl font-bold text-[#151515]">
            Tus rutas programadas
          </h1>
          <p className="text-sm text-[#151515]/80 leading-relaxed">
            Inicia sesión para consultar en orden cronológico los entrenamientos en los que estás inscrito, entrar al chat del grupo y compartir recuerdos al terminar.
          </p>
          <button
            type="button"
            onClick={onGoToAuth}
            className="px-5 py-2.5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
          >
            Iniciar sesión o crear cuenta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E6E4DF] pb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#FF5A1F]">
            Planifica tu semana deportiva
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#151515]">
            Tus rutas programadas
          </h1>
        </div>
        <button
          type="button"
          onClick={onGoToExplore}
          className="px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors cursor-pointer"
        >
          Buscar más entrenamientos
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-center justify-between gap-4"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadRoutes}
            className="px-3 py-1.5 text-xs font-semibold bg-[#151515] text-[#F6F5F1] cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((n) => (
            <div key={n} className="h-32 bg-white border border-[#E6E4DF]" />
          ))}
        </div>
      ) : (
        <>
          {/* Upcoming chronological routes */}
          <section className="space-y-4">
            <h2 className="font-display text-3xl font-bold text-[#151515]">
              Próximas rutas ({upcoming.length})
            </h2>

            {upcoming.length === 0 ? (
              <div className="bg-white border border-[#E6E4DF] p-6 space-y-3">
                <p className="text-sm text-[#151515]/75">
                  Aún no tienes entrenamientos próximos programados. Explora las salidas disponibles para sumarte a un grupo.
                </p>
                <button
                  type="button"
                  onClick={onGoToExplore}
                  className="px-4 py-2 text-xs font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
                >
                  Explorar entrenamientos
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((w) => {
                  const sportDef = SPORTS[w.sport];
                  const startParts = utcIsoToBogotaParts(w.startAt);
                  const statusLabel = getStatusLabel(w.status);

                  return (
                    <article
                      key={w.id}
                      className="bg-white border border-[#E6E4DF] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#151515]/75">
                          <span className="text-[#FF5A1F]">{sportDef.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{statusLabel}</span>
                          {w.isCreator && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#151515]">Eres organizador</span>
                            </>
                          )}
                        </div>

                        <h3 className="font-display text-2xl font-bold text-[#151515]">
                          {w.title}
                        </h3>

                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[#151515]/80">
                          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                            <Calendar className="w-4 h-4 text-[#151515]/55" />
                            {startParts.formattedDateTime}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#151515]/55" />
                            {w.municipality} — {w.meetingPoint}
                          </span>
                        </div>

                        <p className="text-xs font-mono tabular-nums text-[#151515]/70">
                          {w.distanceKm} km · {formatLevelRange(w.levelMin, w.levelMax, w.sport)} ·{' '}
                          {w.participantCount}{' '}
                          {w.participantCount === 1 ? 'inscrito' : 'inscritos'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenWorkout(w.id, 'details')}
                          className="px-4 py-2 text-xs font-semibold border border-[#151515] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
                        >
                          Ver detalles
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenWorkout(w.id, 'chat')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chat del grupo
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past / Completed Routes */}
          <section className="space-y-4">
            <h2 className="font-display text-3xl font-bold text-[#151515]">
              Entrenamientos realizados ({past.length})
            </h2>

            {past.length === 0 ? (
              <p className="text-sm text-[#151515]/65">
                Cuando completes un entrenamiento grupal aparecerá aquí para que puedas volver a consultarlo o compartir un recuerdo en Comunidad.
              </p>
            ) : (
              <div className="space-y-3">
                {past.map((w) => {
                  const sportDef = SPORTS[w.sport];
                  const startParts = utcIsoToBogotaParts(w.startAt);
                  return (
                    <article
                      key={w.id}
                      className="bg-white border border-[#E6E4DF] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#151515]/70">
                          <span className="text-[#FF5A1F]">{sportDef.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>Entrenamiento realizado</span>
                        </div>
                        <h3 className="font-display text-2xl font-bold text-[#151515]">
                          {w.title}
                        </h3>
                        <p className="text-xs text-[#151515]/75">
                          <span className="font-mono tabular-nums">
                            {startParts.formattedDateTime}
                          </span>{' '}
                          · {w.municipality} — {w.meetingPoint}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenWorkout(w.id, 'details')}
                          className="px-4 py-2 text-xs font-semibold border border-[#E6E4DF] text-[#151515] hover:border-[#151515] cursor-pointer"
                        >
                          Ver ficha y chat
                        </button>
                        <button
                          type="button"
                          onClick={() => onShareMemoryForWorkout(w.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {w.hasSharedMemory ? 'Compartir otro recuerdo' : 'Compartir recuerdo'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
