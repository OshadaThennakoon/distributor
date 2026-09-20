import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'distributor.db');
const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');

// Ensure data folder exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? null : null });

// Optimization settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Initialize schema
export function initDatabase() {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

// Helper query wrappers for clean code
export const query = {
  all: (sql, params = []) => db.prepare(sql).all(params),
  get: (sql, params = []) => db.prepare(sql).get(params),
  run: (sql, params = []) => db.prepare(sql).run(params),
  transaction: (fn) => db.transaction(fn)
};

export default db;
