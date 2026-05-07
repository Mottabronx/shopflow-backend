import express from 'express'
import cors from 'cors'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3001

// ── Supabase ──────────────────────────────────────────────
const supabase = createClient(
  'https://jyqswpqmmocwtoysixsa.supabase.co',   // reemplaza con tu Project URL
  'sb_publishable_FEzFrVb8jeMcHxeE09vwjg_sBda_jm4'    // reemplaza con tu anon public key
)

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://shopflow-frontend-two.vercel.app'
  ]
}))
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://shopflow-frontend-two.vercel.app'
  ]
}))
app.use(express.json())

// ── Helpers productos (siguen en JSON local) ──────────────
function getProducts() {
  const filePath = join(__dirname, 'data', 'products.json')
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

// ── Productos ─────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  let products = getProducts()
  const { category, minPrice, maxPrice, tag, sort } = req.query

  if (category) products = products.filter(p => p.category === category)
  if (minPrice)  products = products.filter(p => p.price >= Number(minPrice))
  if (maxPrice)  products = products.filter(p => p.price <= Number(maxPrice))
  if (tag)       products = products.filter(p => p.tags.includes(tag))

  if (sort === 'price-asc')       products.sort((a, b) => a.price - b.price)
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

// ── Pedidos con Supabase ──────────────────────────────────

// GET /api/orders — lista todos los pedidos
app.get('/api/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  // Normalizamos los campos para que el frontend los reciba igual que antes
  const orders = data.map(o => ({
    orderId: o.order_id,
    total: o.total,
    status: o.status,
    createdAt: o.created_at,
    customer: o.customer,
    payment: o.payment,
    items: o.items,
  }))

  res.json({ orders, total: orders.length })
})

// GET /api/orders/:id — un pedido por ID
app.get('/api/orders/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', req.params.id)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Pedido no encontrado' })

  res.json({
    order: {
      orderId: data.order_id,
      total: data.total,
      status: data.status,
      createdAt: data.created_at,
      customer: data.customer,
      payment: data.payment,
      items: data.items,
    }
  })
})

// POST /api/checkout — guarda el pedido en Supabase
app.post('/api/checkout', async (req, res) => {
  const { items, customer, payment } = req.body

  if (!items || items.length === 0)
    return res.status(400).json({ error: 'El carrito está vacío' })
  if (!customer?.name || !customer?.email)
    return res.status(400).json({ error: 'Datos del cliente incompletos' })

  const orderId = `SF-${Date.now()}`
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const { error } = await supabase.from('orders').insert({
    order_id: orderId,
    total,
    status: 'completado',
    customer,
    payment: { last4: payment?.last4 || '****' },
    items,
  })

  if (error) {
    console.log('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

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