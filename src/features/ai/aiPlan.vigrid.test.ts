import { describe, expect, it, vi } from 'vitest';

// Los stores leen localStorage y el tema al cargarse: un sustituto mínimo basta para estas pruebas sin navegador.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) },
    document: { documentElement: { classList: { toggle: () => {} } } },
  });
});
import { maps } from '../../config/maps/index.ts';
import { isWalkable } from '../../lib/walk.ts';
import { newStrategy } from '../../store/strategyStore.ts';
import { applyPlan, buildPrompt, parsePlan } from './aiPlan.ts';

const map = maps.vigrid;

describe('asistente IA en Vigrid', () => {
  it('el encargo trae las reglas del cuerno y el ejemplo de Vigrid', () => {
    const prompt = buildPrompt('', { ...newStrategy('vigrid', 'vigrid'), field: 'main' }, map);
    expect(prompt).toContain('Cuerno de Heimdall');
    expect(prompt).toContain('"horn": { "holder": "green", "seconds": 60 }');
    expect(prompt).not.toContain('Los pilares aparecen');
  });

  it('aplica cuerno y últimos golpes, y deja las fichas sobre el sendero', () => {
    const plan = parsePlan(`\`\`\`json
{ "raids": [{ "number": 1, "parties": [1, 2] }],
  "steps": [{ "name": "Valkyrie", "horn": { "holder": "green", "seconds": 45 },
    "groups": [{ "type": "raid", "number": 1, "at": "altar-3" }],
    "arrows": [{ "from": "entry-1", "to": "horn" }],
    "objectives": [{ "marker": "horn", "status": "captured-green" }, { "marker": "altar-1", "status": "destroyed" }, { "marker": "respawn-1", "status": "active" }] }] }
\`\`\``);
    if (typeof plan === 'string') throw new Error(plan);
    const { strategy, warnings } = applyPlan(plan, { ...newStrategy('vigrid', 'vigrid'), field: 'main' }, map, true);
    const step = strategy.steps[0];
    expect(step.horn).toEqual({ holder: 'green', seconds: 45 });
    expect(step.objectives.map((o) => o.markerId)).toEqual(['horn', 'altar-1']);
    expect(warnings).toEqual(['Paso 1: "respawn-1" no es un objetivo del mapa.']);
    expect(step.tokens.every((t) => isWalkable(t.pos, map.geometry))).toBe(true);
    const arrow = step.drawings.find((d) => d.tool === 'arrow')!;
    expect(arrow.points.length).toBeGreaterThan(2);
  });

  it('todos los marcadores del mapa quedan sobre terreno transitable', () => {
    for (const m of [maps.vigrid]) {
      expect(m.markers.filter((k) => !isWalkable(k.pos, m.geometry)).map((k) => k.id)).toEqual([]);
    }
  });
});

describe('relieve de Vigrid', () => {
  it('los altares están en altura y se baja por un sendero en rampa hasta el suelo', async () => {
    const { elevationAt } = await import('../../lib/elevation.ts');
    const { route } = await import('../../lib/walk.ts');
    const g = map.geometry;
    const at = (id: string) => map.markers.find((m) => m.id === id)!.pos;
    for (const altar of map.markers.filter((m) => m.kind === 'altar')) {
      expect(elevationAt(g, 1, altar.pos)).toBeGreaterThan(2);
      // Camino a pie desde la entrada: la altura sube sin saltos bruscos.
      const path = route(at('entry-1'), altar.pos, g, 1);
      const samples: number[] = [];
      for (let i = 1; i < path.length; i++) for (let k = 0; k <= 20; k++) samples.push(elevationAt(g, 1, { x: path[i - 1].x + ((path[i].x - path[i - 1].x) * k) / 20, y: path[i - 1].y + ((path[i].y - path[i - 1].y) * k) / 20 }));
      const jump = Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i])));
      expect({ altar: altar.id, jump: Math.round(jump * 100) / 100 }).toEqual({ altar: altar.id, jump: expect.any(Number) });
      expect(jump, altar.id).toBeLessThan(0.8);
    }
    expect(elevationAt(g, 1, at('entry-1'))).toBe(0);
  });
});
