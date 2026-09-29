const express = require('express')
const cors = require('cors')
const db = require('./database')

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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Hospital Patient System API',
    database: 'connected',
  })
})

app.get('/api/patients', (req, res) => {
  const patients = db.prepare(`
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
    ORDER BY updated_at DESC
  `).all()

  res.json(patients)
})

app.get('/api/patients/:id', (req, res) => {
  const patient = db.prepare(`
    SELECT *
    FROM patients
    WHERE id = ?
  `).get(req.params.id)

  if (!patient) {
    return res.status(404).json({
      error: 'Patient not found',
    })
  }

  res.json(patient)
})

app.get('/api/patients/:id/audit', (req, res) => {
  const patient = db.prepare(`
    SELECT id
    FROM patients
    WHERE id = ?
  `).get(req.params.id)

  if (!patient) {
    return res.status(404).json({
      error: 'Patient not found',
    })
  }

  const auditLogs = db.prepare(`
    SELECT
      id,
      patient_id,
      action,
      details,
      created_at
    FROM audit_logs
    WHERE patient_id = ?
    ORDER BY id DESC
  `).all(req.params.id)

  res.json(auditLogs)
})

app.post('/api/patients', (req, res) => {
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

  try {
    const insert = db.prepare(`
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Stable', ?)
    `)

    const result = insert.run(
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
    )

    const patientId = result.lastInsertRowid

    db.prepare(`
      INSERT INTO audit_logs (patient_id, action, details)
      VALUES (?, 'PATIENT_CREATED', ?)
    `).run(
      patientId,
      JSON.stringify({
        patientNumber,
      }),
    )

    const patient = db.prepare(`
      SELECT *
      FROM patients
      WHERE id = ?
    `).get(patientId)

    res.status(201).json(patient)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'Patient number already exists',
      })
    }

    console.error(error)

    res.status(500).json({
      error: 'Failed to create patient',
    })
  }
})

app.patch('/api/patients/:id/status', (req, res) => {
  const status = clean(req.body.status)

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status',
      allowedStatuses: VALID_STATUSES,
    })
  }

  const patient = db.prepare(`
    SELECT *
    FROM patients
    WHERE id = ?
  `).get(req.params.id)

  if (!patient) {
    return res.status(404).json({
      error: 'Patient not found',
    })
  }

  db.prepare(`
    UPDATE patients
    SET status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, req.params.id)

  db.prepare(`
    INSERT INTO audit_logs (patient_id, action, details)
    VALUES (?, 'STATUS_CHANGED', ?)
  `).run(
    req.params.id,
    JSON.stringify({
      previousStatus: patient.status,
      newStatus: status,
    }),
  )

  const updatedPatient = db.prepare(`
    SELECT *
    FROM patients
    WHERE id = ?
  `).get(req.params.id)

  res.json(updatedPatient)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('=== HOSPITAL PATIENT SYSTEM API ===')
  console.log(`API: http://127.0.0.1:${PORT}`)
  console.log('Database: SQLite')
  console.log('Status: ONLINE')
  console.log('')
})
