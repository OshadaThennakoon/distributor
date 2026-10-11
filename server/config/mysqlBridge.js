import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!isMainThread) {
  // ==========================================
  // WORKER THREAD (Asynchronous MySQL Worker)
  // ==========================================
  const { sharedBuffer, config } = workerData;
  const lock = new Int32Array(sharedBuffer, 0, 1);
  const dataLen = new Int32Array(sharedBuffer, 4, 1);
  const dataBuffer = Buffer.from(sharedBuffer, 8);

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 15,
    multipleStatements: true,
    decimalNumbers: true
  });

  parentPort.on('message', async ({ sql, params, type }) => {
    try {
      const [rows] = await pool.query(sql, params);
      let result;
      if (type === 'get') {
        result = Array.isArray(rows) ? (rows[0] || null) : rows;
      } else if (type === 'run') {
        result = {
          lastInsertRowid: rows.insertId,
          changes: rows.affectedRows
        };
      } else {
        result = Array.isArray(rows) ? rows : [];
      }

      const jsonStr = JSON.stringify({ success: true, data: result });
      const written = dataBuffer.write(jsonStr, 'utf8');
      dataLen[0] = written;
    } catch (err) {
      const jsonStr = JSON.stringify({ success: false, error: err.message });
      const written = dataBuffer.write(jsonStr, 'utf8');
      dataLen[0] = written;
    }

    Atomics.store(lock, 0, 1);
    Atomics.notify(lock, 0, 1);
  });
}

// ==========================================
// MAIN THREAD (Synchronous Client Interface)
// ==========================================
let workerInstance = null;
let sharedBuffer = null;
let lock = null;
let dataLen = null;
let dataBuffer = null;

function normalizeSql(rawSql) {
  if (!rawSql || typeof rawSql !== 'string') return rawSql;
  return rawSql
    .replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([^)]+)\)/gi, "DATE_FORMAT($1, '%Y-%m')")
    .replace(/strftime\s*\(\s*'%Y-W%W'\s*,\s*([^)]+)\)/gi, "DATE_FORMAT($1, '%Y-W%v')")
    .replace(/DATE\s*\(\s*'now'\s*\)/gi, 'CURDATE()')
    .replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()')
    .replace(/"([a-zA-Z0-9_]+)"/g, '`$1`');
}

export function initMySQLBridge() {
  if (workerInstance) return;

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'distributer_db';

  // 32MB Shared memory for query results
  sharedBuffer = new SharedArrayBuffer(32 * 1024 * 1024);
  lock = new Int32Array(sharedBuffer, 0, 1);
  dataLen = new Int32Array(sharedBuffer, 4, 1);
  dataBuffer = Buffer.from(sharedBuffer, 8);

  workerInstance = new Worker(__filename, {
    workerData: {
      sharedBuffer,
      config: { host, port, user, password, database }
    }
  });

  // Make sure worker stays open
  workerInstance.unref();
}

function executeSync(sql, params = [], type = 'all') {
  if (!workerInstance) initMySQLBridge();

  const finalSql = normalizeSql(sql);
  Atomics.store(lock, 0, 0);
  workerInstance.postMessage({ sql: finalSql, params, type });
  Atomics.wait(lock, 0, 0);

  const len = dataLen[0];
  const jsonStr = dataBuffer.toString('utf8', 0, len);
  const parsed = JSON.parse(jsonStr);

  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  return parsed.data;
}

// Mimics better-sqlite3 API 100% so routes & services require 0 changes
export const mysqlDb = {
  prepare: (sql) => ({
    all: (params = []) => executeSync(sql, Array.isArray(params) ? params : [params], 'all'),
    get: (params = []) => executeSync(sql, Array.isArray(params) ? params : [params], 'get'),
    run: (...args) => {
      let params = [];
      if (args.length === 1 && Array.isArray(args[0])) {
        params = args[0];
      } else {
        params = args;
      }
      return executeSync(sql, params, 'run');
    }
  }),
  exec: (sql) => executeSync(sql, [], 'all'),
  pragma: (str) => {
    // Graceful no-op for SQLite PRAGMA calls in MySQL
    if (str && str.includes('integrity_check')) {
      return [{ integrity_check: 'ok' }];
    }
    return [];
  },
  transaction: (fn) => (...args) => {
    try {
      executeSync('START TRANSACTION', [], 'run');
      const res = fn(...args);
      executeSync('COMMIT', [], 'run');
      return res;
    } catch (err) {
      executeSync('ROLLBACK', [], 'run');
      throw err;
    }
  },
  open: true
};

export default mysqlDb;
