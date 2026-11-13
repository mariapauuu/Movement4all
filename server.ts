import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOADS_DIR } from './server/db.ts';
import { seedIfEmpty } from './server/seed.ts';
import {
  BLOOD_TYPES,
  EIGHT_HOURS_MS,
  bogotaLocalToUtcIso,
  getWorkoutStatus,
  haversineDistanceKm,
  isValidSport,
  parseLevelInput,
  SPORTS,
} from './src/shared/sports.ts';
import type {
  ChatMessage,
  CommunityMemory,
  ParticipantView,
  PublicUser,
  SelfUser,
  SportId,
  WorkoutDetail,
  WorkoutSummary,
} from './src/shared/types.ts';

seedIfEmpty();

const SESSION_COOKIE = 'm4a_session';
const PORT = Number(process.env.PORT || 3000);

function getNowMs(): number {
  const fixed = process.env.M4A_TEST_FIXED_NOW;
  if (fixed) {
    const parsed = Number(fixed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  birth_date: string;
  sports_json: string;
  home_label: string;
  home_lat: number;
  home_lng: number;
  max_travel_km: number;
  blood_type: string;
  medical_restrictions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  is_sample: number;
  created_at: string;
}

interface WorkoutRow {
  id: string;
  creator_id: string;
  title: string;
  sport: string;
  start_at: string;
  end_at: string;
  municipality: string;
  meeting_point: string;
  meeting_lat: number;
  meeting_lng: number;
  route_description: string;
  distance_km: number;
  level_min: number;
  level_max: number;
  hydration_points: string;
  additional_notes: string;
  is_sample: number;
  created_at: string;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(originalHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function parseSportsJson(raw: string): SportId[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is SportId => typeof s === 'string' && isValidSport(s));
    }
  } catch {
    // ignore malformed json
  }
  return [];
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    sports: parseSportsJson(row.sports_json),
    isSample: Boolean(row.is_sample),
  };
}

function toSelfUser(row: UserRow): SelfUser {
  return {
    ...toPublicUser(row),
    email: row.email,
    birthDate: row.birth_date,
    homeLabel: row.home_label,
    homeLat: row.home_lat,
    homeLng: row.home_lng,
    maxTravelKm: row.max_travel_km,
    emergencyInfo: {
      bloodType: row.blood_type,
      medicalRestrictions: row.medical_restrictions,
      contactName: row.emergency_contact_name,
      contactPhone: row.emergency_contact_phone,
      relation: row.emergency_contact_relation,
    },
  };
}

function detectImageExtension(buffer: Buffer, mimetype: string): string | null {
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (isJpeg && (mimetype === 'image/jpeg' || mimetype === 'image/jpg')) return 'jpg';
  if (isPng && mimetype === 'image/png') return 'png';
  if (isWebp && mimetype === 'image/webp') return 'webp';
  return null;
}

function buildWorkoutSummary(
  row: WorkoutRow,
  creatorRow: UserRow,
  participantCount: number,
  currentUserId: string | null,
  enrolledSet: Set<string>,
  refLat: number | null,
  refLng: number | null,
  sharedMemorySet?: Set<string>
): WorkoutSummary {
  const approxDistanceKm =
    refLat !== null && refLng !== null
      ? haversineDistanceKm(refLat, refLng, row.meeting_lat, row.meeting_lng)
      : null;

  return {
    id: row.id,
    creatorId: row.creator_id,
    creator: toPublicUser(creatorRow),
    title: row.title,
    sport: row.sport as SportId,
    startAt: row.start_at,
    endAt: row.end_at,
    municipality: row.municipality,
    meetingPoint: row.meeting_point,
    meetingLat: row.meeting_lat,
    meetingLng: row.meeting_lng,
    routeDescription: row.route_description,
    distanceKm: row.distance_km,
    levelMin: row.level_min,
    levelMax: row.level_max,
    hydrationPoints: row.hydration_points,
    additionalNotes: row.additional_notes,
    participantCount,
    status: getWorkoutStatus(row.start_at, row.end_at, getNowMs()),
    isEnrolled: Boolean(currentUserId && enrolledSet.has(row.id)),
    isCreator: Boolean(currentUserId && currentUserId === row.creator_id),
    approxDistanceKm,
    hasSharedMemory: sharedMemorySet ? sharedMemorySet.has(row.id) : undefined,
    isSample: Boolean(row.is_sample),
    createdAt: row.created_at,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isReasonableBirthDate(birthDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const parsed = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const minAgeDate = new Date(now.getUTCFullYear() - 14, now.getUTCMonth(), now.getUTCDate());
  const minDate = new Date('1920-01-01T00:00:00Z');
  return parsed >= minDate && parsed <= minAgeDate;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: UserRow | null;
    }
  }
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve uploaded user photos and sample editorial photos persistently
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(
  '/sample-media',
  express.static(path.resolve(process.cwd(), 'src/assets/images'), { maxAge: '7d' })
);

function setSessionCookie(
  req: express.Request,
  res: express.Response,
  token: string,
  rememberMe: boolean
) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const opts: express.CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    ...(isHttps ? { partitioned: true } : {}),
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}),
  };
  res.cookie(SESSION_COOKIE, token, opts);
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const opts: express.CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    ...(isHttps ? { partitioned: true } : {}),
  };
  res.clearCookie(SESSION_COOKIE, opts);
}

function extractSessionToken(req: express.Request): string | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return null;
}

// Attach authenticated user from session cookie or Bearer session token
app.use((req, _res, next) => {
  const token = extractSessionToken(req);
  if (!token) {
    req.currentUser = null;
    return next();
  }

  const session = db
    .prepare('SELECT token, user_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as { token: string; user_id: string; expires_at: string } | undefined;

  if (!session || new Date(session.expires_at).getTime() <= getNowMs()) {
    if (session) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    req.currentUser = null;
    return next();
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as
    | UserRow
    | undefined;
  req.currentUser = user || null;
  next();
});

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.currentUser) {
    return res.status(401).json({
      error: 'Debes iniciar sesión para realizar esta acción.',
    });
  }
  next();
}

// Upload configuration: max 5MB, JPG/PNG/WebP only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post('/api/uploads', (req, res) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(400)
          .json({ error: 'La imagen supera el tamaño máximo permitido de 5 MB.' });
      }
      return res.status(400).json({ error: 'No se pudo procesar el archivo enviado.' });
    }
    if (err) {
      return res.status(400).json({ error: 'Error al subir la fotografía.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Selecciona una fotografía desde tu dispositivo.' });
    }

    const ext = detectImageExtension(file.buffer, file.mimetype);
    if (!ext) {
      return res.status(400).json({
        error: 'Formato no permitido. Usa una imagen JPG, PNG o WebP válida.',
      });
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(dest, file.buffer);
    return res.status(201).json({ url: `/uploads/${filename}` });
  });
});

// ================= AUTH & PROFILE =================

app.get('/api/auth/me', (req, res) => {
  if (!req.currentUser) {
    return res.json({ user: null });
  }
  return res.json({ user: toSelfUser(req.currentUser) });
});

app.post('/api/auth/register', (req, res) => {
  const body = req.body || {};
  const fieldErrors: Record<string, string> = {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const avatarUrl =
    typeof body.avatarUrl === 'string' && body.avatarUrl.startsWith('/uploads/')
      ? body.avatarUrl
      : null;
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
  const sports: SportId[] = Array.isArray(body.sports)
    ? body.sports.filter((s: unknown): s is SportId => typeof s === 'string' && isValidSport(s))
    : [];
  const homeLabel = typeof body.homeLabel === 'string' ? body.homeLabel.trim() : '';
  const homeLat = Number(body.homeLat);
  const homeLng = Number(body.homeLng);
  const maxTravelKm = Number(body.maxTravelKm);
  const rememberMe = Boolean(body.rememberMe);

  const emergency = body.emergencyInfo || {};
  const bloodType = typeof emergency.bloodType === 'string' ? emergency.bloodType.trim() : '';
  const medicalRestrictions =
    typeof emergency.medicalRestrictions === 'string'
      ? emergency.medicalRestrictions.trim()
      : '';
  const contactName =
    typeof emergency.contactName === 'string' ? emergency.contactName.trim() : '';
  const contactPhone =
    typeof emergency.contactPhone === 'string' ? emergency.contactPhone.trim() : '';
  const relation = typeof emergency.relation === 'string' ? emergency.relation.trim() : '';

  if (name.length < 2) fieldErrors.name = 'Ingresa tu nombre completo (mínimo 2 caracteres).';
  if (!isValidEmail(email)) fieldErrors.email = 'Ingresa un correo electrónico válido.';
  if (password.length < 8) {
    fieldErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!isReasonableBirthDate(birthDate)) {
    fieldErrors.birthDate = 'Ingresa una fecha de nacimiento válida (mayor de 14 años).';
  }
  if (sports.length === 0) {
    fieldErrors.sports = 'Selecciona al menos un deporte que practiques.';
  }
  if (homeLabel.length < 2 || !isValidCoordinate(homeLat, homeLng)) {
    fieldErrors.homeLocation = 'Selecciona tu ubicación habitual de Casa en el mapa o lista.';
  }
  if (!Number.isFinite(maxTravelKm) || maxTravelKm <= 0 || maxTravelKm > 500) {
    fieldErrors.maxTravelKm = 'Indica una distancia máxima válida entre 1 y 500 km.';
  }
  if (!BLOOD_TYPES.includes(bloodType as (typeof BLOOD_TYPES)[number])) {
    fieldErrors.bloodType = 'Selecciona tu grupo sanguíneo o elige "No lo sé".';
  }
  if (contactName.length < 2) {
    fieldErrors.contactName = 'Ingresa el nombre de tu contacto de emergencia.';
  }
  if (contactPhone.replace(/[^\d+]/g, '').length < 7) {
    fieldErrors.contactPhone = 'Ingresa un número telefónico de emergencia válido.';
  }
  if (relation.length < 2) {
    fieldErrors.relation = 'Indica el parentesco o vínculo del contacto.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Revisa los campos señalados antes de crear tu cuenta.',
      fieldErrors,
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({
      error: 'Ya existe una cuenta registrada con este correo electrónico.',
      fieldErrors: {
        email: 'Este correo ya está registrado. Intenta iniciar sesión.',
      },
    });
  }

  const userId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(`
    INSERT INTO users (
      id, name, email, password_hash, avatar_url, birth_date, sports_json,
      home_label, home_lat, home_lng, max_travel_km, blood_type,
      medical_restrictions, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, is_sample, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    userId,
    name,
    email,
    passwordHash,
    avatarUrl,
    birthDate,
    JSON.stringify(Array.from(new Set(sports))),
    homeLabel,
    homeLat,
    homeLng,
    maxTravelKm,
    bloodType,
    medicalRestrictions || 'Ninguna reportada.',
    contactName,
    contactPhone,
    relation,
    nowIso
  );

  const token = crypto.randomBytes(32).toString('hex');
  const ttlMs = (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  db.prepare(
    'INSERT INTO sessions (token, user_id, remember_me, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(token, userId, rememberMe ? 1 : 0, expiresAt, nowIso);

  setSessionCookie(req, res, token, rememberMe);

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  return res.status(201).json({ user: toSelfUser(created), sessionToken: token });
});

app.post('/api/auth/login', (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const rememberMe = Boolean(body.rememberMe);

  const fieldErrors: Record<string, string> = {};
  if (!isValidEmail(email)) fieldErrors.email = 'Ingresa un correo electrónico válido.';
  if (!password) fieldErrors.password = 'Ingresa tu contraseña.';
  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({ error: 'Completa tu correo y contraseña.', fieldErrors });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({
      error: 'Correo o contraseña incorrectos.',
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const ttlMs = (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  db.prepare(
    'INSERT INTO sessions (token, user_id, remember_me, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(token, user.id, rememberMe ? 1 : 0, expiresAt, nowIso);

  setSessionCookie(req, res, token, rememberMe);
  return res.json({ user: toSelfUser(user), sessionToken: token });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  clearSessionCookie(req, res);
  return res.json({ ok: true });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const current = req.currentUser!;
  const body = req.body || {};
  const fieldErrors: Record<string, string> = {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
  const avatarUrl =
    body.avatarUrl === null
      ? null
      : typeof body.avatarUrl === 'string' && body.avatarUrl.startsWith('/uploads/')
        ? body.avatarUrl
        : current.avatar_url;
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  const sports: SportId[] = Array.isArray(body.sports)
    ? body.sports.filter((s: unknown): s is SportId => typeof s === 'string' && isValidSport(s))
    : [];
  const homeLabel = typeof body.homeLabel === 'string' ? body.homeLabel.trim() : '';
  const homeLat = Number(body.homeLat);
  const homeLng = Number(body.homeLng);
  const maxTravelKm = Number(body.maxTravelKm);

  const emergency = body.emergencyInfo || {};
  const bloodType = typeof emergency.bloodType === 'string' ? emergency.bloodType.trim() : '';
  const medicalRestrictions =
    typeof emergency.medicalRestrictions === 'string'
      ? emergency.medicalRestrictions.trim()
      : '';
  const contactName =
    typeof emergency.contactName === 'string' ? emergency.contactName.trim() : '';
  const contactPhone =
    typeof emergency.contactPhone === 'string' ? emergency.contactPhone.trim() : '';
  const relation = typeof emergency.relation === 'string' ? emergency.relation.trim() : '';

  if (name.length < 2) fieldErrors.name = 'Ingresa tu nombre completo (mínimo 2 caracteres).';
  if (!isValidEmail(email)) fieldErrors.email = 'Ingresa un correo electrónico válido.';
  if (newPassword && newPassword.length < 8) {
    fieldErrors.newPassword = 'La nueva contraseña debe tener al menos 8 caracteres.';
  }
  if (!isReasonableBirthDate(birthDate)) {
    fieldErrors.birthDate = 'Ingresa una fecha de nacimiento válida (mayor de 14 años).';
  }
  if (sports.length === 0) {
    fieldErrors.sports = 'Selecciona al menos un deporte.';
  }
  if (homeLabel.length < 2 || !isValidCoordinate(homeLat, homeLng)) {
    fieldErrors.homeLocation = 'Selecciona tu ubicación habitual de Casa.';
  }
  if (!Number.isFinite(maxTravelKm) || maxTravelKm <= 0 || maxTravelKm > 500) {
    fieldErrors.maxTravelKm = 'Indica una distancia máxima válida entre 1 y 500 km.';
  }
  if (!BLOOD_TYPES.includes(bloodType as (typeof BLOOD_TYPES)[number])) {
    fieldErrors.bloodType = 'Selecciona tu grupo sanguíneo o "No lo sé".';
  }
  if (contactName.length < 2) {
    fieldErrors.contactName = 'Ingresa el nombre del contacto de emergencia.';
  }
  if (contactPhone.replace(/[^\d+]/g, '').length < 7) {
    fieldErrors.contactPhone = 'Ingresa un teléfono de contacto válido.';
  }
  if (relation.length < 2) {
    fieldErrors.relation = 'Indica el parentesco o vínculo.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Hay campos por corregir en tu perfil.',
      fieldErrors,
    });
  }

  const duplicate = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(email, current.id);
  if (duplicate) {
    return res.status(409).json({
      error: 'Otro usuario ya utiliza ese correo electrónico.',
      fieldErrors: { email: 'Este correo ya está registrado por otra cuenta.' },
    });
  }

  const nextHash = newPassword ? hashPassword(newPassword) : current.password_hash;

  db.prepare(`
    UPDATE users SET
      name = ?,
      email = ?,
      password_hash = ?,
      avatar_url = ?,
      birth_date = ?,
      sports_json = ?,
      home_label = ?,
      home_lat = ?,
      home_lng = ?,
      max_travel_km = ?,
      blood_type = ?,
      medical_restrictions = ?,
      emergency_contact_name = ?,
      emergency_contact_phone = ?,
      emergency_contact_relation = ?
    WHERE id = ?
  `).run(
    name,
    email,
    nextHash,
    avatarUrl,
    birthDate,
    JSON.stringify(Array.from(new Set(sports))),
    homeLabel,
    homeLat,
    homeLng,
    maxTravelKm,
    bloodType,
    medicalRestrictions || 'Ninguna reportada.',
    contactName,
    contactPhone,
    relation,
    current.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(current.id) as UserRow;
  return res.json({ user: toSelfUser(updated) });
});

// ================= WORKOUTS & SEARCH =================

app.get('/api/workouts', (req, res) => {
  const sport = typeof req.query.sport === 'string' ? req.query.sport : '';
  const dateFilter = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const levelRaw = typeof req.query.level === 'string' ? req.query.level.trim() : '';
  const refLatRaw = req.query.refLat !== undefined ? Number(req.query.refLat) : null;
  const refLngRaw = req.query.refLng !== undefined ? Number(req.query.refLng) : null;
  const maxDistRaw =
    req.query.maxDistanceKm !== undefined && req.query.maxDistanceKm !== ''
      ? Number(req.query.maxDistanceKm)
      : null;
  const includePast = req.query.includePast === '1' || req.query.includePast === 'true';

  const refLat =
    refLatRaw !== null && Number.isFinite(refLatRaw) ? refLatRaw : null;
  const refLng =
    refLngRaw !== null && Number.isFinite(refLngRaw) ? refLngRaw : null;

  let sql = 'SELECT * FROM workouts WHERE 1=1';
  const params: unknown[] = [];

  if (sport && sport !== 'all') {
    if (!isValidSport(sport)) {
      return res.status(400).json({ error: 'Deporte de búsqueda no válido.' });
    }
    sql += ' AND sport = ?';
    params.push(sport);
  }

  if (dateFilter) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
      return res.status(400).json({ error: 'Formato de fecha no válido.' });
    }
    const dayStartIso = new Date(`${dateFilter}T00:00:00-05:00`).toISOString();
    const dayEndIso = new Date(`${dateFilter}T23:59:59.999-05:00`).toISOString();
    sql += ' AND start_at >= ? AND start_at <= ?';
    params.push(dayStartIso, dayEndIso);
  } else if (!includePast) {
    // By default in Explore, show active/upcoming workouts (end_at > now)
    sql += ' AND end_at > ?';
    params.push(new Date(getNowMs()).toISOString());
  }

  sql += ' ORDER BY start_at ASC';

  const rows = db.prepare(sql).all(...params) as WorkoutRow[];

  const userRows = db.prepare('SELECT * FROM users').all() as UserRow[];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const countRows = db
    .prepare('SELECT workout_id, COUNT(*) AS cnt FROM enrollments GROUP BY workout_id')
    .all() as { workout_id: string; cnt: number }[];
  const countMap = new Map(countRows.map((c) => [c.workout_id, c.cnt]));

  const enrolledSet = new Set<string>();
  if (req.currentUser) {
    const myEnrollments = db
      .prepare('SELECT workout_id FROM enrollments WHERE user_id = ?')
      .all(req.currentUser.id) as { workout_id: string }[];
    for (const e of myEnrollments) enrolledSet.add(e.workout_id);
  }

  // Numeric level filtering
  let parsedLevel: number | null = null;
  if (levelRaw) {
    if (sport && sport !== 'all' && isValidSport(sport)) {
      parsedLevel = parseLevelInput(levelRaw, sport);
    } else {
      const numeric = Number(levelRaw.replace(',', '.'));
      parsedLevel = Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    }
  }

  const results: WorkoutSummary[] = [];
  for (const row of rows) {
    const creator = userMap.get(row.creator_id);
    if (!creator) continue;

    // Numeric range comparison
    if (levelRaw && sport && sport !== 'all' && isValidSport(sport)) {
      if (parsedLevel === null) continue;
      const minVal = Math.min(row.level_min, row.level_max);
      const maxVal = Math.max(row.level_min, row.level_max);
      if (parsedLevel < minVal - 0.001 || parsedLevel > maxVal + 0.001) {
        continue;
      }
    }

    const summary = buildWorkoutSummary(
      row,
      creator,
      countMap.get(row.id) ?? 0,
      req.currentUser?.id ?? null,
      enrolledSet,
      refLat,
      refLng
    );

    if (
      maxDistRaw !== null &&
      Number.isFinite(maxDistRaw) &&
      maxDistRaw > 0 &&
      summary.approxDistanceKm !== null &&
      summary.approxDistanceKm > maxDistRaw
    ) {
      continue;
    }

    results.push(summary);
  }

  return res.json({ workouts: results });
});

app.get('/api/workouts/:id', (req, res) => {
  const id = req.params.id;
  const refLatRaw = req.query.refLat !== undefined ? Number(req.query.refLat) : null;
  const refLngRaw = req.query.refLng !== undefined ? Number(req.query.refLng) : null;
  const refLat = refLatRaw !== null && Number.isFinite(refLatRaw) ? refLatRaw : null;
  const refLng = refLngRaw !== null && Number.isFinite(refLngRaw) ? refLngRaw : null;

  const row = db.prepare('SELECT * FROM workouts WHERE id = ?').get(id) as
    | WorkoutRow
    | undefined;
  if (!row) {
    return res.status(404).json({ error: 'Entrenamiento no encontrado.' });
  }

  const creator = db.prepare('SELECT * FROM users WHERE id = ?').get(row.creator_id) as
    | UserRow
    | undefined;
  if (!creator) {
    return res.status(404).json({ error: 'Creador del entrenamiento no encontrado.' });
  }

  const enrollmentRows = db
    .prepare(
      `SELECT e.enrolled_at, u.*
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       WHERE e.workout_id = ?
       ORDER BY e.enrolled_at ASC`
    )
    .all(row.id) as (UserRow & { enrolled_at: string })[];

  const currentUserId = req.currentUser?.id ?? null;
  const isViewerAuthorized = Boolean(
    currentUserId &&
      (currentUserId === row.creator_id ||
        enrollmentRows.some((p) => p.id === currentUserId))
  );

  const enrolledSet = new Set<string>();
  if (isViewerAuthorized) {
    enrolledSet.add(row.id);
  }

  // Server-enforced privacy: emergencyInfo is ONLY returned when viewer is enrolled/creator in this workout
  const participants: ParticipantView[] = enrollmentRows.map((p) => ({
    ...toPublicUser(p),
    isCreator: p.id === row.creator_id,
    enrolledAt: p.enrolled_at,
    ...(isViewerAuthorized
      ? {
          emergencyInfo: {
            bloodType: p.blood_type,
            medicalRestrictions: p.medical_restrictions,
            contactName: p.emergency_contact_name,
            contactPhone: p.emergency_contact_phone,
            relation: p.emergency_contact_relation,
          },
        }
      : {}),
  }));

  const summary = buildWorkoutSummary(
    row,
    creator,
    participants.length,
    currentUserId,
    enrolledSet,
    refLat,
    refLng
  );

  const detail: WorkoutDetail = {
    ...summary,
    participants,
  };

  return res.json({ workout: detail });
});

app.post('/api/workouts', requireAuth, (req, res) => {
  const user = req.currentUser!;
  const body = req.body || {};
  const fieldErrors: Record<string, string> = {};

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const sport = typeof body.sport === 'string' ? body.sport.trim() : '';
  const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
  const startTime = typeof body.startTime === 'string' ? body.startTime.trim() : '';
  const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : startDate;
  const endTime = typeof body.endTime === 'string' ? body.endTime.trim() : '';
  const municipality = typeof body.municipality === 'string' ? body.municipality.trim() : '';
  const meetingPoint = typeof body.meetingPoint === 'string' ? body.meetingPoint.trim() : '';
  const meetingLat = Number(body.meetingLat);
  const meetingLng = Number(body.meetingLng);
  const routeDescription =
    typeof body.routeDescription === 'string' ? body.routeDescription.trim() : '';
  const distanceKm = Number(body.distanceKm);
  const hydrationPoints =
    typeof body.hydrationPoints === 'string' ? body.hydrationPoints.trim() : '';
  const additionalNotes =
    typeof body.additionalNotes === 'string' ? body.additionalNotes.trim() : '';

  if (title.length < 4) {
    fieldErrors.title = 'Escribe un nombre descriptivo (mínimo 4 caracteres).';
  }
  if (!isValidSport(sport)) {
    fieldErrors.sport = 'Selecciona uno de los cuatro deportes disponibles.';
  }

  const startIso = bogotaLocalToUtcIso(startDate, startTime);
  if (!startIso) {
    fieldErrors.startTime = 'Indica una fecha y hora de inicio válidas (America/Bogota).';
  }

  const endIso = bogotaLocalToUtcIso(endDate, endTime);
  if (!endIso) {
    fieldErrors.endTime = 'Indica una fecha y hora estimada de finalización válidas.';
  }

  if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    fieldErrors.endTime = 'La hora de finalización debe ser posterior a la hora de inicio.';
  }

  // Server-enforced 8-hour minimum advance rule
  if (startIso) {
    const diffMs = new Date(startIso).getTime() - getNowMs();
    if (diffMs < EIGHT_HOURS_MS) {
      fieldErrors.startTime =
        'Debes publicar el entrenamiento con al menos 8 horas de anticipación respecto a la hora actual en Colombia.';
    }
  }

  if (municipality.length < 2) {
    fieldErrors.municipality = 'Indica el municipio del encuentro.';
  }
  if (meetingPoint.length < 4) {
    fieldErrors.meetingPoint = 'Describe con claridad el punto de encuentro.';
  }
  if (!isValidCoordinate(meetingLat, meetingLng)) {
    fieldErrors.meetingCoords = 'Selecciona las coordenadas del punto de encuentro en el mapa.';
  }
  if (routeDescription.length < 10) {
    fieldErrors.routeDescription = 'Describe brevemente el recorrido (mínimo 10 caracteres).';
  }
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 500) {
    fieldErrors.distanceKm = 'La distancia debe ser un número positivo mayor a 0 km.';
  }

  let levelMin: number | null = null;
  let levelMax: number | null = null;
  if (isValidSport(sport)) {
    const def = SPORTS[sport];
    levelMin = parseLevelInput(body.levelMin, sport);
    levelMax = parseLevelInput(body.levelMax, sport);
    if (levelMin === null || levelMin < def.minAllowed || levelMin > def.maxAllowed) {
      fieldErrors.levelMin = `Ingresa un valor mínimo válido en ${def.unit}.`;
    }
    if (levelMax === null || levelMax < def.minAllowed || levelMax > def.maxAllowed) {
      fieldErrors.levelMax = `Ingresa un valor máximo válido en ${def.unit}.`;
    }
    if (levelMin !== null && levelMax !== null && levelMin > levelMax) {
      fieldErrors.levelMax = 'El límite superior del intervalo debe ser mayor o igual al inferior.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'No se pudo publicar el entrenamiento. Revisa los campos marcados.',
      fieldErrors,
    });
  }

  const workoutId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const createTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO workouts (
        id, creator_id, title, sport, start_at, end_at, municipality, meeting_point,
        meeting_lat, meeting_lng, route_description, distance_km, level_min, level_max,
        hydration_points, additional_notes, is_sample, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      workoutId,
      user.id,
      title,
      sport,
      startIso!,
      endIso!,
      municipality,
      meetingPoint,
      meetingLat,
      meetingLng,
      routeDescription,
      distanceKm,
      levelMin!,
      levelMax!,
      hydrationPoints,
      additionalNotes,
      nowIso
    );

    // Auto-enroll creator without duplicates
    db.prepare(
      'INSERT OR IGNORE INTO enrollments (workout_id, user_id, enrolled_at) VALUES (?, ?, ?)'
    ).run(workoutId, user.id, nowIso);
  });

  createTx();

  const created = db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId) as WorkoutRow;
  const summary = buildWorkoutSummary(
    created,
    user,
    1,
    user.id,
    new Set([workoutId]),
    user.home_lat,
    user.home_lng
  );

  return res.status(201).json({ workout: summary });
});

app.post('/api/workouts/:id/enroll', requireAuth, (req, res) => {
  const user = req.currentUser!;
  const workoutId = req.params.id;

  const row = db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId) as
    | WorkoutRow
    | undefined;
  if (!row) {
    return res.status(404).json({ error: 'El entrenamiento no existe.' });
  }

  const existing = db
    .prepare('SELECT 1 FROM enrollments WHERE workout_id = ? AND user_id = ?')
    .get(workoutId, user.id);
  if (existing) {
    return res.status(409).json({ error: 'Ya estás inscrito en este entrenamiento.' });
  }

  const nowMs = getNowMs();
  const startMs = new Date(row.start_at).getTime();
  const endMs = new Date(row.end_at).getTime();

  if (endMs <= nowMs) {
    return res.status(400).json({ error: 'Este entrenamiento ya finalizó.' });
  }

  // Exact 8 hours (>=) is permitted; strictly less than 8 hours is rejected
  if (startMs - nowMs < EIGHT_HOURS_MS) {
    return res.status(400).json({
      error:
        'Inscripciones cerradas: solo puedes inscribirte hasta ocho horas antes del inicio del entrenamiento.',
    });
  }

  const nowIso = new Date().toISOString();
  db.prepare('INSERT INTO enrollments (workout_id, user_id, enrolled_at) VALUES (?, ?, ?)').run(
    workoutId,
    user.id,
    nowIso
  );

  const creator = db.prepare('SELECT * FROM users WHERE id = ?').get(row.creator_id) as UserRow;
  const count = (
    db.prepare('SELECT COUNT(*) AS cnt FROM enrollments WHERE workout_id = ?').get(workoutId) as {
      cnt: number;
    }
  ).cnt;

  const summary = buildWorkoutSummary(
    row,
    creator,
    count,
    user.id,
    new Set([workoutId]),
    user.home_lat,
    user.home_lng
  );

  return res.status(201).json({
    message: '¡Ya estás inscrito! Estos son los detalles de tu próxima ruta',
    workout: summary,
  });
});

// ================= GROUP CHAT =================

app.get('/api/workouts/:id/messages', requireAuth, (req, res) => {
  const user = req.currentUser!;
  const workoutId = req.params.id;

  const workout = db.prepare('SELECT id, creator_id FROM workouts WHERE id = ?').get(workoutId) as
    | { id: string; creator_id: string }
    | undefined;
  if (!workout) {
    return res.status(404).json({ error: 'Entrenamiento no encontrado.' });
  }

  const enrolled = db
    .prepare('SELECT 1 FROM enrollments WHERE workout_id = ? AND user_id = ?')
    .get(workoutId, user.id);

  if (!enrolled && workout.creator_id !== user.id) {
    return res.status(403).json({
      error: 'Solo las personas inscritas en este entrenamiento pueden consultar el chat del grupo.',
    });
  }

  const rows = db
    .prepare(
      `SELECT m.id, m.workout_id, m.user_id, m.content, m.created_at,
              u.name AS author_name, u.avatar_url AS author_avatar_url
       FROM chat_messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.workout_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(workoutId) as {
    id: string;
    workout_id: string;
    user_id: string;
    content: string;
    created_at: string;
    author_name: string;
    author_avatar_url: string | null;
  }[];

  const messages: ChatMessage[] = rows.map((r) => ({
    id: r.id,
    workoutId: r.workout_id,
    userId: r.user_id,
    authorName: r.author_name,
    authorAvatarUrl: r.author_avatar_url,
    content: r.content,
    createdAt: r.created_at,
  }));

  return res.json({ messages });
});

app.post('/api/workouts/:id/messages', requireAuth, (req, res) => {
  const user = req.currentUser!;
  const workoutId = req.params.id;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

  if (!content) {
    return res.status(400).json({ error: 'Escribe un mensaje antes de enviarlo.' });
  }
  if (content.length > 1000) {
    return res.status(400).json({ error: 'El mensaje no puede superar los 1000 caracteres.' });
  }

  const workout = db.prepare('SELECT id, creator_id FROM workouts WHERE id = ?').get(workoutId) as
    | { id: string; creator_id: string }
    | undefined;
  if (!workout) {
    return res.status(404).json({ error: 'Entrenamiento no encontrado.' });
  }

  const enrolled = db
    .prepare('SELECT 1 FROM enrollments WHERE workout_id = ? AND user_id = ?')
    .get(workoutId, user.id);

  if (!enrolled && workout.creator_id !== user.id) {
    return res.status(403).json({
      error: 'Debes estar inscrito en el entrenamiento para enviar mensajes al chat.',
    });
  }

  const msgId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO chat_messages (id, workout_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(msgId, workoutId, user.id, content, createdAt);

  const message: ChatMessage = {
    id: msgId,
    workoutId,
    userId: user.id,
    authorName: user.name,
    authorAvatarUrl: user.avatar_url,
    content,
    createdAt,
  };

  return res.status(201).json({ message });
});

// ================= SCHEDULED ROUTES =================

app.get('/api/my-routes', requireAuth, (req, res) => {
  const user = req.currentUser!;

  const rows = db
    .prepare(
      `SELECT DISTINCT w.*
       FROM workouts w
       LEFT JOIN enrollments e ON e.workout_id = w.id
       WHERE w.creator_id = ? OR e.user_id = ?
       ORDER BY w.start_at ASC`
    )
    .all(user.id, user.id) as WorkoutRow[];

  const userRows = db.prepare('SELECT * FROM users').all() as UserRow[];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const countRows = db
    .prepare('SELECT workout_id, COUNT(*) AS cnt FROM enrollments GROUP BY workout_id')
    .all() as { workout_id: string; cnt: number }[];
  const countMap = new Map(countRows.map((c) => [c.workout_id, c.cnt]));

  const myMemories = db
    .prepare('SELECT workout_id FROM memories WHERE user_id = ?')
    .all(user.id) as { workout_id: string }[];
  const sharedMemorySet = new Set(myMemories.map((m) => m.workout_id));

  const enrolledSet = new Set(rows.map((r) => r.id));
  const nowMs = getNowMs();

  const upcoming: WorkoutSummary[] = [];
  const past: WorkoutSummary[] = [];

  for (const row of rows) {
    const creator = userMap.get(row.creator_id);
    if (!creator) continue;
    const summary = buildWorkoutSummary(
      row,
      creator,
      countMap.get(row.id) ?? 0,
      user.id,
      enrolledSet,
      user.home_lat,
      user.home_lng,
      sharedMemorySet
    );
    if (new Date(row.end_at).getTime() <= nowMs) {
      past.push(summary);
    } else {
      upcoming.push(summary);
    }
  }

  // Past workouts most recent first
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  return res.json({ upcoming, past });
});

// ================= COMMUNITY MEMORIES =================

app.get('/api/memories', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.workout_id, m.user_id, m.photo_url, m.caption, m.is_sample, m.created_at,
              u.name AS author_name, u.avatar_url AS author_avatar_url,
              w.title AS workout_title, w.sport, w.start_at AS workout_start_at,
              w.municipality, w.meeting_point
       FROM memories m
       JOIN users u ON u.id = m.user_id
       JOIN workouts w ON w.id = m.workout_id
       ORDER BY m.created_at DESC`
    )
    .all() as {
    id: string;
    workout_id: string;
    user_id: string;
    photo_url: string;
    caption: string;
    is_sample: number;
    created_at: string;
    author_name: string;
    author_avatar_url: string | null;
    workout_title: string;
    sport: string;
    workout_start_at: string;
    municipality: string;
    meeting_point: string;
  }[];

  const memories: CommunityMemory[] = rows.map((r) => ({
    id: r.id,
    workoutId: r.workout_id,
    workoutTitle: r.workout_title,
    sport: r.sport as SportId,
    workoutStartAt: r.workout_start_at,
    municipality: r.municipality,
    meetingPoint: r.meeting_point,
    userId: r.user_id,
    authorName: r.author_name,
    authorAvatarUrl: r.author_avatar_url,
    photoUrl: r.photo_url,
    caption: r.caption,
    isSample: Boolean(r.is_sample),
    createdAt: r.created_at,
  }));

  return res.json({ memories });
});

app.post('/api/memories', requireAuth, (req, res) => {
  const user = req.currentUser!;
  const body = req.body || {};
  const workoutId = typeof body.workoutId === 'string' ? body.workoutId.trim() : '';
  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.trim() : '';
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';

  const fieldErrors: Record<string, string> = {};
  if (!workoutId) fieldErrors.workoutId = 'Selecciona el entrenamiento finalizado.';
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) {
    fieldErrors.photoUrl = 'Carga una fotografía grupal desde tu dispositivo.';
  }
  if (caption.length < 5) {
    fieldErrors.caption = 'Escribe un texto breve sobre la experiencia (mínimo 5 caracteres).';
  }
  if (caption.length > 600) {
    fieldErrors.caption = 'El texto breve no debe superar los 600 caracteres.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Completa los campos requeridos para compartir tu recuerdo.',
      fieldErrors,
    });
  }

  const workout = db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId) as
    | WorkoutRow
    | undefined;
  if (!workout) {
    return res.status(404).json({ error: 'Entrenamiento no encontrado.' });
  }

  if (new Date(workout.end_at).getTime() > getNowMs()) {
    return res.status(400).json({
      error: 'Solo puedes compartir recuerdos de entrenamientos que ya hayan finalizado.',
    });
  }

  const enrolled = db
    .prepare('SELECT 1 FROM enrollments WHERE workout_id = ? AND user_id = ?')
    .get(workoutId, user.id);

  if (!enrolled && workout.creator_id !== user.id) {
    return res.status(403).json({
      error: 'Solo quienes participaron en este entrenamiento pueden publicar un recuerdo.',
    });
  }

  const memoryId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO memories (id, workout_id, user_id, photo_url, caption, is_sample, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(memoryId, workoutId, user.id, photoUrl, caption, createdAt);

  const memory: CommunityMemory = {
    id: memoryId,
    workoutId: workout.id,
    workoutTitle: workout.title,
    sport: workout.sport as SportId,
    workoutStartAt: workout.start_at,
    municipality: workout.municipality,
    meetingPoint: workout.meeting_point,
    userId: user.id,
    authorName: user.name,
    authorAvatarUrl: user.avatar_url,
    photoUrl,
    caption,
    isSample: false,
    createdAt,
  };

  return res.status(201).json({ memory });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Movement4all server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
