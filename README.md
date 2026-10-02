# ROOC Tactics

Planificador de estrategias para los eventos de guild de Ragnarok Origin Classic. El MVP cubre Guild League → Vale of Clash.

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

## Agregar un mapa

1. Deja sus imágenes de referencia en `assets-src/`.
2. Copia `scripts/maps/vale-of-clash.source.ts`, ajusta rutas, recorte del minimapa y puntos de referencia, y apunta `scripts/generate-map.ts` a ese archivo.
3. Ejecuta `npm run generate:map` y revisa `scripts/out/<id>-preview.png`.
4. Crea `src/config/maps/<id>.ts` (y su `.style.ts`), regístralo en `src/config/maps/index.ts` y agrégalo a `maps` en la config del modo.
5. Retoca con el botón «Editor de mapa» y reemplaza los archivos que exporta.

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
