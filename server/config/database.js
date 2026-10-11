import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mysqlDb, initMySQLBridge } from './mysqlBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Bridge
initMySQLBridge();

export const db = mysqlDb;

const schemaPath = path.join(__dirname, '..', 'data', 'schema.mysql.sql');

// Initialize schema on MySQL
export async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'distributer_db';

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.changeUser({ database });

    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(sql);
    }
  } catch (err) {
    console.error('MySQL schema initialization error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

// Check database connection and print clean console logs
export async function checkDatabaseConnection() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'distributer_db';

  console.log(`\n==================================================`);
  console.log(`🔍 [DATABASE STATUS] Checking MySQL Connection...`);
  console.log(`==================================================`);

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database
    });

    const [rows] = await connection.query('SELECT DATABASE() as current_db, VERSION() as version');
    const [tables] = await connection.query('SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ?', [database]);

    console.log(`✅ [MySQL Engine] Status: ONLINE & READY`);
    console.log(`   🌐 Server: ${host}:${port} (v${rows[0].version})`);
    console.log(`   🗄️ Database: \`${rows[0].current_db}\``);
    console.log(`   📊 Active Tables: ${tables[0].cnt} synchronized`);
    console.log(`   🚫 SQLite: REMOVED (Project is 100% MySQL)`);
    console.log(`==================================================\n`);

    await connection.end();
    return true;
  } catch (err) {
    console.error(`❌ [MySQL Engine] Connection FAILED to \`${database}\` at ${host}:${port}`);
    console.error(`   Error: ${err.message}`);
    console.log(`==================================================\n`);
    return false;
  }
}

export const query = {
  all: (sql, params = []) => db.prepare(sql).all(params),
  get: (sql, params = []) => db.prepare(sql).get(params),
  run: (sql, params = []) => db.prepare(sql).run(params),
  transaction: (fn) => db.transaction(fn)
};

export default db;
