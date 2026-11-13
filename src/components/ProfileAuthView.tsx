import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  LogOut,
  RotateCcw,
  ShieldAlert,
  Upload,
  User,
} from 'lucide-react';
import {
  ApiError,
  apiRequest,
  clearStoredSessionToken,
  compressAndUploadImage,
  setStoredSessionToken,
} from '../lib/api.ts';
import { BLOOD_TYPES, LOCATION_PRESETS, SPORT_LIST, SPORTS } from '../shared/sports.ts';
import type { SelfUser, SportId } from '../shared/types.ts';
import { LocationPicker } from './LocationPicker.tsx';
import { SmartImage } from './SmartImage.tsx';

interface ProfileAuthViewProps {
  user: SelfUser | null;
  onAuthChange: (user: SelfUser | null) => void;
  onExploreAfterAuth?: () => void;
}

export function ProfileAuthView({
  user,
  onAuthChange,
  onExploreAfterAuth,
}: ProfileAuthViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRemember, setLoginRemember] = useState(true);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginFieldErrors, setLoginFieldErrors] = useState<Record<string, string>>({});

  // Register & Edit shared profile fields
  const defaultPreset = LOCATION_PRESETS[0];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [sports, setSports] = useState<SportId[]>(['running']);
  const [homeLabel, setHomeLabel] = useState(defaultPreset.label);
  const [homeLat, setHomeLat] = useState(defaultPreset.lat);
  const [homeLng, setHomeLng] = useState(defaultPreset.lng);
  const [maxTravelKm, setMaxTravelKm] = useState('20');

  // Emergency info
  const [bloodType, setBloodType] = useState<string>('No lo sé');
  const [medicalRestrictions, setMedicalRestrictions] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relation, setRelation] = useState('');

  // Upload & form status
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setAvatarUrl(user.avatarUrl);
      setBirthDate(user.birthDate);
      setSports(user.sports);
      setHomeLabel(user.homeLabel);
      setHomeLat(user.homeLat);
      setHomeLng(user.homeLng);
      setMaxTravelKm(String(user.maxTravelKm));
      setBloodType(user.emergencyInfo.bloodType);
      setMedicalRestrictions(user.emergencyInfo.medicalRestrictions);
      setContactName(user.emergencyInfo.contactName);
      setContactPhone(user.emergencyInfo.contactPhone);
      setRelation(user.emergencyInfo.relation);
      setNewPassword('');
      setFieldErrors({});
      setProfileError(null);
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setNewPassword('');
      setAvatarUrl(null);
      setBirthDate('');
      setSports(['running']);
      setHomeLabel(defaultPreset.label);
      setHomeLat(defaultPreset.lat);
      setHomeLng(defaultPreset.lng);
      setMaxTravelKm('20');
      setBloodType('No lo sé');
      setMedicalRestrictions('');
      setContactName('');
      setContactPhone('');
      setRelation('');
      setPendingAvatar(null);
      setUploadError(null);
      setFieldErrors({});
      setProfileError(null);
      setProfileSuccess(null);
    }
  }, [user?.id]);

  const toggleSport = (id: SportId) => {
    setSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const uploadAvatarFile = async (file: File) => {
    setUploadingAvatar(true);
    setUploadError(null);
    try {
      const url = await compressAndUploadImage(file, 'avatar');
      setAvatarUrl(url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'No se pudo cargar la foto de perfil.'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingAvatar(file);
    await uploadAvatarFile(file);
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const errs: Record<string, string> = {};
    if (!loginEmail.trim()) errs.email = 'Ingresa tu correo electrónico.';
    if (!loginPassword) errs.password = 'Ingresa tu contraseña.';
    if (Object.keys(errs).length > 0) {
      setLoginFieldErrors(errs);
      return;
    }
    setLoginFieldErrors({});
    setLoginSubmitting(true);
    try {
      const res = await apiRequest<{ user: SelfUser; sessionToken?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: loginEmail.trim(),
            password: loginPassword,
            rememberMe: loginRemember,
          }),
        }
      );
      setStoredSessionToken(res.sessionToken, loginRemember);
      onAuthChange(res.user);
      onExploreAfterAuth?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginError(err.message);
        setLoginFieldErrors(err.fieldErrors || {});
      } else {
        setLoginError('No pudimos iniciar sesión.');
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const validateProfileFields = (isRegister: boolean): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Ingresa tu nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Ingresa un correo electrónico válido.';
    }
    if (isRegister && password.length < 8) {
      errs.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (!isRegister && newPassword && newPassword.length < 8) {
      errs.newPassword = 'La nueva contraseña debe tener al menos 8 caracteres.';
    }
    if (!birthDate) {
      errs.birthDate = 'Selecciona tu fecha de nacimiento.';
    }
    if (sports.length === 0) {
      errs.sports = 'Selecciona al menos un deporte.';
    }
    if (homeLabel.trim().length < 2) {
      errs.homeLocation = 'Indica un nombre o dirección de referencia para tu Casa.';
    }
    const maxKm = Number(maxTravelKm);
    if (!Number.isFinite(maxKm) || maxKm <= 0 || maxKm > 500) {
      errs.maxTravelKm = 'Indica una distancia válida entre 1 y 500 km.';
    }
    if (!bloodType) errs.bloodType = 'Selecciona tu grupo sanguíneo o "No lo sé".';
    if (contactName.trim().length < 2) {
      errs.contactName = 'Ingresa el nombre del contacto de emergencia.';
    }
    if (contactPhone.replace(/[^\d+]/g, '').length < 7) {
      errs.contactPhone = 'Ingresa un número telefónico válido.';
    }
    if (relation.trim().length < 2) {
      errs.relation = 'Indica el parentesco o vínculo.';
    }
    return errs;
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    const localErrors = validateProfileFields(true);
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setProfileError('Por favor revisa los campos señalados.');
      return;
    }

    setFieldErrors({});
    setSubmittingProfile(true);
    try {
      const res = await apiRequest<{ user: SelfUser; sessionToken?: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            avatarUrl,
            birthDate,
            sports,
            homeLabel: homeLabel.trim(),
            homeLat,
            homeLng,
            maxTravelKm: Number(maxTravelKm),
            rememberMe,
            emergencyInfo: {
              bloodType,
              medicalRestrictions: medicalRestrictions.trim(),
              contactName: contactName.trim(),
              contactPhone: contactPhone.trim(),
              relation: relation.trim(),
            },
          }),
        }
      );
      setStoredSessionToken(res.sessionToken, rememberMe);
      onAuthChange(res.user);
      onExploreAfterAuth?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileError(err.message);
        setFieldErrors(err.fieldErrors || {});
      } else {
        setProfileError('No pudimos completar el registro.');
      }
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleUpdateProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    const localErrors = validateProfileFields(false);
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setProfileError('Hay campos por corregir antes de guardar.');
      return;
    }

    setFieldErrors({});
    setSubmittingProfile(true);
    try {
      const res = await apiRequest<{ user: SelfUser }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          newPassword: newPassword || undefined,
          avatarUrl,
          birthDate,
          sports,
          homeLabel: homeLabel.trim(),
          homeLat,
          homeLng,
          maxTravelKm: Number(maxTravelKm),
          emergencyInfo: {
            bloodType,
            medicalRestrictions: medicalRestrictions.trim(),
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim(),
            relation: relation.trim(),
          },
        }),
      });
      onAuthChange(res.user);
      setNewPassword('');
      setProfileSuccess('¡Tu perfil y preferencias se guardaron correctamente!');
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileError(err.message);
        setFieldErrors(err.fieldErrors || {});
      } else {
        setProfileError('No se pudieron guardar los cambios.');
      }
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearStoredSessionToken();
    onAuthChange(null);
  };

  // Unauthenticated Login / Register screen
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#FF5A1F]">Acceso a Movement4all</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#151515]">
            {authMode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta deportiva'}
          </h1>
          <p className="text-sm text-[#151515]/75">
            Con una sola cuenta puedes inscribirte, proponer entrenamientos, coordinar en el chat y guardar tu ubicación habitual.
          </p>
        </div>

        {/* Segmented Auth Mode Switch */}
        <div className="inline-flex border border-[#151515] bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setLoginError(null);
              setProfileError(null);
            }}
            className={`px-5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              authMode === 'login'
                ? 'bg-[#151515] text-[#F6F5F1]'
                : 'text-[#151515] hover:bg-[#E6E4DF]/60'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setLoginError(null);
              setProfileError(null);
            }}
            className={`px-5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              authMode === 'register'
                ? 'bg-[#151515] text-[#F6F5F1]'
                : 'text-[#151515] hover:bg-[#E6E4DF]/60'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {authMode === 'login' ? (
          <form
            onSubmit={handleLoginSubmit}
            noValidate
            className="bg-white border border-[#E6E4DF] p-6 sm:p-8 max-w-xl space-y-5"
          >
            {loginError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Correo electrónico *
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {loginFieldErrors.email && (
                <p className="text-xs text-red-700 mt-1">{loginFieldErrors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Contraseña *
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {loginFieldErrors.password && (
                <p className="text-xs text-red-700 mt-1">{loginFieldErrors.password}</p>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-[#151515] cursor-pointer">
              <input
                type="checkbox"
                checked={loginRemember}
                onChange={(e) => setLoginRemember(e.target.checked)}
                className="w-4 h-4 accent-[#FF5A1F]"
              />
              Mantener sesión iniciada
            </label>

            <div>
              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full sm:w-auto px-6 py-3 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loginSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} noValidate className="space-y-6">
            {profileError && (
              <div
                role="alert"
                className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{profileError}</span>
              </div>
            )}

            {renderProfileSections({
              isRegister: true,
              name,
              setName,
              email,
              setEmail,
              password,
              setPassword,
              newPassword,
              setNewPassword,
              avatarUrl,
              avatarInputRef,
              handleAvatarChange,
              uploadingAvatar,
              uploadError,
              pendingAvatar,
              retryAvatar: () => pendingAvatar && uploadAvatarFile(pendingAvatar),
              birthDate,
              setBirthDate,
              sports,
              toggleSport,
              homeLabel,
              setHomeLabel,
              homeLat,
              setHomeLat,
              homeLng,
              setHomeLng,
              maxTravelKm,
              setMaxTravelKm,
              bloodType,
              setBloodType,
              medicalRestrictions,
              setMedicalRestrictions,
              contactName,
              setContactName,
              contactPhone,
              setContactPhone,
              relation,
              setRelation,
              fieldErrors,
            })}

            <div className="bg-white border border-[#E6E4DF] p-5 flex flex-wrap items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-[#151515] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-[#FF5A1F]"
                />
                Mantener sesión iniciada
              </label>

              <button
                type="submit"
                disabled={submittingProfile || uploadingAvatar}
                className="px-6 py-3 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submittingProfile ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // Authenticated Profile View & Edit
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E6E4DF] pb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#FF5A1F]">Mi cuenta deportiva</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#151515]">
            Mi perfil
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-[#151515] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

      {profileSuccess && (
        <div
          role="status"
          className="p-4 bg-white border border-[#151515] flex items-center gap-2.5 text-sm font-semibold text-[#151515]"
        >
          <CheckCircle2 className="w-5 h-5 text-[#FF5A1F] shrink-0" />
          <span>{profileSuccess}</span>
        </div>
      )}

      {profileError && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{profileError}</span>
        </div>
      )}

      <form onSubmit={handleUpdateProfileSubmit} noValidate className="space-y-6">
        {renderProfileSections({
          isRegister: false,
          name,
          setName,
          email,
          setEmail,
          password,
          setPassword,
          newPassword,
          setNewPassword,
          avatarUrl,
          avatarInputRef,
          handleAvatarChange,
          uploadingAvatar,
          uploadError,
          pendingAvatar,
          retryAvatar: () => pendingAvatar && uploadAvatarFile(pendingAvatar),
          birthDate,
          setBirthDate,
          sports,
          toggleSport,
          homeLabel,
          setHomeLabel,
          homeLat,
          setHomeLat,
          homeLng,
          setHomeLng,
          maxTravelKm,
          setMaxTravelKm,
          bloodType,
          setBloodType,
          medicalRestrictions,
          setMedicalRestrictions,
          contactName,
          setContactName,
          contactPhone,
          setContactPhone,
          relation,
          setRelation,
          fieldErrors,
        })}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submittingProfile || uploadingAvatar}
            className="px-6 py-3 text-sm font-semibold bg-[#FF5A1F] text-[#151515] hover:bg-[#151515] hover:text-[#F6F5F1] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submittingProfile ? 'Guardando cambios...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface ProfileSectionsArgs {
  isRegister: boolean;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  avatarUrl: string | null;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  handleAvatarChange: (e: ChangeEvent<HTMLInputElement>) => void;
  uploadingAvatar: boolean;
  uploadError: string | null;
  pendingAvatar: File | null;
  retryAvatar: () => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  sports: SportId[];
  toggleSport: (s: SportId) => void;
  homeLabel: string;
  setHomeLabel: (v: string) => void;
  homeLat: number;
  setHomeLat: (v: number) => void;
  homeLng: number;
  setHomeLng: (v: number) => void;
  maxTravelKm: string;
  setMaxTravelKm: (v: string) => void;
  bloodType: string;
  setBloodType: (v: string) => void;
  medicalRestrictions: string;
  setMedicalRestrictions: (v: string) => void;
  contactName: string;
  setContactName: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  relation: string;
  setRelation: (v: string) => void;
  fieldErrors: Record<string, string>;
}

function renderProfileSections(args: ProfileSectionsArgs) {
  return (
    <>
      {/* 1. Información personal */}
      <section className="bg-white border border-[#E6E4DF] p-6 space-y-5">
        <div className="border-b border-[#E6E4DF] pb-3">
          <h2 className="font-display text-2xl font-bold text-[#151515]">
            1. Información personal
          </h2>
          <p className="text-xs text-[#151515]/65 mt-0.5">
            Tu correo electrónico, contraseña y fecha de nacimiento nunca se muestran en perfiles públicos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-[#E6E4DF] border border-[#E6E4DF] flex items-center justify-center shrink-0">
            {args.avatarUrl ? (
              <SmartImage
                src={args.avatarUrl}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-7 h-7 text-[#151515]/50" />
            )}
          </div>
          <div className="space-y-1.5">
            <input
              ref={args.avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={args.handleAvatarChange}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={args.uploadingAvatar}
                onClick={() => args.avatarInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-[#151515] bg-white hover:bg-[#151515] hover:text-[#F6F5F1] transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {args.uploadingAvatar ? 'Subiendo foto...' : 'Subir fotografía de perfil'}
              </button>
              {args.uploadError && args.pendingAvatar && (
                <button
                  type="button"
                  onClick={args.retryAvatar}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-[#FF5A1F] text-[#151515] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reintentar
                </button>
              )}
            </div>
            <p className="text-xs text-[#151515]/60">JPG, PNG o WebP con ajuste automático.</p>
            {args.uploadError && (
              <p className="text-xs text-red-700">{args.uploadError}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="prof-name"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Nombre completo *
            </label>
            <input
              id="prof-name"
              type="text"
              value={args.name}
              onChange={(e) => args.setName(e.target.value)}
              placeholder="Ej. María Paula Zapata"
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.name && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="prof-email"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Correo electrónico (privado) *
            </label>
            <input
              id="prof-email"
              type="email"
              value={args.email}
              onChange={(e) => args.setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.email && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.email}</p>
            )}
          </div>

          {args.isRegister ? (
            <div>
              <label
                htmlFor="prof-pass"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Contraseña (mínimo 8 caracteres) *
              </label>
              <input
                id="prof-pass"
                type="password"
                autoComplete="new-password"
                value={args.password}
                onChange={(e) => args.setPassword(e.target.value)}
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {args.fieldErrors.password && (
                <p className="text-xs text-red-700 mt-1">{args.fieldErrors.password}</p>
              )}
            </div>
          ) : (
            <div>
              <label
                htmlFor="prof-newpass"
                className="block text-xs font-semibold text-[#151515] mb-1"
              >
                Nueva contraseña (opcional)
              </label>
              <input
                id="prof-newpass"
                type="password"
                autoComplete="new-password"
                value={args.newPassword}
                onChange={(e) => args.setNewPassword(e.target.value)}
                placeholder="Déjalo vacío para mantener tu contraseña actual"
                className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
              />
              {args.fieldErrors.newPassword && (
                <p className="text-xs text-red-700 mt-1">{args.fieldErrors.newPassword}</p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="prof-birth"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Fecha de nacimiento (privada) *
            </label>
            <input
              id="prof-birth"
              type="date"
              value={args.birthDate}
              onChange={(e) => args.setBirthDate(e.target.value)}
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.birthDate && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.birthDate}</p>
            )}
          </div>
        </div>
      </section>

      {/* 2. Preferencias deportivas y ubicación */}
      <section className="bg-white border border-[#E6E4DF] p-6 space-y-5">
        <div className="border-b border-[#E6E4DF] pb-3">
          <h2 className="font-display text-2xl font-bold text-[#151515]">
            2. Preferencias deportivas y ubicación (“Casa”)
          </h2>
          <p className="text-xs text-[#151515]/65 mt-0.5">
            Tu ubicación habitual guardada como “Casa” solo se usa para iniciar tus búsquedas y nunca aparece en perfiles públicos.
          </p>
        </div>

        <div>
          <span className="block text-xs font-semibold text-[#151515] mb-2">
            Deportes que practicas *
          </span>
          <div className="flex flex-wrap gap-2">
            {SPORT_LIST.map((s) => {
              const selected = args.sports.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => args.toggleSport(s.id)}
                  aria-pressed={selected}
                  className={`px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#151515] text-[#F6F5F1] border-[#151515]'
                      : 'bg-white text-[#151515] border-[#E6E4DF] hover:border-[#151515]'
                  }`}
                >
                  {SPORTS[s.id].label}
                </button>
              );
            })}
          </div>
          {args.fieldErrors.sports && (
            <p className="text-xs text-red-700 mt-1">{args.fieldErrors.sports}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="prof-homelabel"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Nombre o referencia de tu ubicación habitual “Casa” *
            </label>
            <input
              id="prof-homelabel"
              type="text"
              value={args.homeLabel}
              onChange={(e) => args.setHomeLabel(e.target.value)}
              placeholder="Ej. Estadio Atanasio Girardot, Medellín"
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.homeLocation && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.homeLocation}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="prof-maxkm"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Distancia máx. al encuentro (km) *
            </label>
            <input
              id="prof-maxkm"
              type="number"
              min={1}
              max={500}
              value={args.maxTravelKm}
              onChange={(e) => args.setMaxTravelKm(e.target.value)}
              className="w-full h-11 px-3 text-sm font-mono tabular-nums bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.maxTravelKm && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.maxTravelKm}</p>
            )}
          </div>
        </div>

        <LocationPicker
          lat={args.homeLat}
          lng={args.homeLng}
          label={args.homeLabel}
          heightClass="h-56"
          onChange={(next) => {
            args.setHomeLat(next.lat);
            args.setHomeLng(next.lng);
            if (next.label) args.setHomeLabel(next.label);
          }}
        />
      </section>

      {/* 3. Información de emergencia */}
      <section className="bg-white border border-[#E6E4DF] p-6 space-y-5">
        <div className="border-b border-[#E6E4DF] pb-3">
          <h2 className="font-display text-2xl font-bold text-[#151515]">
            3. Información de emergencia
          </h2>
        </div>

        <div className="p-4 bg-[#F6F5F1] border border-[#E6E4DF] flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#FF5A1F] shrink-0 mt-0.5" />
          <p className="text-xs text-[#151515]/85 leading-relaxed">
            <strong>¿Quién puede ver estos datos?</strong> Esta información estará identificada claramente como “Información de emergencia” y únicamente podrá consultarse desde la lista de participantes por las personas inscritas en el mismo entrenamiento que tú (incluido quien lo propuso), para saber cómo actuar ante un incidente en ruta.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="prof-blood"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Grupo sanguíneo *
            </label>
            <select
              id="prof-blood"
              value={args.bloodType}
              onChange={(e) => args.setBloodType(e.target.value)}
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            >
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
            {args.fieldErrors.bloodType && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.bloodType}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="prof-restrictions"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Restricciones médicas relevantes
            </label>
            <input
              id="prof-restrictions"
              type="text"
              value={args.medicalRestrictions}
              onChange={(e) => args.setMedicalRestrictions(e.target.value)}
              placeholder="Alergias, asma, medicación o 'Ninguna'"
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
          </div>

          <div>
            <label
              htmlFor="prof-cname"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Nombre del contacto de emergencia *
            </label>
            <input
              id="prof-cname"
              type="text"
              value={args.contactName}
              onChange={(e) => args.setContactName(e.target.value)}
              placeholder="Ej. Laura Jaramillo"
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.contactName && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.contactName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="prof-cphone"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Número telefónico del contacto *
            </label>
            <input
              id="prof-cphone"
              type="tel"
              value={args.contactPhone}
              onChange={(e) => args.setContactPhone(e.target.value)}
              placeholder="Ej. +57 300 123 4567"
              className="w-full h-11 px-3 text-sm font-mono bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.contactPhone && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.contactPhone}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="prof-crelation"
              className="block text-xs font-semibold text-[#151515] mb-1"
            >
              Parentesco o vínculo *
            </label>
            <input
              id="prof-crelation"
              type="text"
              value={args.relation}
              onChange={(e) => args.setRelation(e.target.value)}
              placeholder="Ej. Madre, Hermano, Pareja"
              className="w-full h-11 px-3 text-sm bg-white border border-[#E6E4DF] focus:border-[#151515]"
            />
            {args.fieldErrors.relation && (
              <p className="text-xs text-red-700 mt-1">{args.fieldErrors.relation}</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
