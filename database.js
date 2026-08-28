import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_TYPE = process.env.DATABASE_TYPE || 'none';
const DB_PATH = process.env.DATABASE_PATH || './data/app.db';
const DB_URL = process.env.DATABASE_URL || '';

let db = null;
let pool = null;
let useDatabase = false;

async function initDatabase() {
  // 1. Vercel Environment Check (Vercel-এ SQLite ব্লক রাখার জন্য)
  if (process.env.VERCEL && DB_TYPE === 'sqlite') {
    console.log('Database: SQLite is disabled on Vercel environment. Falling back to in-memory.');
    return;
  }

  if (DB_TYPE === 'none') {
    console.log('Database: using in-memory storage');
    return;
  }

  try {
    if (DB_TYPE === 'sqlite') {
      // Dynamic import with try-catch to prevent build crash
      const { default: Database } = await import('better-sqlite3');
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      db = new Database(DB_PATH);
      console.log(`Database: SQLite initialized at ${DB_PATH}`);
    } else if (DB_TYPE === 'mysql') {
      if (process.env.VERCEL) {
        console.log('Database: MySQL is not supported on Vercel. Falling back to in-memory.');
        return;
      }
      pool = mysql.createPool(DB_URL);
      console.log(`Database: MySQL pool initialized for ${DB_URL}`);
    } else {
      console.log(`Database: ${DB_TYPE} not supported yet. Falling back to in-memory.`);
      return;
    }

    useDatabase = true;
    await createTables();
    console.log('Database: tables initialized');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    db = null;
    pool = null;
    useDatabase = false;
  }
}

function isDbEnabled() {
  return useDatabase;
}

export function getDb() {
  return db;
}

export function isDatabaseEnabled() {
  return isDbEnabled();
}

async function createTables() {
  if (!db && !pool) return;

  const isMySQL = pool !== null;

  const usersSql = `
    CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(255) PRIMARY KEY,
      password TEXT NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user'
    )
  `;

  const userApiKeysSql = `
    CREATE TABLE IF NOT EXISTS user_api_keys (
      username VARCHAR(255) PRIMARY KEY,
      api_key TEXT NOT NULL,
      provider VARCHAR(100) NOT NULL DEFAULT 'claude',
      model VARCHAR(255) NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
      updated_at DATETIME NOT NULL,
      updated_by VARCHAR(255) NULL,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    )${isMySQL ? ' ENGINE=InnoDB' : ''}
  `;

  const customSql = `
    CREATE TABLE IF NOT EXISTS custom_provider_config (
      id INT PRIMARY KEY DEFAULT 1,
      endpoint TEXT NOT NULL,
      headers TEXT NOT NULL,
      updated_at DATETIME NULL,
      updated_by VARCHAR(255) NULL
    )
  `;

  const apiConfigSql = `
    CREATE TABLE IF NOT EXISTS api_config (
      id INT PRIMARY KEY DEFAULT 1,
      provider VARCHAR(100) NOT NULL DEFAULT 'claude',
      api_key TEXT NOT NULL,
      model VARCHAR(255) NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
      updated_at DATETIME NOT NULL,
      updated_by VARCHAR(255) NULL
    )
  `;

  const activitySql = `
    CREATE TABLE IF NOT EXISTS activity_log (
      id VARCHAR(255) PRIMARY KEY,
      timestamp DATETIME NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      has_image TINYINT(1) NOT NULL DEFAULT 0,
      image TEXT NULL
    )
  `;

  const conversationsSql = `
    CREATE TABLE IF NOT EXISTS conversations (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(500) NOT NULL DEFAULT 'New Chat',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      username VARCHAR(255) NOT NULL
    )
  `;

  const engineClause = isMySQL ? ' ENGINE=InnoDB' : '';
  const messagesSql = `
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(255) PRIMARY KEY,
      conversation_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      image TEXT NULL,
      timestamp DATETIME NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )${engineClause}
  `;

  const appSettingsSql = `
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT PRIMARY KEY DEFAULT 1,
      assistant_name VARCHAR(255) NOT NULL DEFAULT 'Nazmi AI',
      updated_at DATETIME NULL,
      updated_by VARCHAR(255) NULL
    )
  `;

  const librarySql = `
    CREATE TABLE IF NOT EXISTS library_images (
      id VARCHAR(255) PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      image TEXT NOT NULL,
      caption TEXT NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'upload',
      created_at DATETIME NOT NULL,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    )${engineClause}
  `;

  if (db) {
    db.exec(usersSql);
    db.exec(userApiKeysSql);
    db.exec(apiConfigSql);
    db.exec(customSql);
    db.exec(activitySql);
    db.exec(conversationsSql);
    db.exec(messagesSql);
    db.exec(appSettingsSql);
    db.exec(librarySql);
  } else if (pool) {
    await pool.query(usersSql);
    await pool.query(userApiKeysSql);
    await pool.query(apiConfigSql);
    await pool.query(customSql);
    await pool.query(activitySql);
    await pool.query(conversationsSql);
    await pool.query(messagesSql);
    await pool.query(appSettingsSql);
    await pool.query(librarySql);
  }
}

async function dbGet(sql, params) {
  if (db) {
    const stmt = db.prepare(sql);
    return stmt.get(...(params || []));
  } else if (pool) {
    const [rows] = await pool.query(sql, params || []);
    return rows[0] || null;
  }
  return null;
}

async function dbAll(sql, params) {
  if (db) {
    const stmt = db.prepare(sql);
    return stmt.all(...(params || []));
  } else if (pool) {
    const [rows] = await pool.query(sql, params || []);
    return rows;
  }
  return [];
}

async function dbRun(sql, params) {
  if (db) {
    const stmt = db.prepare(sql);
    return stmt.run(...(params || []));
  } else if (pool) {
    const [result] = await pool.query(sql, params || []);
    return result;
  }
  return null;
}

// ============ USERS ============

export async function getUser(username) {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT username, password, user_id as userId, role FROM users WHERE username = ?', [username]);
}

export async function getUserById(userId) {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT username, password, user_id as userId, role FROM users WHERE user_id = ?', [userId]);
}

export async function getAllUsers() {
  if (!isDbEnabled()) return [];
  return dbAll('SELECT username, password, role, user_id as userId FROM users');
}

export async function createUser(username, password, userId, role) {
  if (!isDbEnabled()) return null;
  return dbRun('INSERT INTO users (username, password, user_id, role) VALUES (?, ?, ?, ?)', [username, password, userId, role]);
}

export async function deleteUser(username) {
  if (!isDbEnabled()) return null;
  return dbRun('DELETE FROM users WHERE username = ?', [username]);
}

export async function updateUserPassword(username, newPassword) {
  if (!isDbEnabled()) return null;
  return dbRun('UPDATE users SET password = ? WHERE username = ?', [newPassword, username]);
}

// ============ USER API KEYS ============

export async function getUserApiKey(username) {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT api_key as apiKey, provider, model, updated_at as updatedAt, updated_by as updatedBy FROM user_api_keys WHERE username = ?', [username]);
}

export async function setUserApiKey(username, apiKey, provider, model, updatedBy) {
  if (!isDbEnabled()) return null;
  const now = new Date().toISOString();
  return dbRun(
    'INSERT INTO user_api_keys (username, api_key, provider, model, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), provider = VALUES(provider), model = VALUES(model), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)',
    [username, apiKey, provider, model, now, updatedBy]
  );
}

export async function deleteUserApiKey(username) {
  if (!isDbEnabled()) return null;
  return dbRun('DELETE FROM user_api_keys WHERE username = ?', [username]);
}

export async function getAllUserApiKeys() {
  if (!isDbEnabled()) return [];
  return dbAll('SELECT username, api_key as apiKey, provider, model, updated_at as updatedAt, updated_by as updatedBy FROM user_api_keys');
}

// ============ API CONFIG ============

export async function getApiConfig() {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT provider, api_key as apiKey, model, updated_at as updatedAt, updated_by as updatedBy FROM api_config WHERE id = 1');
}

export async function saveApiConfig(config) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO api_config (id, provider, api_key, model, updated_at, updated_by) VALUES (1, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE provider = VALUES(provider), api_key = VALUES(api_key), model = VALUES(model), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)',
    [config.provider, config.apiKey, config.model, config.updatedAt, config.updatedBy]
  );
}

export async function getCustomProviderConfig() {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT endpoint, headers, updated_at as updatedAt, updated_by as updatedBy FROM custom_provider_config WHERE id = 1');
}

export async function saveCustomProviderConfig(config) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO custom_provider_config (id, endpoint, headers, updated_at, updated_by) VALUES (1, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE endpoint = VALUES(endpoint), headers = VALUES(headers), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)',
    [config.endpoint, JSON.stringify(config.headers || {}), config.updatedAt, config.updatedBy]
  );
}

// ============ ACTIVITY LOG ============

export async function logActivity(entry) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO activity_log (id, timestamp, user_id, username, type, content, has_image, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [entry.id, entry.timestamp, entry.userId, entry.username, entry.type, entry.content, entry.hasImage ? 1 : 0, entry.image || null]
  );
}

export async function getActivity(username, limit) {
  if (!isDbEnabled()) return [];
  let query = 'SELECT * FROM activity_log';
  const params = [];
  if (username) {
    query += ' WHERE username = ?';
    params.push(username);
  }
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  const rows = await dbAll(query, params);
  return rows.reverse();
}

export async function clearOldActivity(maxEntries) {
  if (!isDbEnabled()) return null;
  const countRow = await dbGet('SELECT COUNT(*) as count FROM activity_log');
  const count = countRow ? countRow.count : 0;
  if (count > maxEntries) {
    return dbRun('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY timestamp DESC LIMIT ?)', [maxEntries]);
  }
  return null;
}

// ============ CONVERSATIONS ============

export async function saveConversation(conv) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO conversations (id, title, created_at, updated_at, username) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = VALUES(updated_at), username = VALUES(username)',
    [conv.id, conv.title, conv.createdAt, conv.updatedAt, conv.username || '']
  );
}

export async function getConversations(username) {
  if (!isDbEnabled()) return [];
  return dbAll('SELECT id, title, created_at as createdAt, updated_at as updatedAt, username FROM conversations WHERE username = ? ORDER BY updated_at DESC', [username]);
}

export async function getConversation(id) {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT id, title, created_at as createdAt, updated_at as updatedAt, username FROM conversations WHERE id = ?', [id]);
}

export async function deleteConversation(id) {
  if (!isDbEnabled()) return null;
  return dbRun('DELETE FROM conversations WHERE id = ?', [id]);
}

export async function saveMessage(message) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO messages (id, conversation_id, role, content, image, timestamp) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content), image = VALUES(image), timestamp = VALUES(timestamp)',
    [message.id, message.conversationId, message.role, message.content, message.image || null, message.timestamp]
  );
}

export async function getMessages(conversationId) {
  if (!isDbEnabled()) return [];
  return dbAll('SELECT id, conversation_id as conversationId, role, content, image, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC', [conversationId]);
}

export async function deleteMessages(conversationId) {
  if (!isDbEnabled()) return null;
  return dbRun('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
}

// ============ APP SETTINGS (global app name, admin-managed) ============

export async function getAppSettings() {
  if (!isDbEnabled()) return null;
  return dbGet('SELECT assistant_name as assistantName, updated_at as updatedAt, updated_by as updatedBy FROM app_settings WHERE id = 1');
}

export async function saveAppSettings({ assistantName, updatedAt, updatedBy }) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO app_settings (id, assistant_name, updated_at, updated_by) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE assistant_name = VALUES(assistant_name), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)',
    [assistantName, updatedAt || new Date().toISOString(), updatedBy || null]
  );
}

// ============ USER IMAGE LIBRARY ============

export async function addLibraryImage(entry) {
  if (!isDbEnabled()) return null;
  return dbRun(
    'INSERT INTO library_images (id, username, image, caption, source, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [entry.id, entry.username, entry.image, entry.caption || null, entry.source || 'upload', entry.createdAt]
  );
}

export async function getLibraryImages(username) {
  if (!isDbEnabled()) return [];
  return dbAll(
    'SELECT id, username, image, caption, source, created_at as createdAt FROM library_images WHERE username = ? ORDER BY created_at DESC',
    [username]
  );
}

export async function deleteLibraryImage(id, username) {
  if (!isDbEnabled()) return null;
  return dbRun('DELETE FROM library_images WHERE id = ? AND username = ?', [id, username]);
}

// ============ INIT ============



// database.js ফাইলের একদম নিচে গিয়ে এটি আপডেট করুন:

export { initDatabase };

export default {
  initDatabase,
  isDatabaseEnabled,
  getDb,
  getUser,
  getUserById,
  getAllUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  getUserApiKey,
  setUserApiKey,
  deleteUserApiKey,
  getAllUserApiKeys,
  getApiConfig,
  saveApiConfig,
  getCustomProviderConfig,
  saveCustomProviderConfig,
  getAppSettings,
  saveAppSettings,
  logActivity,
  getActivity,
  clearOldActivity,
  saveConversation,
  getConversations,
  getConversation,
  deleteConversation,
  saveMessage,
  getMessages,
  deleteMessages,
};