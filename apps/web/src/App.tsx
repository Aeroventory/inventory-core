import { useState, useEffect } from 'react'

interface HealthStatus {
  status: string
  database: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => setError('Failed to connect to API'))
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Inventory Core</h1>
      <h2>API Health Status</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {health && (
        <ul>
          <li>Status: {health.status}</li>
          <li>Database: {health.database}</li>
        </ul>
      )}
      {!health && !error && <p>Loading...</p>}
    </div>
  )
}

export default App
