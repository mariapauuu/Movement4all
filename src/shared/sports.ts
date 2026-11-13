import type { LocationPreset, SportId, WorkoutStatus } from './types.ts';

export const BOGOTA_TIMEZONE = 'America/Bogota';
export const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export interface SportDefinition {
  id: SportId;
  label: string;
  shortLabel: string;
  unit: string;
  unitDescription: string;
  mode: 'pace' | 'speed';
  placeholderMin: string;
  placeholderMax: string;
  exampleTarget: string;
  minAllowed: number;
  maxAllowed: number;
}

export const SPORTS: Record<SportId, SportDefinition> = {
  running: {
    id: 'running',
    label: 'Running',
    shortLabel: 'Running',
    unit: 'min/km',
    unitDescription: 'Ritmo en minutos por kilómetro (ej. 5:30 o 5.5)',
    mode: 'pace',
    placeholderMin: '5:00',
    placeholderMax: '6:00',
    exampleTarget: '5:30',
    minAllowed: 2.5,
    maxAllowed: 15,
  },
  mtb: {
    id: 'mtb',
    label: 'Ciclismo de montaña',
    shortLabel: 'MTB',
    unit: 'km/h',
    unitDescription: 'Velocidad promedio en kilómetros por hora (ej. 16 a 22)',
    mode: 'speed',
    placeholderMin: '15',
    placeholderMax: '20',
    exampleTarget: '18',
    minAllowed: 5,
    maxAllowed: 45,
  },
  road_cycling: {
    id: 'road_cycling',
    label: 'Ciclismo de ruta',
    shortLabel: 'Ruta',
    unit: 'km/h',
    unitDescription: 'Velocidad promedio en kilómetros por hora (ej. 24 a 30)',
    mode: 'speed',
    placeholderMin: '24',
    placeholderMax: '29',
    exampleTarget: '26',
    minAllowed: 10,
    maxAllowed: 60,
  },
  open_water: {
    id: 'open_water',
    label: 'Natación en aguas abiertas',
    shortLabel: 'Aguas abiertas',
    unit: 'min/100m',
    unitDescription: 'Ritmo en minutos por cada 100 metros (ej. 2:00 o 2.0)',
    mode: 'pace',
    placeholderMin: '1:50',
    placeholderMax: '2:20',
    exampleTarget: '2:05',
    minAllowed: 0.9,
    maxAllowed: 8,
  },
};

export const SPORT_LIST: SportDefinition[] = [
  SPORTS.running,
  SPORTS.mtb,
  SPORTS.road_cycling,
  SPORTS.open_water,
];

export const BLOOD_TYPES = [
  'O+',
  'O-',
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'No lo sé',
] as const;

export const LOCATION_PRESETS: LocationPreset[] = [
  {
    id: 'medellin-estadio',
    municipality: 'Medellín',
    label: 'Estadio Atanasio Girardot, Medellín',
    lat: 6.2569,
    lng: -75.5902,
  },
  {
    id: 'medellin-poblado',
    municipality: 'Medellín',
    label: 'Parque El Poblado, Medellín',
    lat: 6.2105,
    lng: -75.5707,
  },
  {
    id: 'medellin-volador',
    municipality: 'Medellín',
    label: 'Cerro El Volador, Medellín',
    lat: 6.2695,
    lng: -75.5818,
  },
  {
    id: 'envigado-parque',
    municipality: 'Envigado',
    label: 'Parque Principal de Envigado',
    lat: 6.1719,
    lng: -75.5867,
  },
  {
    id: 'envigado-escobero',
    municipality: 'Envigado',
    label: 'Cruce Loma del Escobero, Envigado',
    lat: 6.1614,
    lng: -75.5453,
  },
  {
    id: 'marinilla-parque',
    municipality: 'Marinilla',
    label: 'Parque Principal de Marinilla',
    lat: 6.1742,
    lng: -75.3361,
  },
  {
    id: 'guatape-malecon',
    municipality: 'Guatapé',
    label: 'Malecón del Embalse, Guatapé',
    lat: 6.2328,
    lng: -75.1583,
  },
  {
    id: 'sabaneta-parque',
    municipality: 'Sabaneta',
    label: 'Parque Principal de Sabaneta',
    lat: 6.1516,
    lng: -75.6164,
  },
  {
    id: 'rionegro-san-antonio',
    municipality: 'Rionegro',
    label: 'San Antonio de Pereira, Rionegro',
    lat: 6.1319,
    lng: -75.3742,
  },
];

export function isValidSport(value: string): value is SportId {
  return value === 'running' || value === 'mtb' || value === 'road_cycling' || value === 'open_water';
}

export function parseLevelInput(raw: string | number | null | undefined, sport: SportId): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;

  const def = SPORTS[sport];
  if (def.mode === 'pace' && trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (!Number.isInteger(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0 || secs >= 60) {
      return null;
    }
    return Number((mins + secs / 60).toFixed(4));
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(4));
}

export function formatLevelValue(val: number, sport: SportId): string {
  const def = SPORTS[sport];
  if (def.mode === 'pace') {
    const totalSeconds = Math.round(val * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

export function formatLevelRange(min: number, max: number, sport: SportId): string {
  const def = SPORTS[sport];
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return `${formatLevelValue(low, sport)} – ${formatLevelValue(high, sport)} ${def.unit}`;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Convierte fecha (YYYY-MM-DD) y hora (HH:MM) ingresadas en America/Bogota (-05:00, sin horario de verano)
 * a un instante UTC ISO consistente.
 */
export function bogotaLocalToUtcIso(dateStr: string, timeStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return null;
  }
  const dt = new Date(`${dateStr}T${timeStr}:00-05:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function utcIsoToBogotaParts(iso: string): {
  date: string;
  time: string;
  formattedDate: string;
  formattedTime: string;
  formattedDateTime: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      date: '',
      time: '',
      formattedDate: '',
      formattedTime: '',
      formattedDateTime: '',
    };
  }

  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOGOTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const prettyDateFmt = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const date = dateFmt.format(d);
  const time = timeFmt.format(d);
  const formattedDate = prettyDateFmt.format(d);
  return {
    date,
    time,
    formattedDate,
    formattedTime: `${time} h`,
    formattedDateTime: `${formattedDate} · ${time} h`,
  };
}

export function getWorkoutStatus(
  startIso: string,
  endIso: string,
  nowMs: number = Date.now()
): WorkoutStatus {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (endMs <= nowMs) return 'finished';
  if (startMs - nowMs >= EIGHT_HOURS_MS) return 'open';
  return 'closed';
}

export function getStatusLabel(status: WorkoutStatus): string {
  switch (status) {
    case 'open':
      return 'Inscripciones abiertas';
    case 'closed':
      return 'Inscripciones cerradas';
    case 'finished':
      return 'Entrenamiento realizado';
  }
}
