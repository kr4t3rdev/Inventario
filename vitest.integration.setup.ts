import { assertDisposableDatabase } from './scripts/ci/disposable-database.mjs';

// Validate again inside each worker, without reading files or logging credentials.
assertDisposableDatabase(process.env);
