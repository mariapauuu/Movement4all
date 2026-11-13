import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, Camera, CheckCircle2, RotateCcw, Upload, User, X } from 'lucide-react';
import { ApiError, apiRequest, compressAndUploadImage } from '../lib/api.ts';
import { COMMUNITY_BANNER_IMAGE } from '../lib/sportMedia.ts';
import { SPORTS, utcIsoToBogotaParts } from '../shared/sports.ts';
import type { CommunityMemory, SelfUser, WorkoutSummary } from '../shared/types.ts';
import { SmartImage } from './SmartImage.tsx';

interface CommunityViewProps {
  user: SelfUser | null;
  preselectedWorkoutId?: string | null;
  onClearPreselected: () => void;
  onGoToAuth: () => void;
  onGoToExplore: () => void;
}

export function CommunityView({
  user,
  preselectedWorkoutId,
  onClearPreselected,
  onGoToAuth,
  onGoToExplore,
}: CommunityViewProps) {
  const [memories, setMemories] = useState<CommunityMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(Boolean(preselectedWorkoutId));
  const [eligibleWorkouts, setEligibleWorkouts] = useState<WorkoutSummary[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(preselectedWorkoutId || '');
  const [caption, setCaption] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ memories: CommunityMemory[] }>('/api/memories');
      setMemories(data.memories);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos cargar el muro de recuerdos.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleWorkouts = async () => {
    if (!user) {
      setEligibleWorkouts([]);
      return;
    }
    try {
      const data = await apiRequest<{ upcoming: WorkoutSummary[]; past: WorkoutSummary[] }>(
        '/api/my-routes'
      );
      setEligibleWorkouts(data.past);
      if (preselectedWorkoutId && data.past.some((w) => w.id === preselectedWorkoutId)) {
        setSelectedWorkoutId(preselectedWorkoutId);
      } else if (data.past.length > 0 && !selectedWorkoutId) {
        setSelectedWorkoutId(data.past[0].id);
      }
    } catch {
      // handled softly
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  useEffect(() => {
    loadEligibleWorkouts();
  }, [user?.id]);

  useEffect(() => {
    if (preselectedWorkoutId) {
      setComposerOpen(true);
      setSelectedWorkoutId(preselectedWorkoutId);
    }
  }, [preselectedWorkoutId]);

  const handleOpenComposer = () => {
    if (!user) {
      onGoToAuth();
      return;
    }
    setSuccessNotice(null);
    setComposerOpen(true);
  };

  const uploadSelectedFile = async (file: File) => {
    setUploadingPhoto(true);
    setUploadError(null);
    setFieldErrors((prev) => ({ ...prev, photoUrl: '' }));
    try {
      const url = await compressAndUploadImage(file, 'memory');
      setPhotoUrl(url);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'No pudimos cargar la fotografía. Intenta de nuevo.'
      );
      setPhotoUrl('');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    await uploadSelectedFile(file);
  };

  const handleRetryUpload = async () => {
    if (pendingFile) {
      await uploadSelectedFile(pendingFile);
    }
  };

  const handlePublishMemory = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs: Record<string, string> = {};
    if (!selectedWorkoutId) {
      errs.workoutId = 'Selecciona el entrenamiento realizado.';
    }
    if (!photoUrl) {
      errs.photoUrl = 'Sube una fotografía grupal desde tu dispositivo.';
    }
    if (caption.trim().length < 5) {
      errs.caption = 'Escribe un breve relato de la experiencia (mínimo 5 caracteres).';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await apiRequest<{ memory: CommunityMemory }>('/api/memories', {
        method: 'POST',
        body: JSON.stringify({
          workoutId: selectedWorkoutId,
          photoUrl,
          caption: caption.trim(),
        }),
      });
      setMemories((prev) => [res.memory, ...prev]);
      setCaption('');
      setPhotoUrl('');
      setPendingFile(null);
      setComposerOpen(false);
      onClearPreselected();
      setSuccessNotice('¡Tu recuerdo ya se publicó en el muro de Comunidad!');
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        setFieldErrors(err.fieldErrors || {});
      } else {
        setSubmitError('No se pudo publicar el recuerdo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const chosenWorkout = eligibleWorkouts.find((w) => w.id === selectedWorkoutId) || null;

  return (
    <div className="space-y-8 pb-14">
      {/* Editorial Header */}
      <section className="bg-[#151515] text-[#F6F5F1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-semibold text-[#FF5A1F]">
                Comunidad y recuerdos compartidos
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight text-balance">
                Disfruta el camino en compañía
              </h1>
              <p className="text-sm sm:text-base text-[#F6F5F1]/80 max-w-2xl leading-relaxed">
                Cada entrenamiento terminado deja historias, amistades y kilómetros compartidos. Comparte una foto del grupo sin clasificaciones ni comparaciones de rendimiento.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleOpenComposer}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#F6F5F1] transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Compartir recuerdo
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 aspect-[4/3] lg:aspect-[16/10] overflow-hidden border border-white/10">
              <SmartImage
                src={COMMUNITY_BANNER_IMAGE}
                alt="Deportistas aficionados compartiendo un momento alegre tras su entrenamiento grupal"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {successNotice && (
          <div
            role="status"
            className="p-4 bg-white border border-[#151515] flex items-center gap-2.5 text-sm font-semibold text-[#151515]"
          >
            <CheckCircle2 className="w-5 h-5 text-[#FF5A1F] shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Composer Form */}
        {composerOpen && user && (
          <section className="bg-white border border-[#151515] p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-[#E6E4DF] pb-4">
              <div>
                <h2 className="font-display text-3xl font-bold text-[#151515]">
                  Compartir recuerdo de un entrenamiento realizado
                </h2>
                <p className="text-xs text-[#151515]/75 mt-0.5">
                  El deporte, la fecha y el lugar se completan automáticamente desde el entrenamiento en el que participaste.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  onClearPreselected();
                }}
                aria-label="Cerrar formulario"
                className="p-2 border border-[#E6E4DF] hover:border-[#151515] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {eligibleWorkouts.length === 0 ? (
              <div className="p-5 bg-[#F6F5F1] border border-[#E6E4DF] space-y-3">
                <p className="text-sm text-[#151515]/80">
                  Para compartir un recuerdo primero debes haber participado en un entrenamiento que ya haya finalizado.
                </p>
                <button
                  type="button"
                  onClick={onGoToExplore}
                  className="px-4 py-2 text-xs font-semibold bg-[#151515] text-[#F6F5F1] hover:bg-[#FF5A1F] hover:text-[#151515] transition-colors cursor-pointer"
                >
                  Explorar entrenamientos
                </button>
              </div>
            ) : (
              <form onSubmit={handlePublishMemory} className="space-y-5" noValidate>
                {submitError && (
                  <div
                    role="alert"
                    className="p-3 bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="mem-workout"
                    className="block text-xs font-semibold text-[#151515] mb-1"
                  >
                    Entrenamiento realizado *
                  </label>
                  <select
                    id="mem-workout"
                    value={selectedWorkoutId}
                    onChange={(e) => setSelectedWorkoutId(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
                  >
                    <option value="">Selecciona un entrenamiento finalizado</option>
                    {eligibleWorkouts.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title} ({SPORTS[w.sport].shortLabel})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.workoutId && (
                    <p className="text-xs text-red-700 mt-1">{fieldErrors.workoutId}</p>
                  )}
                </div>

                {/* Auto-filled Workout Metadata */}
                {chosenWorkout && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#F6F5F1] border border-[#E6E4DF] text-xs">
                    <div>
                      <span className="block text-[#151515]/60">Deporte</span>
                      <span className="font-semibold text-[#151515]">
                        {SPORTS[chosenWorkout.sport].label}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[#151515]/60">Fecha</span>
                      <span className="font-mono tabular-nums font-semibold text-[#151515]">
                        {utcIsoToBogotaParts(chosenWorkout.startAt).formattedDate}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[#151515]/60">Lugar</span>
                      <span className="font-semibold text-[#151515]">
                        {chosenWorkout.municipality} — {chosenWorkout.meetingPoint}
                      </span>
                    </div>
                  </div>
                )}

                {/* Photo upload */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-[#151515]">
                    Fotografía grupal (JPG, PNG o WebP, compresión automática) *
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-[#151515] bg-white hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingPhoto
                        ? 'Comprimiendo y subiendo...'
                        : photoUrl
                          ? 'Cambiar fotografía'
                          : 'Seleccionar fotografía del dispositivo'}
                    </button>

                    {uploadError && pendingFile && (
                      <button
                        type="button"
                        onClick={handleRetryUpload}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#FF5A1F] text-[#151515] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Volver a intentar
                      </button>
                    )}
                  </div>

                  {uploadError && (
                    <p className="text-xs text-red-700 font-medium">{uploadError}</p>
                  )}
                  {fieldErrors.photoUrl && (
                    <p className="text-xs text-red-700">{fieldErrors.photoUrl}</p>
                  )}

                  {photoUrl && (
                    <div className="mt-2 max-w-sm border border-[#E6E4DF] overflow-hidden">
                      <SmartImage
                        src={photoUrl}
                        alt="Vista previa de la fotografía grupal"
                        className="w-full aspect-[4/3] object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="mem-caption"
                    className="block text-xs font-semibold text-[#151515] mb-1"
                  >
                    Texto breve sobre la experiencia *
                  </label>
                  <textarea
                    id="mem-caption"
                    rows={3}
                    maxLength={600}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="¿Cómo estuvo el recorrido o la compañía del grupo?"
                    className="w-full p-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
                  />
                  {fieldErrors.caption && (
                    <p className="text-xs text-red-700 mt-1">{fieldErrors.caption}</p>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="submit"
                    disabled={submitting || uploadingPhoto}
                    className="px-6 py-2.5 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Publicando recuerdo...' : 'Publicar recuerdo'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Memory Wall */}
        {error && (
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-center justify-between gap-4"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={loadMemories}
              className="px-3 py-1.5 text-xs font-semibold bg-[#151515] text-[#F6F5F1] cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white border border-[#E6E4DF] h-80" />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <div className="bg-white border border-[#E6E4DF] p-10 text-center space-y-3">
            <p className="font-display text-2xl font-bold text-[#151515]">
              Aún no hay recuerdos publicados
            </p>
            <p className="text-sm text-[#151515]/75">
              Sé la primera persona en compartir una fotografía grupal después de terminar un entrenamiento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memories.map((m) => {
              const sportDef = SPORTS[m.sport];
              const workoutDate = utcIsoToBogotaParts(m.workoutStartAt);
              return (
                <article
                  key={m.id}
                  className="bg-white border border-[#E6E4DF] flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    <div className="aspect-[4/3] bg-[#E6E4DF] overflow-hidden">
                      <SmartImage
                        src={m.photoUrl}
                        alt={`Recuerdo grupal de ${m.workoutTitle}`}
                        className="w-full h-full object-cover"
                        fallbackLabel={m.workoutTitle}
                      />
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#E6E4DF] flex items-center justify-center shrink-0">
                          {m.authorAvatarUrl ? (
                            <SmartImage
                              src={m.authorAvatarUrl}
                              alt={m.authorName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-[#151515]/60" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#151515] truncate">
                            {m.authorName}
                          </p>
                          <p className="text-xs text-[#151515]/60">
                            {sportDef.label} · {workoutDate.formattedDate}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-[#151515]/90 leading-relaxed">
                        {m.caption}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-[#E6E4DF] bg-[#F6F5F1]/60 text-xs text-[#151515]/75 space-y-0.5">
                    <p className="font-semibold text-[#151515] truncate">
                      {m.workoutTitle}
                    </p>
                    <p className="truncate">
                      {m.municipality} — {m.meetingPoint}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
