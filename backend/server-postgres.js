const express = require('express')
const cors = require('cors')
const { pool, initializeDatabase } = require('./database-postgres')

const app = express()
const PORT = process.env.PORT || 4000

const VALID_STATUSES = [
  'Stable',
  'Under Observation',
  'Serious',
  'Critical',
  'Discharged',
]

app.use(cors())
app.use(express.json({ limit: '100kb' }))

function clean(value) {
  if (value === undefined || value === null) {
    return null
  }

  const result = String(value).trim()
  return result || null
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')

    res.json({
      status: 'OK',
      service: 'Hospital Patient System API',
      database: 'PostgreSQL',
    })
  } catch (error) {
    console.error(error)

    res.status(503).json({
      status: 'ERROR',
      service: 'Hospital Patient System API',
      database: 'PostgreSQL',
    })
  }
})

app.get('/api/patients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        patient_number,
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        sex,
        phone,
        ward,
        bed,
        status,
        admission_date,
        discharge_date,
        created_at,
        updated_at
      FROM patients
      ORDER BY updated_at DESC, id DESC
    `)

    res.json(result.rows)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load patients',
    })
  }
})

app.get('/api/patients/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM patients
      WHERE id = $1
      `,
      [req.params.id],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Patient not found',
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load patient',
    })
  }
})

app.get('/api/patients/:id/audit', async (req, res) => {
  try {
    const patient = await pool.query(
      `
      SELECT id
      FROM patients
      WHERE id = $1
      `,
      [req.params.id],
    )

    if (patient.rowCount === 0) {
      return res.status(404).json({
        error: 'Patient not found',
      })
    }

    const result = await pool.query(
      `
      SELECT
        id,
        patient_id,
        action,
        details,
        created_at
      FROM audit_logs
      WHERE patient_id = $1
      ORDER BY id DESC
      `,
      [req.params.id],
    )

    res.json(result.rows)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Failed to load audit history',
    })
  }
})

app.post('/api/patients', async (req, res) => {
  const patientNumber = clean(req.body.patientNumber)
  const firstName = clean(req.body.firstName)
  const middleName = clean(req.body.middleName)
  const lastName = clean(req.body.lastName)
  const dateOfBirth = clean(req.body.dateOfBirth)
  const sex = clean(req.body.sex)
  const phone = clean(req.body.phone)
  const ward = clean(req.body.ward)
  const bed = clean(req.body.bed)
  const admissionDate = clean(req.body.admissionDate)

  if (!patientNumber || !firstName || !lastName) {
    return res.status(400).json({
      error: 'patientNumber, firstName and lastName are required',
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query(
      `
      INSERT INTO patients (
        patient_number,
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        sex,
        phone,
        ward,
        bed,
        status,
        admission_date
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, 'Stable', $10
      )
      RETURNING *
      `,
      [
        patientNumber,
        firstName,
        middleName,
        lastName,
        dateOfBirth,
        sex,
        phone,
        ward,
        bed,
        admissionDate,
      ],
    )

    const patient = result.rows[0]

    await client.query(
      `
      INSERT INTO audit_logs (
        patient_id,
        action,
        details
      )
      VALUES ($1, 'PATIENT_CREATED', $2)
      `,
      [
        patient.id,
        JSON.stringify({
          patientNumber,
        }),
      ],
    )

    await client.query('COMMIT')

    res.status(201).json(patient)
  } catch (error) {
    await client.query('ROLLBACK')

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Patient number already exists',
      })
    }

    console.error(error)

    res.status(500).json({
      error: 'Failed to create patient',
    })
  } finally {
    client.release()
  }
})

app.patch('/api/patients/:id/status', async (req, res) => {
  const status = clean(req.body.status)

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status',
      allowedStatuses: VALID_STATUSES,
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const patientResult = await client.query(
      `
      SELECT *
      FROM patients
      WHERE id = $1
      FOR UPDATE
      `,
      [req.params.id],
    )

    if (patientResult.rowCount === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        error: 'Patient not found',
      })
    }

    const patient = patientResult.rows[0]

    await client.query(
      `
      UPDATE patients
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [status, req.params.id],
    )

    await client.query(
      `
      INSERT INTO audit_logs (
        patient_id,
        action,
        details
      )
      VALUES ($1, 'STATUS_CHANGED', $2)
      `,
      [
        req.params.id,
        JSON.stringify({
          previousStatus: patient.status,
          newStatus: status,
        }),
      ],
    )

    const updatedResult = await client.query(
      `
      SELECT *
      FROM patients
      WHERE id = $1
      `,
      [req.params.id],
    )

    await client.query('COMMIT')

    res.json(updatedResult.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')

    console.error(error)

    res.status(500).json({
      error: 'Failed to update patient status',
    })
  } finally {
    client.release()
  }
})

async function startServer() {
  try {
    await initializeDatabase()

    app.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('=== HOSPITAL PATIENT SYSTEM API ===')
      console.log(`API: http://127.0.0.1:${PORT}`)
      console.log('Database: PostgreSQL')
      console.log('Status: ONLINE')
      console.log('')
    })
  } catch (error) {
    console.error('')
    console.error('=== STARTUP FAILED ===')
    console.error(error.message)
    process.exit(1)
  }
}

startServer()
