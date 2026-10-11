import { db, initDatabase } from '../config/database.js';
import { runSeeder } from './seeder.js';
import mysql from 'mysql2/promise';

console.log('🔄 Running MySQL Migrate Fresh: Recreating database and seeding...');

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'distributer_db';

try {
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  // Recreate clean database
  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`🗑️  Dropped and recreated clean MySQL database: \`${database}\``);
  await connection.end();

  // Create tables from schema.mysql.sql
  console.log('📐 Recreating all 26 tables from schema.mysql.sql...');
  await initDatabase();
  console.log('✅ MySQL schema recreated.');

  // Run seeder to populate all default data
  console.log('🌱 Populating fresh Jeewaka Herbals seed data into MySQL...');
  await runSeeder();

  console.log('✨ MySQL Migrate Fresh completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migrate fresh failed:', error);
  process.exit(1);
}
