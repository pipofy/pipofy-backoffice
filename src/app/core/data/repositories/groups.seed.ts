/**
 * Semilla del demo: los 6 grupos de index-v2.html:1658-1683 en forma de DTO crudo (snake_case),
 * para que el mock ejercite el mismo borde DTO→entidad que usaría el backend real.
 *
 * `as const` NO: el schema valibot devuelve tipos mutables y v.parse lo consume tal cual.
 *
 * ponytail: toda la pantalla `/grupos` corre contra esta semilla. Salida: el endpoint HTTP de
 * asistencia, que no existe en el backend — `attendance_status` sólo lo escriben
 * `conversation.service.ts` y `coach-conversation.service.ts` (el flujo de WhatsApp). El
 * roster ya tiene fuente real (`GET /class-sessions/:id/reservations`, conectado en esta
 * misma entrega); sin asistencia queda mitad real y mitad maqueta, por eso no se migra ahora.
 */
export const GROUPS_SEED = {
  club_id: 'c1',
  groups: [
    {
      id: '1', name: '7ma+8va · Lunes PM', category: '7ma+8va',
      teacher: 'Diego A.', teacher_initials: 'D',
      day: 'Lun', time: '18:00', court_name: 'Cancha 1', capacity: 4,
      roster: [
        { id: '1-r1', name: 'Lucía Pereyra', initials: 'LP', category: '7ma', credits: 6, attendance_rate: 92 },
        { id: '1-r2', name: 'Bruno Torres',  initials: 'BT', category: '7ma', credits: 3, attendance_rate: 78 },
        { id: '1-r3', name: 'Ezequiel Paz',  initials: 'EP', category: '8va', credits: 8, attendance_rate: 100 },
        { id: '1-r4', name: 'Marcos Díaz',   initials: 'MD', category: '8va', credits: 4, attendance_rate: 64 },
      ],
      waitlist: [{ name: 'Julián Vera', initials: 'JV', since: 'hace 2 días' }],
      sessions: [
        { id: '1-s1', date: '01/07', time: '18:00', court_name: 'Cancha 1', status: 'done', attendance: [
          { member_id: '1-r1', present: true }, { member_id: '1-r2', present: true },
          { member_id: '1-r3', present: true }, { member_id: '1-r4', present: true },
        ] },
        { id: '1-s2', date: '08/07', time: '18:00', court_name: 'Cancha 1', status: 'prog', attendance: null },
        { id: '1-s3', date: '15/07', time: '18:00', court_name: 'Cancha 1', status: 'prog', attendance: null },
      ],
    },
    {
      id: '2', name: '6ta · Miércoles', category: '6ta',
      teacher: 'Sofía M.', teacher_initials: 'S',
      day: 'Mié', time: '19:00', court_name: 'Cancha 2', capacity: 4,
      roster: [
        { id: '2-r1', name: 'Camila Sosa',    initials: 'CS', category: '6ta', credits: 2, attendance_rate: 70 },
        { id: '2-r2', name: 'Ana Giménez',    initials: 'AG', category: '6ta', credits: 7, attendance_rate: 88 },
        { id: '2-r3', name: 'Valentina Ríos', initials: 'VR', category: '6ta', credits: 5, attendance_rate: 81 },
      ],
      waitlist: [],
      sessions: [
        { id: '2-s1', date: '02/07', time: '19:00', court_name: 'Cancha 2', status: 'done', attendance: [
          { member_id: '2-r1', present: true }, { member_id: '2-r2', present: true }, { member_id: '2-r3', present: true },
        ] },
        { id: '2-s2', date: '09/07', time: '19:00', court_name: 'Cancha 2', status: 'prog', attendance: null },
      ],
    },
    {
      id: '3', name: 'Nivelación · Intensivo', category: 'Nivelación',
      teacher: 'Diego A.', teacher_initials: 'D',
      day: 'Mié', time: '18:00', court_name: 'Central', capacity: 4,
      roster: [
        { id: '3-r1', name: 'Pablo Ruiz',   initials: 'PR', category: 'Nivel.', credits: 1, attendance_rate: 75 },
        { id: '3-r2', name: 'Renata Ávila', initials: 'RA', category: 'Nivel.', credits: 2, attendance_rate: 90 },
        { id: '3-r3', name: 'Tomás Leiva',  initials: 'TL', category: 'Nivel.', credits: 3, attendance_rate: 66 },
        { id: '3-r4', name: 'Iván Costa',   initials: 'IC', category: 'Nivel.', credits: 1, attendance_rate: 50 },
      ],
      waitlist: [
        { name: 'Florencia Gil', initials: 'FG', since: 'hace 1 día' },
        { name: 'Nahuel Ponce',  initials: 'NP', since: 'hoy' },
      ],
      sessions: [
        // MIXTA A PROPÓSITO — la maqueta dice 4/4. Es el ÚNICO dato de la semilla que distingue
        // "editar restaura las marcas guardadas" de "editar arranca todo presente como el modo
        // tomar". Sin esta sesión, el criterio de aceptación 10 pasa en verde sin probar nada.
        { id: '3-s1', date: '03/07', time: '18:00', court_name: 'Central', status: 'done', attendance: [
          { member_id: '3-r1', present: true }, { member_id: '3-r2', present: true },
          { member_id: '3-r3', present: true }, { member_id: '3-r4', present: false },
        ] },
        { id: '3-s2', date: '05/07', time: '18:00', court_name: 'Central', status: 'canc', attendance: null },
        { id: '3-s3', date: '10/07', time: '18:00', court_name: 'Central', status: 'prog', attendance: null },
      ],
    },
    {
      id: '4', name: '5ta · Competitivo', category: '5ta',
      teacher: 'Diego A.', teacher_initials: 'D',
      day: 'Vie', time: '20:00', court_name: 'Cancha 3', capacity: 6,
      roster: [
        { id: '4-r1', name: 'Diego Ferrari', initials: 'DF', category: '5ta', credits: 5, attendance_rate: 95 },
        { id: '4-r2', name: 'Sofía Molina',  initials: 'SM', category: '5ta', credits: 4, attendance_rate: 72 },
        { id: '4-r3', name: 'Lautaro Vega',  initials: 'LV', category: '5ta', credits: 6, attendance_rate: 84 },
        { id: '4-r4', name: 'Emilia Nunes',  initials: 'EN', category: '5ta', credits: 3, attendance_rate: 79 },
        { id: '4-r5', name: 'Franco Bravo',  initials: 'FB', category: '5ta', credits: 2, attendance_rate: 60 },
      ],
      waitlist: [],
      sessions: [
        { id: '4-s1', date: '04/07', time: '20:00', court_name: 'Cancha 3', status: 'done', attendance: [
          { member_id: '4-r1', present: true }, { member_id: '4-r2', present: true }, { member_id: '4-r3', present: true },
          { member_id: '4-r4', present: true }, { member_id: '4-r5', present: true },
        ] },
        { id: '4-s2', date: '11/07', time: '20:00', court_name: 'Cancha 3', status: 'prog', attendance: null },
      ],
    },
    {
      id: '5', name: 'Damas · 6ta', category: '6ta',
      teacher: 'Sofía M.', teacher_initials: 'S',
      day: 'Mar', time: '10:00', court_name: 'Cancha 2', capacity: 4,
      // OJO: Lucía, Camila, Ana y Valentina también están en los grupos 1 y 2. Acá son
      // inscripciones INDEPENDIENTES con su propio saldo: sin entidad Alumno (D9) no hay dónde
      // guardar un saldo único. Ver la nota "los créditos son por inscripción" del plan.
      roster: [
        { id: '5-r1', name: 'Lucía Pereyra',  initials: 'LP', category: '7ma', credits: 6, attendance_rate: 92 },
        { id: '5-r2', name: 'Camila Sosa',    initials: 'CS', category: '6ta', credits: 2, attendance_rate: 70 },
        { id: '5-r3', name: 'Ana Giménez',    initials: 'AG', category: '6ta', credits: 7, attendance_rate: 88 },
        { id: '5-r4', name: 'Valentina Ríos', initials: 'VR', category: '6ta', credits: 5, attendance_rate: 81 },
      ],
      waitlist: [],
      sessions: [
        { id: '5-s1', date: '01/07', time: '10:00', court_name: 'Cancha 2', status: 'done', attendance: [
          { member_id: '5-r1', present: true }, { member_id: '5-r2', present: true },
          { member_id: '5-r3', present: true }, { member_id: '5-r4', present: true },
        ] },
        { id: '5-s2', date: '08/07', time: '10:00', court_name: 'Cancha 2', status: 'prog', attendance: null },
      ],
    },
    {
      id: '6', name: 'Iniciación · Adultos', category: 'Iniciación',
      teacher: 'Sofía M.', teacher_initials: 'S',
      day: 'Sáb', time: '11:00', court_name: 'Cancha 1', capacity: 6,
      roster: [
        { id: '6-r1', name: 'Gastón Ferro',   initials: 'GF', category: 'Inic.', credits: 4, attendance_rate: 100 },
        { id: '6-r2', name: 'Paula Cardozo',  initials: 'PC', category: 'Inic.', credits: 2, attendance_rate: 83 },
        { id: '6-r3', name: 'Rodrigo Silva',  initials: 'RS', category: 'Inic.', credits: 3, attendance_rate: 67 },
      ],
      waitlist: [],
      sessions: [
        { id: '6-s1', date: '05/07', time: '11:00', court_name: 'Cancha 1', status: 'done', attendance: [
          { member_id: '6-r1', present: true }, { member_id: '6-r2', present: true }, { member_id: '6-r3', present: true },
        ] },
        { id: '6-s2', date: '12/07', time: '11:00', court_name: 'Cancha 1', status: 'prog', attendance: null },
      ],
    },
  ],
};
