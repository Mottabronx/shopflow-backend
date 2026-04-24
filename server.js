import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3001

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://shopflow-frontend-two.vercel.app/'
  ]
}))
app.use(express.json())

// ── Helpers ──────────────────────────────────────────────

function getProducts() {
  const filePath = join(__dirname, 'data', 'products.json')
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function getOrders() {
  const filePath = join(__dirname, 'data', 'orders.json')
  if (!existsSync(filePath)) return []
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function saveOrder(order) {
  const filePath = join(__dirname, 'data', 'orders.json')
  const orders = getOrders()
  orders.unshift(order) // más reciente primero
  writeFileSync(filePath, JSON.stringify(orders, null, 2), 'utf-8')
}

// ── Productos ─────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  let products = getProducts()
  const { category, minPrice, maxPrice, tag, sort } = req.query

  if (category) products = products.filter(p => p.category === category)
  if (minPrice)  products = products.filter(p => p.price >= Number(minPrice))
  if (maxPrice)  products = products.filter(p => p.price <= Number(maxPrice))
  if (tag)       products = products.filter(p => p.tags.includes(tag))

  if (sort === 'price-asc')  products.sort((a, b) => a.price - b.price)
  else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price)
  else if (sort === 'rating')     products.sort((a, b) => b.rating - a.rating)

  res.json({ products, total: products.length })
})

app.get('/api/products/:id', (req, res) => {
  const products = getProducts()
  const product = products.find(p => p.id === Number(req.params.id))
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 3)

  res.json({ product, related })
})

app.get('/api/categories', (req, res) => {
  const products = getProducts()
  const categories = [...new Set(products.map(p => p.category))]
  res.json({ categories })
})

// ── Pedidos ───────────────────────────────────────────────

// GET /api/orders — lista todos los pedidos guardados
app.get('/api/orders', (req, res) => {
  const orders = getOrders()
  res.json({ orders, total: orders.length })
})

// GET /api/orders/:id — un pedido por ID
app.get('/api/orders/:id', (req, res) => {
  const order = getOrders().find(o => o.orderId === req.params.id)
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
  res.json({ order })
})

// POST /api/checkout — procesa y guarda el pedido
app.post('/api/checkout', (req, res) => {
  const { items, customer, payment } = req.body

  if (!items || items.length === 0)
    return res.status(400).json({ error: 'El carrito está vacío' })
  if (!customer?.name || !customer?.email)
    return res.status(400).json({ error: 'Datos del cliente incompletos' })

  const orderId = `SF-${Date.now()}`
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const order = {
    orderId,
    total,
    status: 'completado',
    createdAt: new Date().toISOString(),
    customer,
    payment: { last4: payment?.last4 || '****' },
    items,
  }

  saveOrder(order)

  res.json({
    success: true,
    orderId,
    total,
    message: `Pedido ${orderId} procesado correctamente`,
  })
})

app.listen(PORT, () => {
  console.log(`ShopFlow API corriendo en http://localhost:${PORT}`)
})
