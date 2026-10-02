import type { MapConfig } from '../../types/index.ts';

export const exportGeoJson = (map: MapConfig): string => JSON.stringify(map.geometry) + '\n';

export function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
