import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'distributer_db';

console.log('--- INITIALIZING MYSQL DATABASE ---');
console.log(`Host: ${host}:${port}`);
console.log(`User: ${user}`);
console.log(`Target Database: ${database}`);

async function initMysql() {
  let connection;
  try {
    // 1. Connect to MySQL Server (without database selected yet)
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    console.log('✅ Connected to MySQL server successfully.');

    // 2. Create Database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database \`${database}\` verified/created.`);

    // 3. Switch to target database
    await connection.changeUser({ database });
    console.log(`✅ Switched to database \`${database}\`.`);

    // Drop existing tables to ensure clean schema rebuild
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    const [existingTables] = await connection.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = ?`, [database]);
    for (const row of existingTables) {
      const name = row.TABLE_NAME || row.table_name;
      await connection.query(`DROP TABLE IF EXISTS \`${name}\``);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`🗑️  Cleaned existing tables in \`${database}\`.`);

    // 4. Read schema.mysql.sql and execute
    const schemaPath = path.join(__dirname, '..', 'data', 'schema.mysql.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⏳ Creating tables from schema.mysql.sql...');
    await connection.query(schemaSql);
    console.log('✅ All 26 tables and indexes created successfully in MySQL!');

    // 5. Migrate Data from SQLite to MySQL
    const sqlitePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'distributor.db');
    if (fs.existsSync(sqlitePath)) {
      console.log(`⏳ Migrating existing data from SQLite (${sqlitePath}) to MySQL...`);
      const sqliteDb = new Database(sqlitePath);

      // Disable foreign keys during migration to avoid insertion order locks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      const tables = [
        'distributors', 'distribution_centers', 'territories', 'towns',
        'drivers', 'vehicles', 'routes', 'shops', 'route_stops', 'shop_visits',
        'product_categories', 'products', 'fuel_prices', 'fuel_transactions',
        'odometer_readings', 'sales', 'sale_items', 'payments', 'expense_categories',
        'expenses', 'maintenance', 'route_runs', 'users', 'audit_logs',
        'system_settings', 'targets'
      ];

      for (const tbl of tables) {
        try {
          const rows = sqliteDb.prepare(`SELECT * FROM "${tbl}"`).all();
          if (rows.length === 0) continue;

          // Clear table first
          await connection.query(`TRUNCATE TABLE \`${tbl}\``);

          // Insert rows
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          const colList = columns.map(c => `\`${c}\``).join(', ');
          const sql = `INSERT INTO \`${tbl}\` (${colList}) VALUES (${placeholders})`;

          for (const row of rows) {
            const values = columns.map(col => {
              const val = row[col];
              // Handle JSON or boolean
              if (val === undefined) return null;
              return val;
            });
            await connection.execute(sql, values);
          }

          console.log(`  ✓ Table \`${tbl}\`: ${rows.length} rows migrated`);
        } catch (tblErr) {
          console.warn(`  ⚠️ Could not migrate table \`${tbl}\`: ${tblErr.message}`);
        }
      }

      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      sqliteDb.close();
      console.log('🎉 Data migration from SQLite to MySQL completed successfully!');
    }

    // 6. Verify table counts in MySQL
    const [tableRows] = await connection.query(`
      SELECT table_name, table_rows 
      FROM information_schema.tables 
      WHERE table_schema = ?
    `, [database]);

    console.log(`\n📋 MySQL Database Summary (${tableRows.length} tables in \`${database}\`):`);
    for (const t of tableRows) {
      const [countResult] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${t.TABLE_NAME || t.table_name}\``);
      console.log(`  - ${t.TABLE_NAME || t.table_name}: ${countResult[0].cnt} records`);
    }

    await connection.end();
    console.log('\n🚀 All done! MySQL is ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to initialize MySQL:');
    console.error('Message:', err.sqlMessage || err.message);
    console.error('Code:', err.code);
    if (connection) await connection.end();
    process.exit(1);
  }
}

initMysql();
