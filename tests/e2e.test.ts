import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  bogotaLocalToUtcIso,
  EIGHT_HOURS_MS,
  getWorkoutStatus,
  haversineDistanceKm,
  parseLevelInput,
  utcIsoToBogotaParts,
} from '../src/shared/sports.ts';

// Valid 1x1 PNG buffer (68 bytes)
const VALID_PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

class SessionClient {
  private baseUrl: string;
  private cookies = new Map<string, string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T = any>(
    urlPath: string,
    opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<{ status: number; data: T }> {
    const isForm = opts.body instanceof FormData;
    const cookieHeader = Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    const res = await fetch(`${this.baseUrl}${urlPath}`, {
      method: opts.method || 'GET',
      headers: {
        ...(!isForm && opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(opts.headers || {}),
      },
      body: isForm
        ? (opts.body as FormData)
        : opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
    });

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [kv] = raw.split(';');
      const eq = kv.indexOf('=');
      if (eq > 0) {
        const name = kv.slice(0, eq).trim();
        const val = kv.slice(eq + 1).trim();
        if (!val) {
          this.cookies.delete(name);
        } else {
          this.cookies.set(name, val);
        }
      }
    }

    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  }
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/memories`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Test server did not start in time');
}

function makeUserPayload(name: string, email: string, homeLat: number, homeLng: number, homeLabel: string, avatarUrl: string | null = null) {
  return {
    name,
    email,
    password: 'ClaveSegura2026!',
    avatarUrl,
    birthDate: '1993-07-15',
    sports: ['running', 'road_cycling'],
    homeLabel,
    homeLat,
    homeLng,
    maxTravelKm: 25,
    rememberMe: true,
    emergencyInfo: {
      bloodType: 'O+',
      medicalRestrictions: 'Alergia leve al polen',
      contactName: `Contacto de ${name}`,
      contactPhone: '+57 300 555 0199',
      relation: 'Hermana',
    },
  };
}

test('Domain helpers: numeric pace/speed parsing and exact 8h status boundary', () => {
  assert.equal(parseLevelInput('5:30', 'running'), 5.5);
  assert.equal(parseLevelInput('5.5', 'running'), 5.5);
  assert.equal(parseLevelInput('1:45', 'open_water'), 1.75);
  assert.equal(parseLevelInput('26.5', 'road_cycling'), 26.5);
  assert.equal(parseLevelInput('invalid', 'running'), null);

  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const exact8h = new Date(now + EIGHT_HOURS_MS).toISOString();
  const under8h = new Date(now + EIGHT_HOURS_MS - 1).toISOString();
  const endLater = new Date(now + EIGHT_HOURS_MS + 3600_000).toISOString();
  const finished = new Date(now - 1000).toISOString();

  assert.equal(getWorkoutStatus(exact8h, endLater, now), 'open');
  assert.equal(getWorkoutStatus(under8h, endLater, now), 'closed');
  assert.equal(getWorkoutStatus(finished, finished, now), 'finished');

  // Haversine sanity: Medellin Estadio to Guatape Malecon (~48 km straight-line)
  const km = haversineDistanceKm(6.2569, -75.5902, 6.2328, -75.1583);
  assert.ok(km > 40 && km < 55, `Expected ~48 km, got ${km}`);
});

test('End-to-end Movement4all server flows (isolated temp DB)', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm4a-e2e-'));
  const port = 3987;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Pin fixed clock to an exact current minute so seeded relative dates & exact 8h boundary align
  const fixedNowMs = Math.floor(Date.now() / 60000) * 60000;

  let serverProc: ChildProcess | null = null;

  try {
    serverProc = spawn('node', ['server.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        M4A_DATA_DIR: tempDir,
        M4A_TEST_FIXED_NOW: String(fixedNowMs),
      },
      stdio: 'pipe',
    });

    await waitForServer(baseUrl);

    const guest = new SessionClient(baseUrl);
    const sessionA = new SessionClient(baseUrl);
    const sessionB = new SessionClient(baseUrl);
    const sessionC = new SessionClient(baseUrl);

    // -----------------------------------------------------------------------
    // 1. Image upload validation + Account creation, edit, logout, login
    // -----------------------------------------------------------------------
    const badForm = new FormData();
    badForm.append('file', new Blob([Buffer.from('not-an-image')], { type: 'image/png' }), 'fake.png');
    const badUpload = await sessionA.request('/api/uploads', { method: 'POST', body: badForm });
    assert.equal(badUpload.status, 400);

    const goodForm = new FormData();
    goodForm.append('file', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'avatar.png');
    const goodUpload = await sessionA.request<{ url: string }>('/api/uploads', {
      method: 'POST',
      body: goodForm,
    });
    assert.equal(goodUpload.status, 201);
    assert.ok(goodUpload.data.url.startsWith('/uploads/'));

    const regA = await sessionA.request('/api/auth/register', {
      method: 'POST',
      body: makeUserPayload(
        'Laura Prueba',
        'laura@test.co',
        6.2569,
        -75.5902,
        'Estadio Atanasio Girardot, Medellín',
        goodUpload.data.url
      ),
    });
    assert.equal(regA.status, 201);
    assert.equal(regA.data.user.name, 'Laura Prueba');

    // Duplicate email must fail with 409
    const dupReg = await guest.request('/api/auth/register', {
      method: 'POST',
      body: makeUserPayload('Laura Dos', 'laura@test.co', 6.25, -75.59, 'Medellín'),
    });
    assert.equal(dupReg.status, 409);

    // Edit profile
    const editA = await sessionA.request('/api/profile', {
      method: 'PUT',
      body: {
        name: 'Laura Prueba Editada',
        email: 'laura@test.co',
        avatarUrl: goodUpload.data.url,
        birthDate: '1993-07-15',
        sports: ['running', 'mtb'],
        homeLabel: 'Estadio Atanasio Girardot, Medellín',
        homeLat: 6.2569,
        homeLng: -75.5902,
        maxTravelKm: 35,
        emergencyInfo: {
          bloodType: 'A+',
          medicalRestrictions: 'Sin restricciones',
          contactName: 'Sofía Prueba',
          contactPhone: '+57 301 555 0100',
          relation: 'Madre',
        },
      },
    });
    assert.equal(editA.status, 200);
    assert.equal(editA.data.user.name, 'Laura Prueba Editada');
    assert.equal(editA.data.user.maxTravelKm, 35);

    // Logout & verify cleared session
    const logoutRes = await sessionA.request('/api/auth/logout', { method: 'POST' });
    assert.equal(logoutRes.status, 200);
    const meLoggedOut = await sessionA.request('/api/auth/me');
    assert.equal(meLoggedOut.data.user, null);

    // Log back in & verify persistence
    const loginA = await sessionA.request('/api/auth/login', {
      method: 'POST',
      body: { email: 'laura@test.co', password: 'ClaveSegura2026!', rememberMe: true },
    });
    assert.equal(loginA.status, 200);
    assert.equal(loginA.data.user.name, 'Laura Prueba Editada');
    assert.equal(loginA.data.user.emergencyInfo.bloodType, 'A+');

    // -----------------------------------------------------------------------
    // 2. Search by sport, date, level, distance + temporary location keeps Casa intact
    // -----------------------------------------------------------------------
    const tempGuatapeSearch = await sessionA.request(
      '/api/workouts?sport=open_water&refLat=6.2328&refLng=-75.1583&maxDistanceKm=10'
    );
    assert.equal(tempGuatapeSearch.status, 200);
    assert.ok(tempGuatapeSearch.data.workouts.length >= 1);
    assert.ok(tempGuatapeSearch.data.workouts.every((w: any) => w.sport === 'open_water'));
    assert.ok(tempGuatapeSearch.data.workouts.every((w: any) => w.approxDistanceKm <= 10));

    // Confirm Casa on profile was NOT altered by temporary location search
    const meAfterSearch = await sessionA.request('/api/auth/me');
    assert.equal(meAfterSearch.data.user.homeLat, 6.2569);
    assert.equal(meAfterSearch.data.user.homeLng, -75.5902);

    // Numeric level filter (Running 5:30 -> inside [5.0, 6.0], outside if 3:30)
    const runMatch = await sessionA.request('/api/workouts?sport=running&level=5:30');
    assert.ok(runMatch.data.workouts.length >= 1);
    const runNoMatch = await sessionA.request('/api/workouts?sport=running&level=3:30');
    assert.equal(runNoMatch.data.workouts.length, 0);

    // -----------------------------------------------------------------------
    // 3. Create valid workout (> 8h) & check search + creator's routes
    // -----------------------------------------------------------------------
    const gt8Start = utcIsoToBogotaParts(new Date(fixedNowMs + 10 * 3600_000).toISOString());
    const gt8End = utcIsoToBogotaParts(new Date(fixedNowMs + 12 * 3600_000).toISOString());

    const createValid = await sessionA.request('/api/workouts', {
      method: 'POST',
      body: {
        title: 'Rodaje Prueba E2E Envigado',
        sport: 'running',
        startDate: gt8Start.date,
        startTime: gt8Start.time,
        endDate: gt8End.date,
        endTime: gt8End.time,
        municipality: 'Envigado',
        meetingPoint: 'Parque Principal de Envigado',
        meetingLat: 6.1719,
        meetingLng: -75.5867,
        routeDescription: 'Recorrido de prueba completo por Envigado ida y vuelta.',
        distanceKm: 11.5,
        levelMin: '5:00',
        levelMax: '6:00',
        hydrationPoints: 'Parque principal',
        additionalNotes: 'Traer hidratación',
      },
    });
    assert.equal(createValid.status, 201);
    const createdWorkoutId = createValid.data.workout.id;

    // Appears in search by date & sport
    const searchCreated = await sessionA.request(
      `/api/workouts?sport=running&date=${gt8Start.date}&level=5:30`
    );
    assert.ok(searchCreated.data.workouts.some((w: any) => w.id === createdWorkoutId));

    // Appears in creator's routes
    const routesA = await sessionA.request('/api/my-routes');
    assert.ok(routesA.data.upcoming.some((w: any) => w.id === createdWorkoutId));

    // -----------------------------------------------------------------------
    // 4. Second account enrolls & both see identical participants
    // -----------------------------------------------------------------------
    const regB = await sessionB.request('/api/auth/register', {
      method: 'POST',
      body: makeUserPayload(
        'Carlos Segundo',
        'carlos@test.co',
        6.1719,
        -75.5867,
        'Parque de Envigado'
      ),
    });
    assert.equal(regB.status, 201);

    const enrollB = await sessionB.request(`/api/workouts/${createdWorkoutId}/enroll`, {
      method: 'POST',
    });
    assert.equal(enrollB.status, 201);
    assert.match(enrollB.data.message, /¡Ya estás inscrito!/);

    // Duplicate enrollment blocked & no duplicate participants
    const dupEnrollB = await sessionB.request(`/api/workouts/${createdWorkoutId}/enroll`, {
      method: 'POST',
    });
    assert.equal(dupEnrollB.status, 409);

    const detailA = await sessionA.request(`/api/workouts/${createdWorkoutId}`);
    const detailB = await sessionB.request(`/api/workouts/${createdWorkoutId}`);
    assert.equal(detailA.data.workout.participants.length, 2);
    assert.deepEqual(
      detailA.data.workout.participants.map((p: any) => p.id),
      detailB.data.workout.participants.map((p: any) => p.id)
    );

    // -----------------------------------------------------------------------
    // 5. Chat messages from both accounts persist across reload
    // -----------------------------------------------------------------------
    const msgA = await sessionA.request(`/api/workouts/${createdWorkoutId}/messages`, {
      method: 'POST',
      body: { content: 'Hola Carlos, nos vemos en la entrada.' },
    });
    assert.equal(msgA.status, 201);

    const msgB = await sessionB.request(`/api/workouts/${createdWorkoutId}/messages`, {
      method: 'POST',
      body: { content: 'Perfecto Laura, allá nos vemos puntual.' },
    });
    assert.equal(msgB.status, 201);

    const chatReadA = await sessionA.request(`/api/workouts/${createdWorkoutId}/messages`);
    const chatReadB = await sessionB.request(`/api/workouts/${createdWorkoutId}/messages`);
    assert.equal(chatReadA.data.messages.length, 2);
    assert.equal(chatReadB.data.messages.length, 2);
    assert.equal(chatReadB.data.messages[0].content, 'Hola Carlos, nos vemos en la entrada.');
    assert.equal(chatReadA.data.messages[1].content, 'Perfecto Laura, allá nos vemos puntual.');

    // -----------------------------------------------------------------------
    // 6. Emergency info visibility & strict privacy for non-enrolled user C / guest
    // -----------------------------------------------------------------------
    const regC = await sessionC.request('/api/auth/register', {
      method: 'POST',
      body: makeUserPayload(
        'Diana No Inscrita',
        'diana@test.co',
        6.2105,
        -75.5707,
        'Parque El Poblado'
      ),
    });
    assert.equal(regC.status, 201);

    // Enrolled B sees A's emergency info
    const peerAInDetailB = detailB.data.workout.participants.find(
      (p: any) => p.name === 'Laura Prueba Editada'
    );
    assert.equal(peerAInDetailB.emergencyInfo.bloodType, 'A+');
    assert.equal(peerAInDetailB.emergencyInfo.contactPhone, '+57 301 555 0100');

    // Non-enrolled C & guest CANNOT obtain emergencyInfo, email, birthDate, or Casa
    const detailForC = await sessionC.request(`/api/workouts/${createdWorkoutId}`);
    const detailForGuest = await guest.request(`/api/workouts/${createdWorkoutId}`);
    for (const resp of [detailForC, detailForGuest]) {
      assert.equal(resp.status, 200);
      for (const p of resp.data.workout.participants) {
        assert.equal(p.emergencyInfo, undefined);
        assert.equal(p.email, undefined);
        assert.equal(p.birthDate, undefined);
        assert.equal(p.homeLat, undefined);
      }
    }

    // Non-enrolled C CANNOT read or send chat messages
    const chatForbiddenGet = await sessionC.request(`/api/workouts/${createdWorkoutId}/messages`);
    assert.equal(chatForbiddenGet.status, 403);
    const chatForbiddenPost = await sessionC.request(`/api/workouts/${createdWorkoutId}/messages`, {
      method: 'POST',
      body: { content: 'Intento no autorizado' },
    });
    assert.equal(chatForbiddenPost.status, 403);

    // -----------------------------------------------------------------------
    // 7. Exact 8-hour boundary (> 8h, === 8h, < 8h) for create & enroll
    // -----------------------------------------------------------------------
    const exact8Start = utcIsoToBogotaParts(new Date(fixedNowMs + EIGHT_HOURS_MS).toISOString());
    const exact8End = utcIsoToBogotaParts(new Date(fixedNowMs + EIGHT_HOURS_MS + 3600_000).toISOString());
    const under8Start = utcIsoToBogotaParts(new Date(fixedNowMs + EIGHT_HOURS_MS - 60_000).toISOString());
    const under8End = utcIsoToBogotaParts(new Date(fixedNowMs + EIGHT_HOURS_MS + 3600_000).toISOString());

    // < 8h create MUST fail (400)
    const createUnder8 = await sessionA.request('/api/workouts', {
      method: 'POST',
      body: {
        title: 'Salida con 7h59m',
        sport: 'running',
        startDate: under8Start.date,
        startTime: under8Start.time,
        endDate: under8End.date,
        endTime: under8End.time,
        municipality: 'Medellín',
        meetingPoint: 'Estadio',
        meetingLat: 6.2569,
        meetingLng: -75.5902,
        routeDescription: 'Recorrido corto de prueba.',
        distanceKm: 5,
        levelMin: '5:00',
        levelMax: '6:00',
      },
    });
    assert.equal(createUnder8.status, 400);

    // === 8h exact create MUST succeed (201)
    const createExact8 = await sessionA.request('/api/workouts', {
      method: 'POST',
      body: {
        title: 'Salida exactamente a 8h',
        sport: 'running',
        startDate: exact8Start.date,
        startTime: exact8Start.time,
        endDate: exact8End.date,
        endTime: exact8End.time,
        municipality: 'Medellín',
        meetingPoint: 'Estadio',
        meetingLat: 6.2569,
        meetingLng: -75.5902,
        routeDescription: 'Recorrido exacto en límite de 8 horas.',
        distanceKm: 6,
        levelMin: '5:00',
        levelMax: '6:00',
      },
    });
    assert.equal(createExact8.status, 201);
    const exact8Id = createExact8.data.workout.id;

    // === 8h exact enroll by B MUST succeed (201)
    const enrollExact8 = await sessionB.request(`/api/workouts/${exact8Id}/enroll`, {
      method: 'POST',
    });
    assert.equal(enrollExact8.status, 201);

    // < 8h enroll MUST fail (400) using seeded <8h workout
    const enrollUnder8 = await sessionB.request('/api/workouts/sample-workout-closed-envigado/enroll', {
      method: 'POST',
    });
    assert.equal(enrollUnder8.status, 400);

    // -----------------------------------------------------------------------
    // 8. Community memory on a finished workout & visibility from another session
    // -----------------------------------------------------------------------
    // Verify posting a memory for a future workout is blocked (400)
    const memForm = new FormData();
    memForm.append('file', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'grupo.png');
    const memUpload = await sessionA.request<{ url: string }>('/api/uploads', {
      method: 'POST',
      body: memForm,
    });
    assert.equal(memUpload.status, 201);

    const futureMem = await sessionA.request('/api/memories', {
      method: 'POST',
      body: {
        workoutId: createdWorkoutId,
        photoUrl: memUpload.data.url,
        caption: 'Intento antes de terminar',
      },
    });
    assert.equal(futureMem.status, 400);

    // Insert a fictitious finished workout in the isolated temp DB where A participated
    const tempDb = new Database(path.join(tempDir, 'movement4all.db'));
    const pastStart = new Date(fixedNowMs - 5 * 3600_000).toISOString();
    const pastEnd = new Date(fixedNowMs - 3 * 3600_000).toISOString();
    tempDb.prepare(`
      INSERT INTO workouts (
        id, creator_id, title, sport, start_at, end_at, municipality, meeting_point,
        meeting_lat, meeting_lng, route_description, distance_km, level_min, level_max,
        hydration_points, additional_notes, is_sample, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      'test-finished-workout',
      regA.data.user.id,
      'Salida Finalizada Ficticia',
      'mtb',
      pastStart,
      pastEnd,
      'Marinilla',
      'Parque de Marinilla',
      6.1742,
      -75.3361,
      'Ruta finalizada de prueba',
      20,
      15,
      20,
      '',
      '',
      pastStart
    );
    tempDb.prepare('INSERT INTO enrollments (workout_id, user_id, enrolled_at) VALUES (?, ?, ?)').run(
      'test-finished-workout',
      regA.data.user.id,
      pastStart
    );
    tempDb.close();

    // Publish memory for finished workout
    const postMem = await sessionA.request('/api/memories', {
      method: 'POST',
      body: {
        workoutId: 'test-finished-workout',
        photoUrl: memUpload.data.url,
        caption: 'Excelente rodada matutina en grupo por Marinilla.',
      },
    });
    assert.equal(postMem.status, 201);
    assert.equal(postMem.data.memory.sport, 'mtb');
    assert.equal(postMem.data.memory.municipality, 'Marinilla');

    // Visible from another session (sessionB) after reload
    const memListB = await sessionB.request('/api/memories');
    assert.equal(memListB.status, 200);
    const foundMem = memListB.data.memories.find((m: any) => m.workoutId === 'test-finished-workout');
    assert.ok(foundMem);
    assert.equal(foundMem.caption, 'Excelente rodada matutina en grupo por Marinilla.');
    assert.equal(foundMem.photoUrl, memUpload.data.url);
    assert.equal(foundMem.authorName, 'Laura Prueba Editada');

    // Verify uploaded photo is actually served by Express
    const imgResp = await fetch(`${baseUrl}${foundMem.photoUrl}`);
    assert.equal(imgResp.status, 200);
    assert.equal(imgResp.headers.get('content-type'), 'image/png');

    // -----------------------------------------------------------------------
    // 9. Cookie-less iframe Bearer session fallback
    // -----------------------------------------------------------------------
    const regNoCookie = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        makeUserPayload('Maria Iframe', 'maria.iframe@test.co', 6.25, -75.59, 'Medellín')
      ),
    });
    assert.equal(regNoCookie.status, 201);
    const regNoCookieJson = (await regNoCookie.json()) as { sessionToken: string };
    assert.ok(regNoCookieJson.sessionToken);

    const enrollWithBearer = await fetch(
      `${baseUrl}/api/workouts/sample-workout-run-medellin/enroll`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${regNoCookieJson.sessionToken}`,
        },
      }
    );
    assert.equal(enrollWithBearer.status, 201);

    const logoutWithBearer = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${regNoCookieJson.sessionToken}`,
      },
    });
    assert.equal(logoutWithBearer.status, 200);

    const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${regNoCookieJson.sessionToken}`,
      },
    });
    const meAfterLogoutJson = (await meAfterLogout.json()) as { user: unknown };
    assert.equal(meAfterLogoutJson.user, null);
  } finally {
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
