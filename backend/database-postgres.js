const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required when using the PostgreSQL database',
  )
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      patient_number TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      date_of_birth TEXT,
      sex TEXT,
      phone TEXT,
      ward TEXT,
      bed TEXT,
      status TEXT NOT NULL DEFAULT 'Stable',
      admission_date TEXT,
      discharge_date TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id),
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

module.exports = {
  pool,
  initializeDatabase,
}
