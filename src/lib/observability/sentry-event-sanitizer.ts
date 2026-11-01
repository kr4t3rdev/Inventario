type StackFrame = {
  filename?: unknown;
  function?: unknown;
  lineno?: unknown;
  colno?: unknown;
  in_app?: unknown;
};

type ExceptionValue = {
  type?: unknown;
  stacktrace?: { frames?: StackFrame[] };
  mechanism?: { type?: unknown; handled?: boolean };
};

type EventRecord = Record<string, unknown> & {
  exception?: { values?: ExceptionValue[] };
};

const SAFE_MECHANISM_TYPES = new Set([
  'onerror',
  'instrument',
  'generic',
  'auto.function',
  'auto.http.browser',
  'auto.http.node',
  'auto.db.prisma',
  'auto.db.sql',
  'auto.db.redis',
  'auto.browser.global_handlers',
  'auto.browser.history',
]);

/**
 * @description Removes free-form and request-derived data before an event leaves the process.
 * @param {T} event - Sentry event to minimize
 * @returns {T} Copy containing only safe event metadata and exception types
 */
export function sanitizeSentryEvent<T extends object>(event: T): T {
  const record = event as T & EventRecord;
  const values = record.exception?.values?.map((value) => {
    const frames = value.stacktrace?.frames?.map(sanitizeStackFrame);
    const exceptionType = safeIdentifier(value.type) ?? 'Error';
    const mechanismType = safeMechanismType(value.mechanism?.type);
    const mechanism = value.mechanism
      ? {
          ...(mechanismType ? { type: mechanismType } : {}),
          ...(typeof value.mechanism.handled === 'boolean'
            ? { handled: value.mechanism.handled }
            : {}),
        }
      : undefined;

    return {
      type: exceptionType,
      value: '[redacted]',
      ...(frames ? { stacktrace: { frames } } : {}),
      ...(mechanism ? { mechanism } : {}),
    };
  });

  return {
    event_id: record.event_id,
    timestamp: record.timestamp,
    platform: record.platform,
    level: record.level,
    release: record.release,
    environment: record.environment,
    sdk: record.sdk,
    message: 'Unhandled error',
    exception: values ? { values } : undefined,
  } as T;
}

/**
 * @description Removes endpoint names and span attributes while preserving timing and status.
 * @param {T} event - Sentry transaction event to minimize
 * @returns {T} Transaction copy without request, query, or span content
 */
export function sanitizeSentryTransaction<T extends object>(event: T): T {
  const record = event as T & Record<string, unknown>;
  const spans = Array.isArray(record.spans)
    ? record.spans.map((span: Record<string, unknown>) => ({
        start_timestamp: span.start_timestamp,
        timestamp: span.timestamp,
        status: span.status,
        op: span.op,
        name: 'span',
      }))
    : undefined;

  return {
    event_id: record.event_id,
    timestamp: record.timestamp,
    start_timestamp: record.start_timestamp,
    platform: record.platform,
    level: record.level,
    release: record.release,
    environment: record.environment,
    sdk: record.sdk,
    type: 'transaction',
    transaction: sanitizeRouteName(record.transaction),
    spans,
  } as T;
}

function sanitizeStackFrame(frame: StackFrame) {
  const filename = normalizeSourcePath(frame.filename);
  const functionName = normalizeFunctionName(frame.function);

  return {
    ...(filename ? { filename } : {}),
    ...(functionName ? { function: functionName } : {}),
    ...(typeof frame.lineno === 'number' ? { lineno: frame.lineno } : {}),
    ...(typeof frame.colno === 'number' ? { colno: frame.colno } : {}),
    ...(typeof frame.in_app === 'boolean' ? { in_app: frame.in_app } : {}),
  };
}

function normalizeSourcePath(filename: unknown): string | undefined {
  if (typeof filename !== 'string') return undefined;
  const normalized = filename.replaceAll('\\', '/').split(/[?#]/, 1)[0];
  const projectPath = normalized.match(/(?:^|\/)((?:src|app)\/[A-Za-z0-9_./[\]-]+)$/);
  if (projectPath) return projectPath[1];

  const packagePath = normalized.match(/(?:^|\/)(node_modules\/[A-Za-z0-9_./@-]+)$/);
  if (packagePath) return packagePath[1];

  const basename = normalized.split('/').at(-1);
  return basename && /^[A-Za-z0-9_.-]+$/.test(basename) ? basename : undefined;
}

function normalizeFunctionName(functionName: unknown): string | undefined {
  return safeIdentifier(functionName);
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(value) ? value : undefined;
}

function sanitizeRouteName(transaction: unknown): string {
  if (typeof transaction !== 'string') return 'other/route';
  const path = transaction.split(/[?#]/, 1)[0];
  if (!path.startsWith('/') || path.startsWith('//')) return 'other/route';

  const segments = path.split('/').filter(Boolean);
  if (segments.length > 8) return '/[route]';
  if (segments.length === 0) return '/';

  return `/${segments
    .map((segment) => (/^\[[A-Za-z][A-Za-z0-9_]*\]$/.test(segment) ? '[param]' : '[segment]'))
    .join('/')}`;
}

function safeMechanismType(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_MECHANISM_TYPES.has(value) ? value : undefined;
}

/**
 * @description Records a generic OTel failure without forwarding its message or stack.
 * @param {TSpan} span - Active OpenTelemetry span
 * @param {Error} error - Error whose type is safe to retain
 * @returns {void} No return value
 */
export function recordSafeOtelException<TSpan extends {
  recordException: (exception: { name: string }) => void;
  setStatus: (status: { code: number }) => void;
}>(span: TSpan, error: Error): void {
  span.recordException({ name: error.name });
  span.setStatus({ code: 2 });
}
