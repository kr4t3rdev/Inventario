/**
 * @description Stub de `next/headers` para ejecutar Server Actions reales
 * fuera del runtime de Next.js (scripts operativos).
 *
 * `getCurrentUser()` lee la cookie `auth_token`; aqui se expone el token de
 * la sesion efimera que el script define en `process.env.OPS_AUTH_TOKEN`.
 * El resto de la resolucion de sesion (JWT, `UserSession`, membresia,
 * permisos y features del plan) sigue siendo la de la aplicacion.
 */
export async function cookies() {
	const token = process.env.OPS_AUTH_TOKEN ?? '';
	return {
		get: (name) =>
			name === 'auth_token' && token ? { name, value: token } : undefined,
		getAll: () => (token ? [{ name: 'auth_token', value: token }] : []),
		has: (name) => name === 'auth_token' && Boolean(token),
		set: () => undefined,
		delete: () => undefined,
		size: () => (token ? 1 : 0),
	};
}

export async function headers() {
	const requestHeaders = new Headers();
	const token = process.env.OPS_AUTH_TOKEN;
	if (token) requestHeaders.set('authorization', `Bearer ${token}`);
	return requestHeaders;
}

export async function draftMode() {
	return {
		isEnabled: false,
		enable: async () => undefined,
		disable: async () => undefined,
	};
}
