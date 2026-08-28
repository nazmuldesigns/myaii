import mysql from 'mysql2/promise';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
console.log('URL:', url);

try {
  const pool = mysql.createPool(url);
  const [dbs] = await pool.query('SHOW DATABASES');
  console.log('Databases:', dbs.map(d => Object.values(d)[0]));

  const target = url.split('/').pop().split('?')[0];
  const [tables] = await pool.query('SHOW TABLES');
  console.log('Tables:', tables.map(t => Object.values(t)[0]));

  try {
    const [users] = await pool.query('SELECT username, password, user_id, role FROM users');
    console.log('USERS:', users);
  } catch (e) {
    console.log('users query error:', e.message);
  }
  await pool.end();
} catch (e) {
  console.log('CONNECT ERROR:', e.message);
}
