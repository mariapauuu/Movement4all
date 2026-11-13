export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const SESSION_TOKEN_KEY = 'm4a_session_token';
let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null): void {
  onUnauthorizedCallback = cb;
}

export function getStoredSessionToken(): string | null {
  try {
    return (
      window.sessionStorage.getItem(SESSION_TOKEN_KEY) ||
      window.localStorage.getItem(SESSION_TOKEN_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | undefined | null, rememberMe: boolean): void {
  clearStoredSessionToken();
  if (!token) return;
  try {
    if (rememberMe) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearStoredSessionToken(): void {
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.includes('/api/auth/login')) {
      clearStoredSessionToken();
      onUnauthorizedCallback?.();
    }
    throw new ApiError(
      data?.error || 'Ocurrió un error al comunicarse con el servidor.',
      res.status,
      data?.fieldErrors || {}
    );
  }
  return data as T;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la fotografía seleccionada.'));
    };
    img.src = objectUrl;
  });
}

async function compressImageFile(file: File, maxDimension: number): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Formato no compatible. Selecciona una imagen JPG, PNG o WebP.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('La imagen original supera los 15 MB. Elige un archivo más liviano.');
  }

  const img = await loadImageElement(file);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return file;
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);

  const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  const ext = outputType === 'image/webp' ? 'webp' : 'jpg';

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), outputType, 0.84)
  );

  if (!blob) {
    return file;
  }

  if (blob.size > 5 * 1024 * 1024) {
    const smallerBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.68)
    );
    if (smallerBlob && smallerBlob.size <= 5 * 1024 * 1024) {
      return new File([smallerBlob], `foto.${ext}`, { type: 'image/jpeg' });
    }
    throw new Error('La fotografía sigue superando los 5 MB tras comprimirla.');
  }

  return new File([blob], `foto.${ext}`, { type: outputType });
}

export async function compressAndUploadImage(
  file: File,
  kind: 'avatar' | 'memory'
): Promise<string> {
  const maxDimension = kind === 'avatar' ? 640 : 1400;
  const compressed = await compressImageFile(file, maxDimension);

  const formData = new FormData();
  formData.append('file', compressed);

  const response = await apiRequest<{ url: string }>('/api/uploads', {
    method: 'POST',
    body: formData,
  });

  return response.url;
}
