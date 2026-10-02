import { maps } from '../../config/maps/index.ts';
import { modeById } from '../../config/modes/index.ts';
import { commitFiles } from '../../lib/github.ts';
import { useAdminStore } from '../../store/adminStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { tierPoints, useScoringStore } from '../../store/scoringStore.ts';

const pretty = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

/** ¿Hay algo distinto de lo publicado? (mapa editado o puntos por tier cambiados) */
export function pendingChanges(): { map: boolean; scoring: boolean } {
  const { map } = useMapStore.getState();
  const base = maps[map.id];
  const mapChanged = JSON.stringify([map.geometry, map.markers, map.numpad]) !== JSON.stringify([base.geometry, base.markers, base.numpad]);
  const scoring = modeById(map.modeId)?.scoring;
  const resolved = tierPoints(map.modeId, useScoringStore.getState().overrides);
  const scoringChanged =
    !!scoring &&
    (resolved.tickSeconds !== scoring.captureTickSeconds ||
      resolved.tiers.some((t) => {
        const c = scoring.tiers.find((x) => x.id === t.id);
        return t.destroy !== c?.destroyPoints || t.capturePerTick !== c?.capturePointsPerTick || t.maxTicks !== c?.maxTicks;
      }));
  return { map: mapChanged, scoring: scoringChanged };
}

/**
 * Publica el mapa y los puntos por tier en el repositorio, en un solo commit.
 * El sitio se vuelve a desplegar solo y todos reciben la versión nueva en un par de minutos.
 */
export async function publishMap(): Promise<void> {
  const { token, login } = useAdminStore.getState();
  if (!token) throw new Error('Inicia sesión como superadministrador para publicar.');
  const { map } = useMapStore.getState();
  const resolved = tierPoints(map.modeId, useScoringStore.getState().overrides);
  await commitFiles(
    token,
    [
      { path: `src/config/maps/${map.id}.geo.json`, content: JSON.stringify(map.geometry) + '\n' },
      { path: `src/config/maps/${map.id}.markers.json`, content: pretty({ numpad: map.numpad, markers: map.markers }) },
      {
        path: `src/config/modes/${map.modeId}.scoring.json`,
        content: pretty({
          tiers: resolved.tiers.map((t) => ({ id: t.id, destroyPoints: t.destroy, capturePointsPerTick: t.capturePerTick, maxTicks: t.maxTicks })),
          captureTickSeconds: resolved.tickSeconds,
        }),
      },
    ],
    `Mapa ${map.name}: cambios publicados desde la web por ${login ?? 'el superadministrador'}`,
  );
}
