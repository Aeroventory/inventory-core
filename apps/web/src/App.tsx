import { useState, useEffect } from 'react'
import { Product } from './models/Product'
import { getProducts, createProduct, deleteProduct } from './services/product-endpoints'
import api from './services/axios-config'

interface HealthStatus {
  status: string
  database: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<HealthStatus>('/health')
      .then((res) => setHealth(res.data))
      .catch(() => setError('Failed to connect to API'))

    fetchProducts()
  }, [])

  const fetchProducts = () => {
    getProducts()
      .then((res) => setProducts(res.data))
      .catch(() => setError('Failed to load products'))
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    createProduct({ name: newName.trim() })
      .then(() => {
        setNewName('')
        fetchProducts()
      })
      .catch(() => setError('Failed to create product'))
  }

  const handleDelete = (id: number) => {
    deleteProduct(id)
      .then(() => fetchProducts())
      .catch(() => setError('Failed to delete product'))
  }

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

      <hr />

      <h2>Products</h2>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Product name"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} style={{ marginLeft: '0.5rem' }}>
          Add
        </button>
      </div>

      {products.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              {p.name}
              <button
                onClick={() => handleDelete(p.id)}
                style={{ marginLeft: '0.5rem', color: 'red', cursor: 'pointer' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
