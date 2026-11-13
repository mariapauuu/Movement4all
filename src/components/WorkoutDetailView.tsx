import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  Info,
  MapPin,
  MessageSquare,
  Send,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import { ApiError, apiRequest } from '../lib/api.ts';
import { getSportImage } from '../lib/sportMedia.ts';
import {
  SPORTS,
  formatLevelRange,
  getStatusLabel,
  utcIsoToBogotaParts,
} from '../shared/sports.ts';
import type { ChatMessage, SelfUser, WorkoutDetail } from '../shared/types.ts';
import { LocationPicker } from './LocationPicker.tsx';
import { SmartImage } from './SmartImage.tsx';

type DetailTab = 'details' | 'participants' | 'chat';

interface WorkoutDetailViewProps {
  workoutId: string;
  refLat?: number;
  refLng?: number;
  initialTab?: DetailTab;
  user: SelfUser | null;
  justCreated?: boolean;
  onBack: () => void;
  onGoToAuth: () => void;
  onGoToRoutes: () => void;
}

export function WorkoutDetailView({
  workoutId,
  refLat,
  refLng,
  initialTab = 'details',
  user,
  justCreated = false,
  onBack,
  onGoToAuth,
  onGoToRoutes,
}: WorkoutDetailViewProps) {
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(initialTab);

  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const [expandedEmergencyUserId, setExpandedEmergencyUserId] = useState<string | null>(
    null
  );

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        refLat !== undefined && refLng !== undefined
          ? `?refLat=${refLat}&refLng=${refLng}`
          : '';
      const data = await apiRequest<{ workout: WorkoutDetail }>(
        `/api/workouts/${workoutId}${qs}`
      );
      setWorkout(data.workout);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar este entrenamiento.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTab(initialTab);
    setConfirmationMessage(null);
    setEnrollError(null);
    loadDetail();
  }, [workoutId, user?.id]);

  const loadMessages = async (silent = false) => {
    if (!user || !workout?.isEnrolled) return;
    if (!silent) setChatLoading(true);
    setChatError(null);
    try {
      const data = await apiRequest<{ messages: ChatMessage[] }>(
        `/api/workouts/${workoutId}/messages`
      );
      setMessages(data.messages);
    } catch (err) {
      if (!silent) {
        setChatError(
          err instanceof Error ? err.message : 'No se pudo cargar el chat del grupo.'
        );
      }
    } finally {
      if (!silent) setChatLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'chat' && user && workout?.isEnrolled) {
      loadMessages(false);
      const timer = window.setInterval(() => {
        loadMessages(true);
      }, 5000);
      return () => window.clearInterval(timer);
    }
  }, [tab, workout?.id, workout?.isEnrolled, user?.id]);

  const handleEnroll = async () => {
    if (!user) {
      onGoToAuth();
      return;
    }
    setEnrolling(true);
    setEnrollError(null);
    try {
      const res = await apiRequest<{ message: string }>(`/api/workouts/${workoutId}/enroll`, {
        method: 'POST',
      });
      setConfirmationMessage(res.message);
      await loadDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        setEnrollError(err.message);
        await loadDetail();
      } else {
        setEnrollError('No se pudo completar la inscripción.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const content = draftMessage.trim();
    if (!content) return;
    setSendingMessage(true);
    setChatError(null);
    try {
      const res = await apiRequest<{ message: ChatMessage }>(
        `/api/workouts/${workoutId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        }
      );
      setMessages((prev) => [...prev, res.message]);
      setDraftMessage('');
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'No se pudo enviar el mensaje.'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-pulse">
        <div className="h-8 w-36 bg-[#E6E4DF]" />
        <div className="h-64 w-full bg-[#E6E4DF]" />
        <div className="h-40 w-full bg-[#E6E4DF]" />
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#151515] hover:text-[#FF5A1F] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="bg-white border border-[#E6E4DF] p-6 space-y-3">
          <p className="text-sm text-red-700 font-medium">
            {error || 'No se encontró el entrenamiento.'}
          </p>
          <button
            type="button"
            onClick={loadDetail}
            className="px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const sportDef = SPORTS[workout.sport];
  const startParts = utcIsoToBogotaParts(workout.startAt);
  const endParts = utcIsoToBogotaParts(workout.endAt);
  const statusLabel = getStatusLabel(workout.status);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#151515] hover:text-[#FF5A1F] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al listado
      </button>

      {justCreated && (
        <div
          role="status"
          className="bg-white border border-[#151515] p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#151515]">
            <CheckCircle2 className="w-5 h-5 text-[#FF5A1F] shrink-0" />
            <span>
              ¡Entrenamiento publicado! Ya aparece en búsquedas compatibles, en Tus rutas programadas y tiene su chat activo.
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToRoutes}
            className="text-xs font-semibold underline hover:text-[#FF5A1F] cursor-pointer"
          >
            Ver Tus rutas programadas
          </button>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-[#E6E4DF] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 relative min-h-[220px] bg-[#E6E4DF]">
            <SmartImage
              src={getSportImage(workout.sport)}
              alt={`${sportDef.label}: ${workout.title}`}
              className="w-full h-full object-cover"
              fallbackLabel={sportDef.label}
            />
          </div>
          <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#151515]/75">
                <span className="text-[#FF5A1F]">{sportDef.label}</span>
                <span aria-hidden="true">·</span>
                <span>{statusLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {workout.participantCount}{' '}
                  {workout.participantCount === 1 ? 'inscrito' : 'inscritos'}
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-[#151515]">
                {workout.title}
              </h1>

              <div className="flex items-center gap-2.5 pt-1">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#E6E4DF] flex items-center justify-center shrink-0">
                  {workout.creator.avatarUrl ? (
                    <SmartImage
                      src={workout.creator.avatarUrl}
                      alt={workout.creator.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-[#151515]/60" />
                  )}
                </div>
                <span className="text-xs text-[#151515]/75">
                  Propuesto por{' '}
                  <strong className="font-semibold text-[#151515]">
                    {workout.creator.name}
                  </strong>
                </span>
              </div>
            </div>

            {/* Contextual Enrollment CTA */}
            <div className="pt-4 border-t border-[#E6E4DF] space-y-3">
              {enrollError && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{enrollError}</span>
                </div>
              )}

              {workout.isEnrolled ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#151515]">
                    <CheckCircle2 className="w-4 h-4 text-[#FF5A1F]" />
                    Ya estás inscrito en este entrenamiento
                  </span>
                  <button
                    type="button"
                    onClick={() => setTab('chat')}
                    className="px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors cursor-pointer"
                  >
                    Ir al chat del grupo
                  </button>
                </div>
              ) : workout.status === 'open' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#151515]/70">
                    Inscripción abierta hasta 8 horas antes del inicio.
                  </p>
                  <button
                    type="button"
                    disabled={enrolling}
                    onClick={handleEnroll}
                    className="px-5 py-2.5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {enrolling
                      ? 'Confirmando...'
                      : user
                        ? 'Inscribirme'
                        : 'Inicia sesión para inscribirte'}
                  </button>
                </div>
              ) : workout.status === 'closed' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[#151515]/75">
                    Faltan menos de 8 horas para el inicio.
                  </span>
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 text-xs font-semibold bg-[#E6E4DF] text-[#151515]/60 cursor-not-allowed"
                  >
                    Inscripciones cerradas
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[#151515]/75">
                    Este entrenamiento ya finalizó.
                  </span>
                  <span className="px-4 py-2 text-xs font-semibold bg-[#E6E4DF] text-[#151515]/70">
                    Entrenamiento realizado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Post-enrollment confirmation card */}
      {confirmationMessage && (
        <div
          role="status"
          className="bg-[#151515] text-[#F6F5F1] p-6 border border-[#151515] space-y-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#FF5A1F] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                {confirmationMessage}
              </h2>
              <p className="text-xs text-[#F6F5F1]/75 mt-1">
                Tu cupo quedó confirmado y este entrenamiento ya se guardó en Tus rutas programadas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-white/15 text-sm">
            <div>
              <span className="block text-xs text-[#F6F5F1]/60">Entrenamiento</span>
              <span className="font-semibold">
                {workout.title} · {sportDef.label}
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#F6F5F1]/60">Fecha y hora de inicio</span>
              <span className="font-mono tabular-nums">{startParts.formattedDateTime}</span>
            </div>
            <div>
              <span className="block text-xs text-[#F6F5F1]/60">Punto de encuentro</span>
              <span>
                {workout.municipality} — {workout.meetingPoint}
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#F6F5F1]/60">Distancia y nivel</span>
              <span className="font-mono tabular-nums">
                {workout.distanceKm} km · {formatLevelRange(workout.levelMin, workout.levelMax, workout.sport)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#F6F5F1]/60">Hora estimada de finalización</span>
              <span className="font-mono tabular-nums">{endParts.formattedDateTime}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className="px-4 py-2 text-xs font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#F6F5F1] transition-colors cursor-pointer"
            >
              Abrir chat del grupo
            </button>
            <button
              type="button"
              onClick={onGoToRoutes}
              className="px-4 py-2 text-xs font-semibold border border-white/30 text-[#F6F5F1] hover:border-white transition-colors cursor-pointer"
            >
              Ir a Tus rutas programadas
            </button>
          </div>
        </div>
      )}

      {/* Three-tab workout workspace */}
      <div className="bg-white border border-[#E6E4DF]">
        <div
          role="tablist"
          aria-label="Secciones del entrenamiento"
          className="flex border-b border-[#E6E4DF] overflow-x-auto"
        >
          <button
            role="tab"
            type="button"
            aria-selected={tab === 'details'}
            onClick={() => setTab('details')}
            className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
              tab === 'details'
                ? 'border-[#FF5A1F] text-[#151515]'
                : 'border-transparent text-[#151515]/65 hover:text-[#151515]'
            }`}
          >
            Detalles del entrenamiento
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === 'participants'}
            onClick={() => setTab('participants')}
            className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer inline-flex items-center gap-2 ${
              tab === 'participants'
                ? 'border-[#FF5A1F] text-[#151515]'
                : 'border-transparent text-[#151515]/65 hover:text-[#151515]'
            }`}
          >
            <Users className="w-4 h-4" />
            Participantes ({workout.participants.length})
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === 'chat'}
            onClick={() => setTab('chat')}
            className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer inline-flex items-center gap-2 ${
              tab === 'chat'
                ? 'border-[#FF5A1F] text-[#151515]'
                : 'border-transparent text-[#151515]/65 hover:text-[#151515]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat del grupo
          </button>
        </div>

        <div className="p-6">
          {tab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-[#E6E4DF]">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#151515]/60 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Inicio (America/Bogota)
                    </span>
                    <p className="text-sm font-semibold font-mono tabular-nums">
                      {startParts.formattedDateTime}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#151515]/60 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Finalización estimada
                    </span>
                    <p className="text-sm font-semibold font-mono tabular-nums">
                      {endParts.formattedDateTime}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#151515]/60">
                      Distancia del entrenamiento
                    </span>
                    <p className="text-sm font-semibold font-mono tabular-nums">
                      {workout.distanceKm} km
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#151515]/60">
                      Nivel esperado
                    </span>
                    <p className="text-sm font-semibold font-mono tabular-nums">
                      {formatLevelRange(workout.levelMin, workout.levelMax, workout.sport)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-2xl font-bold text-[#151515]">
                    Recorrido descrito
                  </h3>
                  <p className="text-sm text-[#151515]/85 leading-relaxed whitespace-pre-line">
                    {workout.routeDescription}
                  </p>
                </div>

                {workout.hydrationPoints && (
                  <div className="p-4 bg-[#F6F5F1] border border-[#E6E4DF] space-y-1">
                    <h4 className="text-xs font-semibold text-[#151515] flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-[#FF5A1F]" />
                      Puntos de hidratación
                    </h4>
                    <p className="text-sm text-[#151515]/80">{workout.hydrationPoints}</p>
                  </div>
                )}

                {workout.additionalNotes && (
                  <div className="p-4 bg-[#F6F5F1] border border-[#E6E4DF] space-y-1">
                    <h4 className="text-xs font-semibold text-[#151515] flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-[#151515]/70" />
                      Indicaciones adicionales
                    </h4>
                    <p className="text-sm text-[#151515]/80">{workout.additionalNotes}</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#151515]/60 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF5A1F]" /> Punto de encuentro
                  </span>
                  <p className="text-sm font-semibold text-[#151515]">
                    {workout.municipality} — {workout.meetingPoint}
                  </p>
                  {workout.approxDistanceKm !== null && (
                    <p className="text-xs text-[#151515]/65 font-mono tabular-nums">
                      ~{workout.approxDistanceKm} km en línea recta (aprox.) desde tu ubicación de búsqueda
                    </p>
                  )}
                </div>

                <LocationPicker
                  lat={workout.meetingLat}
                  lng={workout.meetingLng}
                  label={workout.meetingPoint}
                  readOnly
                  heightClass="h-64"
                />
              </div>
            </div>
          )}

          {tab === 'participants' && (
            <div className="space-y-5">
              <div className="p-4 bg-[#F6F5F1] border border-[#E6E4DF] flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-[#FF5A1F] shrink-0 mt-0.5" />
                <div className="text-xs text-[#151515]/80 leading-relaxed">
                  <strong className="font-semibold text-[#151515] block mb-0.5">
                    Visibilidad de información de emergencia
                  </strong>
                  {workout.isEnrolled
                    ? 'Estás inscrito en este entrenamiento, por lo que puedes consultar la información de emergencia de tus compañeros para actuar ante cualquier incidente durante la ruta.'
                    : 'Por privacidad, la ubicación de Casa y el correo nunca son públicos, y la información de emergencia solo se muestra a quienes están inscritos en este mismo entrenamiento.'}
                </div>
              </div>

              <ul className="divide-y divide-[#E6E4DF] border border-[#E6E4DF]">
                {workout.participants.map((p) => {
                  const isExpanded = expandedEmergencyUserId === p.id;
                  return (
                    <li key={p.id} className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#E6E4DF] flex items-center justify-center shrink-0">
                            {p.avatarUrl ? (
                              <SmartImage
                                src={p.avatarUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-[#151515]/55" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#151515]">
                              {p.name}
                              {p.isCreator && (
                                <span className="ml-2 text-xs font-medium text-[#FF5A1F]">
                                  · Organizador
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[#151515]/65">
                              {p.sports.map((s) => SPORTS[s].shortLabel).join(' · ')}
                            </p>
                          </div>
                        </div>

                        {p.emergencyInfo && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEmergencyUserId(isExpanded ? null : p.id)
                            }
                            aria-expanded={isExpanded}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#151515] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-[#FF5A1F]" />
                            {isExpanded
                              ? 'Ocultar información de emergencia'
                              : 'Información de emergencia'}
                          </button>
                        )}
                      </div>

                      {p.emergencyInfo && isExpanded && (
                        <div className="p-4 bg-[#F6F5F1] border border-[#E6E4DF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="block text-[#151515]/60">Grupo sanguíneo</span>
                            <span className="font-semibold text-[#151515]">
                              {p.emergencyInfo.bloodType}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[#151515]/60">
                              Restricciones médicas relevantes
                            </span>
                            <span className="font-semibold text-[#151515]">
                              {p.emergencyInfo.medicalRestrictions || 'Ninguna reportada.'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[#151515]/60">
                              Contacto de emergencia
                            </span>
                            <span className="font-semibold text-[#151515]">
                              {p.emergencyInfo.contactName} ({p.emergencyInfo.relation})
                            </span>
                          </div>
                          <div>
                            <span className="block text-[#151515]/60">Teléfono</span>
                            <span className="font-mono font-semibold text-[#151515]">
                              {p.emergencyInfo.contactPhone}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === 'chat' && (
            <div className="space-y-4">
              {!user || !workout.isEnrolled ? (
                <div className="p-6 bg-[#F6F5F1] border border-[#E6E4DF] text-center space-y-3">
                  <MessageSquare className="w-8 h-8 mx-auto text-[#151515]/50" />
                  <h3 className="font-display text-2xl font-bold text-[#151515]">
                    Chat exclusivo para participantes inscritos
                  </h3>
                  <p className="text-sm text-[#151515]/75 max-w-md mx-auto">
                    {user
                      ? 'Inscríbete en este entrenamiento para coordinar el encuentro y leer las novedades del grupo.'
                      : 'Inicia sesión e inscríbete en este entrenamiento para acceder al chat del grupo.'}
                  </p>
                  {!user && (
                    <button
                      type="button"
                      onClick={onGoToAuth}
                      className="px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors cursor-pointer"
                    >
                      Iniciar sesión
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[#151515]/70">
                    Usa este espacio para coordinar detalles logísticos, punto exacto o avisar un retraso. El chat permanece activo incluso después del cierre de inscripciones.
                  </p>

                  {chatError && (
                    <div
                      role="alert"
                      className="p-3 bg-red-50 border border-red-300 text-red-900 text-xs"
                    >
                      {chatError}
                    </div>
                  )}

                  <div className="border border-[#E6E4DF] bg-[#F6F5F1] p-4 max-h-96 overflow-y-auto space-y-3">
                    {chatLoading ? (
                      <p className="text-xs text-[#151515]/60">Cargando mensajes...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-xs text-[#151515]/65">
                        Aún no hay mensajes. Escribe el primero para coordinar con el grupo.
                      </p>
                    ) : (
                      messages.map((msg) => {
                        const isMine = msg.userId === user.id;
                        const msgTime = utcIsoToBogotaParts(msg.createdAt);
                        return (
                          <div
                            key={msg.id}
                            className={`p-3 border ${
                              isMine
                                ? 'bg-white border-[#151515] ml-6'
                                : 'bg-white border-[#E6E4DF] mr-6'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs mb-1">
                              <span className="font-semibold text-[#151515]">
                                {msg.authorName}
                              </span>
                              <span className="font-mono tabular-nums text-[#151515]/55">
                                {msgTime.formattedDateTime}
                              </span>
                            </div>
                            <p className="text-sm text-[#151515]/90 whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="chat-input" className="sr-only">
                      Mensaje para el grupo
                    </label>
                    <input
                      id="chat-input"
                      type="text"
                      value={draftMessage}
                      onChange={(e) => setDraftMessage(e.target.value)}
                      placeholder="Escribe un mensaje para el grupo..."
                      maxLength={1000}
                      className="flex-1 h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
                    />
                    <button
                      type="submit"
                      disabled={sendingMessage || !draftMessage.trim()}
                      className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {sendingMessage ? 'Enviando...' : 'Enviar'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
