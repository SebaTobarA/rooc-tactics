import type { ModeConfig } from '../../types/index.ts';

/**
 * Vigrid Avenge: mapa de Guild League con reglas propias. En Ragnarok Origin Classic se juega en un solo mapa
 * (no hay Ruinscape, que en la versión Global es un tercer mapa). Es un conjunto de reglas interno: en la portada
 * aparece como un mapa más de Guild League.
 */
export const vigrid: ModeConfig = {
  id: 'vigrid',
  name: 'Guild League',
  enabled: true,
  hidden: true,
  description: 'Vigrid Avenge: gana la primera guild en llegar a 800.000 puntos.',
  maps: ['vigrid'],
  partySize: 5,
  raidMaxParties: 8,
  raidPresets: [
    { name: '1 raid de 40', raids: [40] },
    { name: '2 raids de 20', raids: [20, 20] },
    { name: '3 raids (15, 15 y 20)', raids: [15, 15, 20] },
  ],
  objectives: {
    main: {
      field: 'main',
      label: 'Vigrid Field',
      gameName: 'Vigrid Field',
      unit: 'puntos',
      goal: 800000,
      killPoints: 800,
      horn: { pointsPerTick: 4000, tickSeconds: 5, endBonus: 200000 },
      fiesta: {
        triggerSecondsLeft: 300,
        multiplier: 2,
        applies: 'Si a 5 minutos del final nadie llegó a 800.000, se duplican los puntos por matar monstruos y por mantener el cuerno (el cuerno pasa a 8.000 cada 5 s, Fenrir a 60.000).',
      },
      sources: [
        { kind: 'horn', name: 'Fallen Valkyrie', points: 30000, reward: 'el primer cuerno: quien da el último golpe se vuelve Heimdall Messenger', spawn: 'al centro, al inicio de la partida' },
        { kind: 'fenrir', name: 'Fenrir', points: 30000, reward: 'transformación en Avatar de Fenrir (neutraliza al portador del cuerno enemigo); hay 2 min para activarla o se activa sola, y dura 1 min', spawn: 'al centro, más avanzada la partida' },
        { kind: 'element-lord', name: 'Señor Elemental', points: 25000, reward: 'bufo de 60 s para toda la guild según su elemento', spawn: 'de a dos en las esquinas de la zona central, poco después de empezar' },
        { kind: 'dracula', name: 'Undead Spirit (Dracula)', points: 10000, reward: '', spawn: 'en los bordes exteriores, reaparece periódicamente' },
      ],
      mechanics: [
        'Entradas: cada guild entra por una de las 4 esquinas, al azar; no se sabe dónde está el rival hasta entrar. Conviene no revelar la propia.',
        'Al morir se elige reaparecer en la entrada propia o en el respawn azul más cercano al cadáver.',
        'Heimdall Messenger (portador del cuerno): ataque básico y en área para defensa propia, Escudo/Kyrie contra emboscadas, Invocar a la guild, Teletransporte aleatorio a un altar activo (la guild debe reagruparse al tiro) y bufo de velocidad.',
        'Divine Backlash: el portador pierde 10% de su HP máximo cada 5 s. Activar un altar da 60 s de inmunidad a esa pérdida y bufa a los aliados cercanos, así que el portador rota entre altares activos.',
        'Si el portador muere a manos de un enemigo, el cuerno pasa al asesino. Si muere por otra causa o sale del mapa, el cuerno cae y lo puede reclamar un enemigo al azar.',
        'Corrupción: cada 5 minutos se corrompen altares y quedan inhabilitados: primero 3, luego 2, luego 1. Las rutas seguras del portador se acortan.',
        'Señores Elementales — Agua: restaura SP. Viento: reduce la curación que reciben los enemigos. Tierra: repara equipo y da escudo fuera de combate. Fuego: al golpear rompe una pieza aleatoria del equipo enemigo.',
        'Las muertes propias restan eficiencia: farmear kills sin controlar el cuerno o los jefes rinde poco; los ticks del cuerno y los jefes dominan el marcador.',
      ],
      victory: [
        'Gana al instante la primera guild en llegar a 800.000 puntos.',
        'Si se acaba el tiempo, gana la de mayor puntaje; quien tiene el cuerno al final suma 200.000.',
        'Desempate: 1) quién sostuvo el cuerno por último; 2) poder total de los 10 mejores miembros.',
      ],
      pendingRules: ['Duración de la partida.', '¿Fiesta Tempo duplica también las kills y el bono final?', '¿Cuánto resta cada muerte propia?', 'Cada cuánto reaparece cada Dracula.'],
    },
  },
};
