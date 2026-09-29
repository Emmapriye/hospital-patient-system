import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://127.0.0.1:4000'

const statusClass = {
  Stable: 'stable',
  'Under Observation': 'observation',
  Serious: 'serious',
  Critical: 'critical',
  Discharged: 'discharged',
}

const emptyForm = {
  patientNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  sex: '',
  phone: '',
  ward: '',
  bed: '',
  admissionDate: '',
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '—'

  const birth = new Date(dateOfBirth)
  const today = new Date()

  let age = today.getFullYear() - birth.getFullYear()
  const monthDifference = today.getMonth() - birth.getMonth()

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birth.getDate())
  ) {
    age--
  }

  return age
}

function App() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  async function loadPatients() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/api/patients`)

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error('Invalid patient data received from API')
      }

      setPatients(data)
    } catch (err) {
      console.error(err)
      setError(
        'Unable to load patients. Make sure the Hospital Patient System API is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  function handleInputChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setSaving(true)
    setFormMessage('')

    try {
      const response = await fetch(`${API_URL}/api/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register patient')
      }

      setFormMessage(`Patient ${data.patient_number} registered successfully.`)
      setForm(emptyForm)

      await loadPatients()
    } catch (err) {
      console.error(err)
      setFormMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function openPatientDetails(patientId) {
    setDetailsLoading(true)
    setSelectedPatient(null)
    setAuditLogs([])

    try {
      const [patientResponse, auditResponse] = await Promise.all([
        fetch(`${API_URL}/api/patients/${patientId}`),
        fetch(`${API_URL}/api/patients/${patientId}/audit`),
      ])

      const patientData = await patientResponse.json()
      const auditData = await auditResponse.json()

      if (!patientResponse.ok) {
        throw new Error(patientData.error || 'Failed to load patient')
      }

      if (!auditResponse.ok) {
        throw new Error(auditData.error || 'Failed to load audit history')
      }

      setSelectedPatient(patientData)
      setAuditLogs(Array.isArray(auditData) ? auditData : [])
    } catch (err) {
      console.error(err)
      window.alert(err.message)
    } finally {
      setDetailsLoading(false)
    }
  }

  function closePatientDetails() {
    setSelectedPatient(null)
    setAuditLogs([])
  }

  async function handleStatusChange(patientId, newStatus) {
    try {
      const response = await fetch(`${API_URL}/api/patients/${patientId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update patient status')
      }

      await loadPatients()
    } catch (err) {
      console.error(err)
      window.alert(err.message)
    }
  }

  const filteredPatients = patients.filter((patient) => {
    const fullName = [
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(' ')

    const searchableText = [
      patient.patient_number,
      fullName,
      patient.ward,
      patient.bed,
      patient.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return searchableText.includes(search.toLowerCase())
  })

  const totalPatients = patients.length
  const admittedPatients = patients.filter(
    (patient) => patient.status !== 'Discharged'
  ).length
  const seriousPatients = patients.filter(
    (patient) => patient.status === 'Serious'
  ).length
  const criticalPatients = patients.filter(
    (patient) => patient.status === 'Critical'
  ).length

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">HOSPITAL MANAGEMENT</p>
          <h1>Hospital Patient System</h1>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setShowForm((current) => !current)
            setFormMessage('')
          }}
        >
          {showForm ? 'Close Form' : 'Register Patient'}
        </button>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">PATIENT OVERVIEW</p>
            <h2>Patient Status Dashboard</h2>
            <p className="hero-text">
              Monitor current patient records and their latest status.
            </p>
          </div>
        </section>

        {showForm && (
          <section className="form-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">NEW RECORD</p>
                <h2>Register Patient</h2>
              </div>
            </div>

            <form className="patient-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  Patient Number *
                  <input
                    name="patientNumber"
                    value={form.patientNumber}
                    onChange={handleInputChange}
                    placeholder="PT-000002"
                    required
                  />
                </label>

                <label>
                  First Name *
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Middle Name
                  <input
                    name="middleName"
                    value={form.middleName}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Last Name *
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Date of Birth
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={form.dateOfBirth}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Sex
                  <select
                    name="sex"
                    value={form.sex}
                    onChange={handleInputChange}
                  >
                    <option value="">Select</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label>
                  Phone
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleInputChange}
                    placeholder="08000000000"
                  />
                </label>

                <label>
                  Ward
                  <input
                    name="ward"
                    value={form.ward}
                    onChange={handleInputChange}
                    placeholder="Ward A"
                  />
                </label>

                <label>
                  Bed
                  <input
                    name="bed"
                    value={form.bed}
                    onChange={handleInputChange}
                    placeholder="A-12"
                  />
                </label>

                <label>
                  Admission Date
                  <input
                    type="date"
                    name="admissionDate"
                    value={form.admissionDate}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              {formMessage && (
                <div className="message-card">
                  {formMessage}
                </div>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Registering...' : 'Register Patient'}
              </button>
            </form>
          </section>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Patients</span>
            <strong>{totalPatients}</strong>
          </div>

          <div className="stat-card">
            <span>Admitted</span>
            <strong>{admittedPatients}</strong>
          </div>

          <div className="stat-card">
            <span>Serious</span>
            <strong>{seriousPatients}</strong>
          </div>

          <div className="stat-card">
            <span>Critical</span>
            <strong>{criticalPatients}</strong>
          </div>
        </section>

        {selectedPatient && (
          <section className="patient-details-panel">
            <div className="details-header">
              <div>
                <span className="patient-number">
                  {selectedPatient.patient_number}
                </span>
                <h2>
                  {[
                    selectedPatient.first_name,
                    selectedPatient.middle_name,
                    selectedPatient.last_name,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </h2>
              </div>

              <button
                type="button"
                className="details-close-button"
                onClick={closePatientDetails}
              >
                Close
              </button>
            </div>

            {detailsLoading ? (
              <p>Loading patient details...</p>
            ) : (
              <>
                <div className="details-status">
                  <span
                    className={`status ${
                      statusClass[selectedPatient.status] || ''
                    }`}
                  >
                    {selectedPatient.status}
                  </span>
                </div>

                <div className="details-grid">
                  <div>
                    <strong>Date of Birth</strong>
                    <span>{selectedPatient.date_of_birth || '—'}</span>
                  </div>

                  <div>
                    <strong>Age</strong>
                    <span>
                      {calculateAge(selectedPatient.date_of_birth)} years
                    </span>
                  </div>

                  <div>
                    <strong>Sex</strong>
                    <span>{selectedPatient.sex || '—'}</span>
                  </div>

                  <div>
                    <strong>Phone</strong>
                    <span>{selectedPatient.phone || '—'}</span>
                  </div>

                  <div>
                    <strong>Ward</strong>
                    <span>{selectedPatient.ward || '—'}</span>
                  </div>

                  <div>
                    <strong>Bed</strong>
                    <span>{selectedPatient.bed || '—'}</span>
                  </div>

                  <div>
                    <strong>Admission Date</strong>
                    <span>{selectedPatient.admission_date || '—'}</span>
                  </div>

                  <div>
                    <strong>Discharge Date</strong>
                    <span>{selectedPatient.discharge_date || '—'}</span>
                  </div>
                </div>

                <div className="audit-section">
                  <h3>Audit History</h3>

                  {auditLogs.length === 0 ? (
                    <p>No audit history found.</p>
                  ) : (
                    <div className="audit-list">
                      {auditLogs.map((log) => {
                        let details = {}

                        try {
                          details = JSON.parse(log.details || '{}')
                        } catch {
                          details = {}
                        }

                        return (
                          <div className="audit-item" key={log.id}>
                            <strong>{log.action}</strong>

                            <span>
                              {log.action === 'STATUS_CHANGED'
                                ? `${details.previousStatus || '—'} → ${
                                    details.newStatus || '—'
                                  }`
                                : details.patientNumber
                                  ? `Patient ${details.patientNumber} created`
                                  : 'Patient record created'}
                            </span>

                            <small>{log.created_at}</small>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        <section className="patients-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LIVE DATA</p>
              <h2>Recent Patients</h2>
            </div>

            <button
              className="secondary-button"
              onClick={loadPatients}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="search-box">
            <input
              type="search"
              placeholder="Search patient number, name, ward, bed or status..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading && (
            <div className="message-card">
              Loading patient records...
            </div>
          )}

          {!loading && error && (
            <div className="message-card error-message">
              <strong>Connection Error</strong>
              <p>{error}</p>

              <button
                className="secondary-button"
                onClick={loadPatients}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && filteredPatients.length === 0 && (
            <div className="message-card">
              {search
                ? 'No patients match your search.'
                : 'No patient records found.'}
            </div>
          )}

          {!loading && !error && filteredPatients.length > 0 && (
            <div className="patients-list">
              {filteredPatients.map((patient) => {
                const fullName = [
                  patient.first_name,
                  patient.middle_name,
                  patient.last_name,
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <article className="patient-card" key={patient.id}>
                    <div className="patient-main">
                      <div>
                        <span className="patient-number">
                          {patient.patient_number}
                        </span>

                        <h3>{fullName}</h3>

                        <p className="patient-meta">
                          {calculateAge(patient.date_of_birth)} years old
                          {' · '}
                          {patient.ward || 'No ward'}
                          {' · '}
                          Bed {patient.bed || '—'}
                        </p>
                      </div>

                      <div className="status-control">
                        <span
                          className={`status ${statusClass[patient.status] || ''}`}
                        >
                          {patient.status}
                        </span>

                        <select
                          value={patient.status}
                          onChange={(event) =>
                            handleStatusChange(patient.id, event.target.value)
                          }
                          aria-label={`Change status for ${fullName}`}
                        >
                          {[
                            'Stable',
                            'Under Observation',
                            'Serious',
                            'Critical',
                            'Discharged',
                          ].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="patient-footer">
                      <span>
                        Admission: {patient.admission_date || '—'}
                      </span>

                      <span>
                        Updated: {patient.updated_at || '—'}
                      </span>

                      <button
                        type="button"
                        className="details-button"
                        onClick={() => openPatientDetails(patient.id)}
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
