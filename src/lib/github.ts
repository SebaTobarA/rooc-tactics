/** Repositorio que hace de "sistema": lo que el superadministrador publica queda como commit y se despliega solo. */
export const REPO = 'SebaTobarA/rooc-tactics';
const BRANCH = 'main';
const API = 'https://api.github.com';

async function gh<T>(token: string, path: string, init?: { method: string; body: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { message?: string }).message ?? '';
    throw new Error(res.status === 401 ? 'El token no es válido o venció.' : res.status === 403 || res.status === 404 ? `El token no tiene permiso sobre ${REPO}. ${detail}` : `GitHub respondió ${res.status}. ${detail}`);
  }
  return (await res.json()) as T;
}

/** Comprueba que el token pueda escribir en el repositorio. Devuelve el usuario de GitHub. */
export async function checkAccess(token: string): Promise<string> {
  const repo = await gh<{ permissions?: { push?: boolean }; owner: { login: string } }>(token, `/repos/${REPO}`);
  if (!repo.permissions?.push) throw new Error(`El token puede leer ${REPO}, pero no escribir. Dale permiso «Contents: Read and write».`);
  // Los tokens de acceso restringido no siempre pueden leer /user; el dueño del repositorio sirve de nombre.
  return gh<{ login: string }>(token, '/user').then((u) => u.login).catch(() => repo.owner.login);
}

/** Publica varios archivos en un solo commit sobre la rama principal. */
export async function commitFiles(token: string, files: { path: string; content: string }[], message: string): Promise<string> {
  const base = `/repos/${REPO}/git`;
  const ref = await gh<{ object: { sha: string } }>(token, `${base}/ref/heads/${BRANCH}`);
  const parent = await gh<{ tree: { sha: string } }>(token, `${base}/commits/${ref.object.sha}`);
  const tree = await gh<{ sha: string }>(token, `${base}/trees`, {
    method: 'POST',
    body: { base_tree: parent.tree.sha, tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) },
  });
  const commit = await gh<{ sha: string }>(token, `${base}/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [ref.object.sha] } });
  await gh(token, `${base}/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commit.sha } });
  return commit.sha;
}
