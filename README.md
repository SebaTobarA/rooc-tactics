# ROOC Tactics

Planificador de estrategias para los eventos de guild de Ragnarok Origin Classic. Cubre Guild League → Vale of Clash y Vigrid Avenge.

## Uso en local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/rooc-tactics/`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y compila a `dist/` |
| `npm run generate:map` | Regenera `src/config/maps/vale-of-clash.geo.json` desde `assets-src/` y deja vistas previas en `scripts/out/` |
| `npm run generate:vigrid` | Regenera la geometría y los marcadores de Vigrid desde su minimapa en `assets-src/` (pisa lo publicado desde la web) |

## Agregar un mapa

1. Deja sus imágenes de referencia en `assets-src/`.
2. Copia `scripts/maps/vale-of-clash.source.ts`, ajusta rutas, recorte del minimapa y puntos de referencia, y apunta `scripts/generate-map.ts` a ese archivo.
3. Ejecuta `npm run generate:map` y revisa `scripts/out/<id>-preview.png`.
4. Crea `src/config/maps/<id>.ts` (y su `.style.ts`), regístralo en `src/config/maps/index.ts` y agrégalo a `maps` en la config del modo.
5. Retoca con el botón «Editor de mapa» y reemplaza los archivos que exporta.

## Vigrid Avenge

Se elige en la portada como un mapa de Guild League, pero tiene reglas propias (modo interno `vigrid` en `src/config/modes/vigrid.ts`): no hay pilares, se puntúa por el cuerno, los jefes y las kills, con meta de 800.000.

- En Ragnarok Origin Classic se juega en un solo mapa (`vigrid`): no hay Ruinscape ni elección de campo.
- Los valores de puntos, mecánicas y pendientes viven en `src/config/modes/vigrid.ts`; el simulador, la pestaña Objet. y el asistente IA los leen de ahí.
- Íconos y estados de los objetivos (cuerno, Fenrir, Señores Elementales, altares, Draculas, Nidhogg…): `src/config/objectiveKinds.ts`.
- Por paso se anota quién tiene el cuerno y cuántos segundos; los jefes se marcan «Último golpe: Verde/Roja» y los altares, «Corrompido».

## Pendientes marcados como TODO

- Puntos por tier y segundos por tick de captura: `src/config/modes/guild-league.ts`.
- Nombre y función de los puntos verdes y morados: `confirmed: false` en `src/config/maps/vale-of-clash.ts`.

## Importar jugadores

Texto, una línea por jugador (`Nombre;Job`, opcionalmente `;Rol`), o JSON:

```json
[{ "name": "Seba", "job": "High Priest", "role": "support", "note": "shotcaller" }]
```

También acepta `nombre`, `jobId`/`class`/`clase`, `rol` y `nota`, y un objeto `{ "players": [...] }`.

## Despliegue

Cada push a `main` publica en GitHub Pages con `.github/workflows/deploy.yml`. En el repositorio: Settings → Pages → Source: GitHub Actions. La ruta base (`/rooc-tactics/`) está en `vite.config.ts`.

## Publicar una estrategia con enlace corto

El sitio no tiene servidor, así que un enlace corto apunta a un archivo del repositorio:

1. En la web: «Guardar y compartir» → «Exportar JSON».
2. Guarda el archivo como `public/strategies/<nombre>.json` (solo letras, números y guiones).
3. Agrega una entrada en `public/strategies/index.json` con `slug`, `name`, `modeId`, `mapId` y `updatedAt`.
4. Haz commit y push. El enlace queda en `https://sebatobara.github.io/rooc-tactics/#/p/<nombre>`.

## Superadministrador

Solo el superadministrador edita los mapas. No hay servidor: la edición se activa en la dirección `#/admin` (no tiene botón en el sitio) y, para publicar, se agrega ahí un token de GitHub de acceso restringido a este repositorio con permiso «Contents: Read and write». Al pulsar «Publicar para todos», la web guarda en un commit:

- `src/config/maps/<mapa>.geo.json` (terreno y plazas)
- `src/config/maps/<mapa>.markers.json` (pilares con su tier, respawns, puntos y grilla)
- `src/config/modes/<modo>.scoring.json` (puntos por tier)

El despliegue corre solo y las pestañas abiertas se actualizan. Ojo: `npm run generate:map` vuelve a generar el `.geo.json` y pisa los retoques hechos desde la web.
