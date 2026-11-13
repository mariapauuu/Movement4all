import crypto from 'node:crypto';
import { db } from './db.ts';

function hashPasswordForSeed(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function seedIfEmpty(): void {
  const userCount = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
  const workoutCount = (db.prepare('SELECT COUNT(*) AS count FROM workouts').get() as { count: number }).count;

  if (userCount > 0 || workoutCount > 0) {
    return;
  }

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const isoPlusHours = (h: number) => new Date(now + h * hour).toISOString();
  const demoPasswordHash = hashPasswordForSeed('EjemploM4A#2026');

  const sampleUsers = [
    {
      id: 'sample-user-camila',
      name: 'Camila Restrepo (Ejemplo)',
      email: 'camila.ejemplo@movement4all.local',
      password_hash: demoPasswordHash,
      avatar_url: null,
      birth_date: '1994-05-18',
      sports_json: JSON.stringify(['running', 'open_water']),
      home_label: 'Estadio Atanasio Girardot, Medellín',
      home_lat: 6.2569,
      home_lng: -75.5902,
      max_travel_km: 25,
      blood_type: 'O+',
      medical_restrictions: 'Ninguna conocida.',
      emergency_contact_name: 'Sofía Restrepo (Ejemplo)',
      emergency_contact_phone: '+57 300 000 0101',
      emergency_contact_relation: 'Hermana',
      is_sample: 1,
      created_at: isoPlusHours(-240),
    },
    {
      id: 'sample-user-mateo',
      name: 'Mateo Londoño (Ejemplo)',
      email: 'mateo.ejemplo@movement4all.local',
      password_hash: demoPasswordHash,
      avatar_url: null,
      birth_date: '1991-09-02',
      sports_json: JSON.stringify(['road_cycling', 'mtb']),
      home_label: 'Parque Principal de Envigado',
      home_lat: 6.1719,
      home_lng: -75.5867,
      max_travel_km: 40,
      blood_type: 'A+',
      medical_restrictions: 'Alergia leve a picadura de abeja; lleva antihistamínico.',
      emergency_contact_name: 'Carlos Londoño (Ejemplo)',
      emergency_contact_phone: '+57 300 000 0102',
      emergency_contact_relation: 'Padre',
      is_sample: 1,
      created_at: isoPlusHours(-230),
    },
    {
      id: 'sample-user-valeria',
      name: 'Valeria Gómez (Ejemplo)',
      email: 'valeria.ejemplo@movement4all.local',
      password_hash: demoPasswordHash,
      avatar_url: null,
      birth_date: '1996-11-24',
      sports_json: JSON.stringify(['mtb', 'running']),
      home_label: 'Parque Principal de Marinilla',
      home_lat: 6.1742,
      home_lng: -75.3361,
      max_travel_km: 35,
      blood_type: 'B+',
      medical_restrictions: 'Asma leve inducida por frío; porta inhalador.',
      emergency_contact_name: 'Andrea Gómez (Ejemplo)',
      emergency_contact_phone: '+57 300 000 0103',
      emergency_contact_relation: 'Madre',
      is_sample: 1,
      created_at: isoPlusHours(-220),
    },
    {
      id: 'sample-user-santiago',
      name: 'Santiago Mejía (Ejemplo)',
      email: 'santiago.ejemplo@movement4all.local',
      password_hash: demoPasswordHash,
      avatar_url: null,
      birth_date: '1989-03-11',
      sports_json: JSON.stringify(['open_water', 'road_cycling']),
      home_label: 'Malecón del Embalse, Guatapé',
      home_lat: 6.2328,
      home_lng: -75.1583,
      max_travel_km: 50,
      blood_type: 'No lo sé',
      medical_restrictions: 'Sin restricciones médicas.',
      emergency_contact_name: 'Laura Arango (Ejemplo)',
      emergency_contact_phone: '+57 300 000 0104',
      emergency_contact_relation: 'Pareja',
      is_sample: 1,
      created_at: isoPlusHours(-210),
    },
  ];

  const sampleWorkouts = [
    {
      id: 'sample-workout-run-medellin',
      creator_id: 'sample-user-camila',
      title: 'Rodaje conversacional Estadio – Ciclovía del Río (Ejemplo)',
      sport: 'running',
      start_at: isoPlusHours(28),
      end_at: isoPlusHours(29.5),
      municipality: 'Medellín',
      meeting_point: 'Entrada principal Unidad Deportiva Atanasio Girardot',
      meeting_lat: 6.2569,
      meeting_lng: -75.5902,
      route_description:
        'Salimos desde el Estadio hacia la Avenida San Juan, conectamos con el corredor verde de Parques del Río y regresamos en ritmo constante y acompañado.',
      distance_km: 10.5,
      level_min: 5.0,
      level_max: 6.0,
      hydration_points: 'Bebedero frente al coliseo Iván de Bedout y estación Parques del Río (km 5.2).',
      additional_notes: 'Ideal para sumar kilómetros sin afán. Llevamos luz frontal o prenda visible si salimos temprano.',
      is_sample: 1,
      created_at: isoPlusHours(-48),
    },
    {
      id: 'sample-workout-mtb-marinilla',
      creator_id: 'sample-user-valeria',
      title: 'Trocha suave por veredas de Marinilla (Ejemplo)',
      sport: 'mtb',
      start_at: isoPlusHours(52),
      end_at: isoPlusHours(55),
      municipality: 'Marinilla',
      meeting_point: 'Esquina norte del Parque Principal de Marinilla',
      meeting_lat: 6.1742,
      meeting_lng: -75.3361,
      route_description:
        'Circuito mixto de destapado y sendero rural hacia la vereda Pozo con paradas breves en los altos para reagrupar.',
      distance_km: 26,
      level_min: 14,
      level_max: 20,
      hydration_points: 'Tienda rural vereda Pozo (km 13).',
      additional_notes: 'Casco obligatorio, neumático de repuesto y mínimo dos caramañolas.',
      is_sample: 1,
      created_at: isoPlusHours(-36),
    },
    {
      id: 'sample-workout-ruta-envigado',
      creator_id: 'sample-user-mateo',
      title: 'Subida grupal Escobero – Alto de Palmas (Ejemplo)',
      sport: 'road_cycling',
      start_at: isoPlusHours(76),
      end_at: isoPlusHours(79.5),
      municipality: 'Envigado',
      meeting_point: 'Cruce CAI Escobero con Avenida Las Vegas',
      meeting_lat: 6.1614,
      meeting_lng: -75.5453,
      route_description:
        'Ascenso regulado a ritmo propio hasta el retorno del km 12, reagrupación en el mirador y descenso controlado en grupo.',
      distance_km: 42,
      level_min: 22,
      level_max: 28,
      hydration_points: 'Estación de servicio mirador km 12 y panadería de retorno.',
      additional_notes: 'Luz trasera encendida y cortavientos para el descenso.',
      is_sample: 1,
      created_at: isoPlusHours(-30),
    },
    {
      id: 'sample-workout-swim-guatape',
      creator_id: 'sample-user-santiago',
      title: 'Travesía tranquila en boyas por el Embalse (Ejemplo)',
      sport: 'open_water',
      start_at: isoPlusHours(100),
      end_at: isoPlusHours(102),
      municipality: 'Guatapé',
      meeting_point: 'Muelle peatonal del Malecón de Guatapé',
      meeting_lat: 6.2328,
      meeting_lng: -75.1583,
      route_description:
        'Nado paralelo a la orilla en circuito ida y vuelta con paradas cada 500 metros para verificar orientación y grupo.',
      distance_km: 2.0,
      level_min: 1.8333,
      level_max: 2.5,
      hydration_points: 'Termos e hidratación en el punto de salida al finalizar.',
      additional_notes: 'Boya de seguridad personal obligatoria y gorro visible.',
      is_sample: 1,
      created_at: isoPlusHours(-24),
    },
    {
      id: 'sample-workout-closed-envigado',
      creator_id: 'sample-user-camila',
      title: 'Trote vespertino Parque de Envigado (Ejemplo cierre <8h)',
      sport: 'running',
      start_at: isoPlusHours(4),
      end_at: isoPlusHours(5.5),
      municipality: 'Envigado',
      meeting_point: 'Atrio de la iglesia Parque Principal de Envigado',
      meeting_lat: 6.1719,
      meeting_lng: -75.5867,
      route_description:
        'Vuelta urbana suave por la canalización de la Ayurá para soltar piernas en grupo.',
      distance_km: 7.5,
      level_min: 5.25,
      level_max: 6.25,
      hydration_points: 'Punto de hidratación en el Polideportivo Sur.',
      additional_notes: 'Este entrenamiento de ejemplo ya superó el límite de 8 horas previas para nuevas inscripciones.',
      is_sample: 1,
      created_at: isoPlusHours(-72),
    },
    {
      id: 'sample-workout-past-ruta',
      creator_id: 'sample-user-mateo',
      title: 'Rodada matutina Poblado – Oriente (Ejemplo finalizado)',
      sport: 'road_cycling',
      start_at: isoPlusHours(-48),
      end_at: isoPlusHours(-45),
      municipality: 'Medellín',
      meeting_point: 'Parque El Poblado junto a la estación de bicicletas',
      meeting_lat: 6.2105,
      meeting_lng: -75.5707,
      route_description:
        'Salida temprana en pelotón compacto hacia el oriente antioqueño con parada de café al regreso.',
      distance_km: 38,
      level_min: 24,
      level_max: 30,
      hydration_points: 'Parada de café en km 19.',
      additional_notes: 'Sesión completada.',
      is_sample: 1,
      created_at: isoPlusHours(-140),
    },
    {
      id: 'sample-workout-past-run',
      creator_id: 'sample-user-camila',
      title: 'Fondo largo frente al embalse de Guatapé (Ejemplo finalizado)',
      sport: 'running',
      start_at: isoPlusHours(-96),
      end_at: isoPlusHours(-94),
      municipality: 'Guatapé',
      meeting_point: 'Malecón turístico de Guatapé',
      meeting_lat: 6.2328,
      meeting_lng: -75.1583,
      route_description:
        'Recorrido panorámico bordeando el malecón y la salida hacia El Peñol a ritmo conversacional.',
      distance_km: 12,
      level_min: 5.5,
      level_max: 6.3333,
      hydration_points: 'Puntos de agua en el malecón (km 0 y km 6).',
      additional_notes: 'Sesión completada.',
      is_sample: 1,
      created_at: isoPlusHours(-180),
    },
  ];

  const sampleEnrollments = [
    ['sample-workout-run-medellin', 'sample-user-camila', isoPlusHours(-48)],
    ['sample-workout-run-medellin', 'sample-user-valeria', isoPlusHours(-20)],
    ['sample-workout-mtb-marinilla', 'sample-user-valeria', isoPlusHours(-36)],
    ['sample-workout-mtb-marinilla', 'sample-user-mateo', isoPlusHours(-18)],
    ['sample-workout-ruta-envigado', 'sample-user-mateo', isoPlusHours(-30)],
    ['sample-workout-ruta-envigado', 'sample-user-santiago', isoPlusHours(-16)],
    ['sample-workout-swim-guatape', 'sample-user-santiago', isoPlusHours(-24)],
    ['sample-workout-swim-guatape', 'sample-user-camila', isoPlusHours(-12)],
    ['sample-workout-closed-envigado', 'sample-user-camila', isoPlusHours(-72)],
    ['sample-workout-closed-envigado', 'sample-user-mateo', isoPlusHours(-22)],
    ['sample-workout-past-ruta', 'sample-user-mateo', isoPlusHours(-140)],
    ['sample-workout-past-ruta', 'sample-user-valeria', isoPlusHours(-100)],
    ['sample-workout-past-run', 'sample-user-camila', isoPlusHours(-180)],
    ['sample-workout-past-run', 'sample-user-santiago', isoPlusHours(-120)],
  ];

  const sampleMessages = [
    {
      id: 'sample-msg-1',
      workout_id: 'sample-workout-run-medellin',
      user_id: 'sample-user-camila',
      content: '¡Hola! Nos vemos justo frente a la puerta principal del estadio 10 minutos antes para calentar juntos.',
      created_at: isoPlusHours(-19),
    },
    {
      id: 'sample-msg-2',
      workout_id: 'sample-workout-run-medellin',
      user_id: 'sample-user-valeria',
      content: 'Confirmado, allá estaré con hidratación ligera. ¡Qué buen plan para el fin de semana!',
      created_at: isoPlusHours(-18),
    },
    {
      id: 'sample-msg-3',
      workout_id: 'sample-workout-closed-envigado',
      user_id: 'sample-user-camila',
      content: 'Recuerden que el chat sigue activo para avisar cualquier novedad antes de salir desde el parque.',
      created_at: isoPlusHours(-6),
    },
  ];

  const sampleMemories = [
    {
      id: 'sample-memory-1',
      workout_id: 'sample-workout-past-ruta',
      user_id: 'sample-user-mateo',
      photo_url: '/sample-media/sport_road_cycling_1794590646323.jpg',
      caption:
        'Amanecer despejado subiendo en grupo y cuidando el ritmo de todos hasta el mirador. Gran compañía para empezar el día.',
      is_sample: 1,
      created_at: isoPlusHours(-43),
    },
    {
      id: 'sample-memory-2',
      workout_id: 'sample-workout-past-run',
      user_id: 'sample-user-camila',
      photo_url: '/sample-media/memory_finish_smile_1794590647095.jpg',
      caption:
        'Terminamos los 12 km bordeando el embalse y cerramos con café caliente. Entrenar acompañados hace toda la diferencia.',
      is_sample: 1,
      created_at: isoPlusHours(-92),
    },
  ];

  const insertAll = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, avatar_url, birth_date, sports_json,
        home_label, home_lat, home_lng, max_travel_km, blood_type,
        medical_restrictions, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relation, is_sample, created_at
      ) VALUES (
        @id, @name, @email, @password_hash, @avatar_url, @birth_date, @sports_json,
        @home_label, @home_lat, @home_lng, @max_travel_km, @blood_type,
        @medical_restrictions, @emergency_contact_name, @emergency_contact_phone,
        @emergency_contact_relation, @is_sample, @created_at
      )
    `);
    for (const u of sampleUsers) insertUser.run(u);

    const insertWorkout = db.prepare(`
      INSERT INTO workouts (
        id, creator_id, title, sport, start_at, end_at, municipality, meeting_point,
        meeting_lat, meeting_lng, route_description, distance_km, level_min, level_max,
        hydration_points, additional_notes, is_sample, created_at
      ) VALUES (
        @id, @creator_id, @title, @sport, @start_at, @end_at, @municipality, @meeting_point,
        @meeting_lat, @meeting_lng, @route_description, @distance_km, @level_min, @level_max,
        @hydration_points, @additional_notes, @is_sample, @created_at
      )
    `);
    for (const w of sampleWorkouts) insertWorkout.run(w);

    const insertEnrollment = db.prepare(`
      INSERT INTO enrollments (workout_id, user_id, enrolled_at) VALUES (?, ?, ?)
    `);
    for (const [wid, uid, ts] of sampleEnrollments) insertEnrollment.run(wid, uid, ts);

    const insertMsg = db.prepare(`
      INSERT INTO chat_messages (id, workout_id, user_id, content, created_at)
      VALUES (@id, @workout_id, @user_id, @content, @created_at)
    `);
    for (const m of sampleMessages) insertMsg.run(m);

    const insertMem = db.prepare(`
      INSERT INTO memories (id, workout_id, user_id, photo_url, caption, is_sample, created_at)
      VALUES (@id, @workout_id, @user_id, @photo_url, @caption, @is_sample, @created_at)
    `);
    for (const mem of sampleMemories) insertMem.run(mem);
  });

  insertAll();
}
