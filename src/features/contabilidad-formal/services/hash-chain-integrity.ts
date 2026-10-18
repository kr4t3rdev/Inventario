/** Versioned, timestamp-independent validation shared by ledger readers and writers. */
export interface HashChainNode {
	asientoId: string;
	hash: string;
	hashAnterior: string | null;
	hashVersion: string | null;
	tenantSequence: bigint | null;
}

export interface HashChainValidation<T extends HashChainNode> {
	valid: boolean;
	ordered: T[];
	failureId: string | null;
}

/** Validates full topology, supported versions, exact contiguous sequences, and hashes. */
export function validateHashChain<T extends HashChainNode>(
	rows: T[],
	calculateHash: (row: T) => string,
): HashChainValidation<T> {
	if (rows.length === 0) return { valid: true, ordered: [], failureId: null };
	const hashes = new Set<string>();
	const byPrevious = new Map<string | null, T[]>();
	for (const row of rows) {
		if (!row.hash || hashes.has(row.hash)) return { valid: false, ordered: [], failureId: row.asientoId };
		hashes.add(row.hash);
		const children = byPrevious.get(row.hashAnterior) ?? [];
		children.push(row);
		byPrevious.set(row.hashAnterior, children);
	}
	const roots = byPrevious.get(null) ?? [];
	if (roots.length !== 1) return { valid: false, ordered: [], failureId: roots[1]?.asientoId ?? rows[0].asientoId };

	const ordered: T[] = [];
	const visited = new Set<string>();
	let current: T | undefined = roots[0];
	while (current) {
		if (visited.has(current.asientoId)) {
			return { valid: false, ordered, failureId: current.asientoId };
		}
		const version = current.hashVersion;
		if (!version || !['legacy-number-v1', 'legacy-decimal-v1', 'canonical-v2'].includes(version)) {
			return { valid: false, ordered, failureId: current.asientoId };
		}
		if (current.tenantSequence == null || BigInt(current.tenantSequence) !== BigInt(ordered.length + 1)) {
			return { valid: false, ordered, failureId: current.asientoId };
		}
		try {
			if (calculateHash(current) !== current.hash) return { valid: false, ordered, failureId: current.asientoId };
		} catch {
			return { valid: false, ordered, failureId: current.asientoId };
		}
		visited.add(current.asientoId);
		ordered.push(current);
		const children: T[] = byPrevious.get(current.hash) ?? [];
		if (children.length > 1) return { valid: false, ordered, failureId: children[1].asientoId };
		current = children[0];
	}
	if (ordered.length !== rows.length) {
		const row = rows.find((item) => !visited.has(item.asientoId));
		return { valid: false, ordered, failureId: row?.asientoId ?? null };
	}
	return { valid: true, ordered, failureId: null };
}
