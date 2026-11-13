import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Clock, Plus } from 'lucide-react';
import { ApiError, apiRequest } from '../lib/api.ts';
import {
  EIGHT_HOURS_MS,
  LOCATION_PRESETS,
  SPORT_LIST,
  SPORTS,
  bogotaLocalToUtcIso,
  parseLevelInput,
  utcIsoToBogotaParts,
} from '../shared/sports.ts';
import type { SelfUser, SportId, WorkoutSummary } from '../shared/types.ts';
import type { CreatePrefill } from './ExploreView.tsx';
import { LocationPicker } from './LocationPicker.tsx';

interface CreateWorkoutViewProps {
  user: SelfUser | null;
  prefill: CreatePrefill | null;
  onGoToAuth: () => void;
  onCreated: (workoutId: string) => void;
}

export function CreateWorkoutView({
  user,
  prefill,
  onGoToAuth,
  onCreated,
}: CreateWorkoutViewProps) {
  const defaultPreset = LOCATION_PRESETS[0];
  const defaultStartParts = utcIsoToBogotaParts(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  );
  const defaultEndParts = utcIsoToBogotaParts(
    new Date(Date.now() + 25.5 * 60 * 60 * 1000).toISOString()
  );

  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<SportId>(prefill?.sport || 'running');
  const [startDate, setStartDate] = useState(prefill?.date || defaultStartParts.date);
  const [startTime, setStartTime] = useState('06:30');
  const [endDate, setEndDate] = useState(prefill?.date || defaultEndParts.date);
  const [endTime, setEndTime] = useState('08:00');
  const [municipality, setMunicipality] = useState(
    prefill?.municipality || defaultPreset.municipality
  );
  const [meetingPoint, setMeetingPoint] = useState('');
  const [meetingLat, setMeetingLat] = useState(
    prefill?.meetingLat ?? user?.homeLat ?? defaultPreset.lat
  );
  const [meetingLng, setMeetingLng] = useState(
    prefill?.meetingLng ?? user?.homeLng ?? defaultPreset.lng
  );
  const [routeDescription, setRouteDescription] = useState('');
  const [distanceKm, setDistanceKm] = useState('10');
  const [levelMin, setLevelMin] = useState(prefill?.levelTarget || '');
  const [levelMax, setLevelMax] = useState('');
  const [hydrationPoints, setHydrationPoints] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prefill) {
      if (prefill.sport) setSport(prefill.sport);
      if (prefill.date) {
        setStartDate(prefill.date);
        setEndDate(prefill.date);
      }
      if (prefill.meetingLat !== undefined) setMeetingLat(prefill.meetingLat);
      if (prefill.meetingLng !== undefined) setMeetingLng(prefill.meetingLng);
      if (prefill.municipality) setMunicipality(prefill.municipality);
      if (prefill.levelTarget) setLevelMin(prefill.levelTarget);
    }
  }, [prefill]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-[#E6E4DF] p-8 space-y-4">
          <p className="text-xs font-semibold text-[#FF5A1F]">Crear entrenamiento</p>
          <h1 className="font-display text-4xl font-bold text-[#151515]">
            Inicia sesión para proponer un entrenamiento
          </h1>
          <p className="text-sm text-[#151515]/80 leading-relaxed">
            Cualquier deportista registrado puede crear entrenamientos grupales, definir el nivel esperado y coordinar con los inscritos en el chat del grupo.
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

  const sportDef = SPORTS[sport];

  const validateClient = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (title.trim().length < 4) {
      errs.title = 'Escribe un nombre descriptivo (mínimo 4 caracteres).';
    }
    const startIso = bogotaLocalToUtcIso(startDate, startTime);
    const endIso = bogotaLocalToUtcIso(endDate, endTime);
    if (!startIso) errs.startTime = 'Indica fecha y hora de inicio válidas.';
    if (!endIso) errs.endTime = 'Indica fecha y hora de finalización válidas.';

    if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      errs.endTime = 'La hora estimada de finalización debe ser posterior al inicio.';
    }
    if (startIso && new Date(startIso).getTime() - Date.now() < EIGHT_HOURS_MS) {
      errs.startTime =
        'Debes publicar el entrenamiento con mínimo 8 horas de anticipación (hora Colombia).';
    }
    if (municipality.trim().length < 2) {
      errs.municipality = 'Indica el municipio del encuentro.';
    }
    if (meetingPoint.trim().length < 4) {
      errs.meetingPoint = 'Describe el punto de encuentro.';
    }
    if (routeDescription.trim().length < 10) {
      errs.routeDescription = 'Describe el recorrido (mínimo 10 caracteres).';
    }
    const dist = Number(distanceKm);
    if (!Number.isFinite(dist) || dist <= 0) {
      errs.distanceKm = 'La distancia debe ser un número positivo mayor a 0.';
    }
    const minVal = parseLevelInput(levelMin, sport);
    const maxVal = parseLevelInput(levelMax, sport);
    if (minVal === null || minVal < sportDef.minAllowed || minVal > sportDef.maxAllowed) {
      errs.levelMin = `Ingresa un mínimo válido en ${sportDef.unit}.`;
    }
    if (maxVal === null || maxVal < sportDef.minAllowed || maxVal > sportDef.maxAllowed) {
      errs.levelMax = `Ingresa un máximo válido en ${sportDef.unit}.`;
    }
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
      errs.levelMax = 'El valor máximo debe ser mayor o igual al mínimo.';
    }
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const localErrors = validateClient();
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setFormError('Revisa los campos señalados antes de publicar.');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await apiRequest<{ workout: WorkoutSummary }>('/api/workouts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          sport,
          startDate,
          startTime,
          endDate,
          endTime,
          municipality: municipality.trim(),
          meetingPoint: meetingPoint.trim(),
          meetingLat,
          meetingLng,
          routeDescription: routeDescription.trim(),
          distanceKm: Number(distanceKm),
          levelMin: levelMin.trim(),
          levelMax: levelMax.trim(),
          hydrationPoints: hydrationPoints.trim(),
          additionalNotes: additionalNotes.trim(),
        }),
      });
      onCreated(res.workout.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors || {});
      } else {
        setFormError('No se pudo publicar el entrenamiento.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#FF5A1F]">
          Proponer salida grupal
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#151515]">
          Crear entrenamiento
        </h1>
        <p className="text-sm text-[#151515]/75">
          Comparte los detalles logísticos para que otros deportistas compatibles se sumen y coordinen contigo desde el primer momento.
        </p>
      </div>

      {/* Mandatory 8-hour advance notice */}
      <div className="bg-[#151515] text-[#F6F5F1] p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-[#FF5A1F] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs sm:text-sm leading-relaxed">
          <strong className="font-semibold">Plazo mínimo de anticipación:</strong>{' '}
          Todo entrenamiento debe publicarse con al menos <strong>8 horas de anticipación</strong> (hora oficial de Colombia, America/Bogota). Al publicarlo quedarás inscrito automáticamente como organizador.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Section 1: Basic Info & Schedule */}
        <section className="bg-white border border-[#E6E4DF] p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold text-[#151515] border-b border-[#E6E4DF] pb-3">
            1. Actividad y horarios (America/Bogota)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="cw-title"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Nombre del entrenamiento *
              </label>
              <input
                id="cw-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Rodaje matutino suave por Parques del Río"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.title && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.title}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="cw-sport"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Deporte *
              </label>
              <select
                id="cw-sport"
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value as SportId);
                  setLevelMin('');
                  setLevelMax('');
                }}
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              >
                {SPORT_LIST.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="cw-start-date"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Fecha de inicio *
              </label>
              <input
                id="cw-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
            </div>

            <div>
              <label
                htmlFor="cw-start-time"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Hora de inicio *
              </label>
              <input
                id="cw-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-11 px-3 text-sm font-mono bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.startTime && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.startTime}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="cw-end-date"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Fecha estimada de finalización *
              </label>
              <input
                id="cw-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
            </div>

            <div>
              <label
                htmlFor="cw-end-time"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Hora estimada de finalización *
              </label>
              <input
                id="cw-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-11 px-3 text-sm font-mono bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.endTime && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.endTime}</p>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Location & Route */}
        <section className="bg-white border border-[#E6E4DF] p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold text-[#151515] border-b border-[#E6E4DF] pb-3">
            2. Ubicación de encuentro y recorrido
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cw-municipality"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Municipio *
              </label>
              <input
                id="cw-municipality"
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Ej. Medellín, Envigado, Marinilla, Guatapé"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.municipality && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.municipality}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="cw-meeting"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Punto de encuentro *
              </label>
              <input
                id="cw-meeting"
                type="text"
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="Ej. Puerta norte del Estadio Atanasio Girardot"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.meetingPoint && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.meetingPoint}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-xs font-semibold text-[#151515]">
              Coordenadas del punto de encuentro *
            </span>
            <LocationPicker
              lat={meetingLat}
              lng={meetingLng}
              label={meetingPoint || municipality}
              onChange={(next) => {
                setMeetingLat(next.lat);
                setMeetingLng(next.lng);
                if (next.municipality) setMunicipality(next.municipality);
                if (next.label && !meetingPoint) setMeetingPoint(next.label);
              }}
            />
            {fieldErrors.meetingCoords && (
              <p className="text-xs text-red-700 mt-1">{fieldErrors.meetingCoords}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="cw-route"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Descripción del recorrido *
            </label>
            <textarea
              id="cw-route"
              rows={3}
              value={routeDescription}
              onChange={(e) => setRouteDescription(e.target.value)}
              placeholder="Describe calles principales, senderos, retornos o desnivel aproximado."
              className="w-full p-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {fieldErrors.routeDescription && (
              <p className="text-xs text-red-700 mt-1">{fieldErrors.routeDescription}</p>
            )}
          </div>
        </section>

        {/* Section 3: Distance, Pace/Speed Interval & Logistics */}
        <section className="bg-white border border-[#E6E4DF] p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold text-[#151515] border-b border-[#E6E4DF] pb-3">
            3. Distancia, nivel esperado y logística
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cw-distance"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Distancia total (km) *
              </label>
              <input
                id="cw-distance"
                type="number"
                step="0.1"
                min="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full h-11 px-3 text-sm font-mono tabular-nums bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.distanceKm && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.distanceKm}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="cw-level-min"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Nivel esperado — desde ({sportDef.unit}) *
              </label>
              <input
                id="cw-level-min"
                type="text"
                value={levelMin}
                onChange={(e) => setLevelMin(e.target.value)}
                placeholder={`Ej. ${sportDef.placeholderMin}`}
                className="w-full h-11 px-3 text-sm font-mono tabular-nums bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.levelMin && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.levelMin}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="cw-level-max"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Nivel esperado — hasta ({sportDef.unit}) *
              </label>
              <input
                id="cw-level-max"
                type="text"
                value={levelMax}
                onChange={(e) => setLevelMax(e.target.value)}
                placeholder={`Ej. ${sportDef.placeholderMax}`}
                className="w-full h-11 px-3 text-sm font-mono tabular-nums bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {fieldErrors.levelMax && (
                <p className="text-xs text-red-700 mt-1">{fieldErrors.levelMax}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-[#151515]/65">
            {sportDef.unitDescription}. El intervalo permite que otros deportistas comprueben si se sienten cómodos con el ritmo del grupo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cw-hydration"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Puntos de hidratación (si aplica)
              </label>
              <input
                id="cw-hydration"
                type="text"
                value={hydrationPoints}
                onChange={(e) => setHydrationPoints(e.target.value)}
                placeholder="Ej. Bebedero km 5 y tienda del mirador"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
            </div>

            <div>
              <label
                htmlFor="cw-notes"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Indicaciones adicionales (opcional)
              </label>
              <input
                id="cw-notes"
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Ej. Llevar boya obligatoria, luz trasera o hidratación"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Publicando entrenamiento...' : 'Publicar entrenamiento'}
          </button>
        </div>
      </form>
    </div>
  );
}
