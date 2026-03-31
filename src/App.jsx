import { useState, useEffect } from 'react'

const PAYMENT_STATUS = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
}

const DELIVERY_TYPE = {
  pickup: 'Retirada',
  delivery: 'Entrega',
}

const emptyForm = () => ({
  id: null,
  customer: { name: '', phone: '' },
  items: [{ product: '', quantity: 1, price: '' }],
  payment: { total: '', deposit: '', status: 'pending' },
  delivery: { type: 'pickup', date: '', notes: '' },
})

export default function App() {
  const [orders, setOrders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pascoa-orders')) || []
    } catch {
      return []
    }
  })
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    localStorage.setItem('pascoa-orders', JSON.stringify(orders))
  }, [orders])

  const handleSave = (order) => {
    if (order.id) {
      setOrders(orders.map((o) => (o.id === order.id ? order : o)))
    } else {
      setOrders([...orders, { ...order, id: Date.now() }])
    }
    setShowForm(false)
    setEditingOrder(null)
  }

  const handleEdit = (order) => {
    setEditingOrder(order)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este pedido?')) {
      setOrders(orders.filter((o) => o.id !== id))
    }
  }

  const openNew = () => {
    setEditingOrder(null)
    setShowForm(true)
  }

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer.phone.includes(search)
    const matchStatus = filterStatus === 'all' || o.payment.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.payment.total) || 0), 0)
  const totalReceived = orders.reduce((s, o) => {
    if (o.payment.status === 'paid') return s + (parseFloat(o.payment.total) || 0)
    return s + (parseFloat(o.payment.deposit) || 0)
  }, 0)
  const pendingCount = orders.filter((o) => o.payment.status !== 'paid').length

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <span className="header-icon">🐣</span>
          <h1>Pedidos de Páscoa</h1>
        </div>
        <button className="btn-primary" onClick={openNew}>
          + Novo Pedido
        </button>
      </header>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-value">{orders.length}</div>
          <div className="summary-label">Total de Pedidos</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">R$ {totalRevenue.toFixed(2)}</div>
          <div className="summary-label">Receita Total</div>
        </div>
        <div className="summary-card green">
          <div className="summary-value">R$ {totalReceived.toFixed(2)}</div>
          <div className="summary-label">Recebido</div>
        </div>
        <div className="summary-card orange">
          <div className="summary-value">{pendingCount}</div>
          <div className="summary-label">Pagamentos Pendentes</div>
        </div>
      </div>

      <div className="filters">
        <input
          className="search-input"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-pills">
          {['all', 'pending', 'partial', 'paid'].map((s) => (
            <button
              key={s}
              className={`pill ${filterStatus === s ? 'active' : ''} ${s}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? 'Todos' : PAYMENT_STATUS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="orders-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {orders.length === 0
              ? 'Nenhum pedido cadastrado ainda. Clique em "+ Novo Pedido" para começar!'
              : 'Nenhum pedido encontrado para essa busca.'}
          </div>
        ) : (
          filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onEdit={() => handleEdit(order)}
              onDelete={() => handleDelete(order.id)}
            />
          ))
        )}
      </div>

      {showForm && (
        <OrderForm
          order={editingOrder}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false)
            setEditingOrder(null)
          }}
        />
      )}
    </div>
  )
}

function OrderCard({ order, onEdit, onDelete }) {
  const itemsTotal = order.items.reduce(
    (s, i) => s + (i.quantity || 1) * (parseFloat(i.price) || 0),
    0
  )
  const total = parseFloat(order.payment.total) || itemsTotal
  const remaining =
    order.payment.status !== 'paid' ? total - (parseFloat(order.payment.deposit) || 0) : 0

  const phoneNumber = order.customer.phone.replace(/\D/g, '')

  return (
    <div className={`order-card status-${order.payment.status}`}>
      <div className="card-header">
        <div className="card-customer">
          <h3 className="customer-name">{order.customer.name || 'Cliente sem nome'}</h3>
          {order.customer.phone && (
            <a
              href={`https://wa.me/55${phoneNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="customer-phone"
            >
              📱 {order.customer.phone}
            </a>
          )}
        </div>
        <span className={`status-badge ${order.payment.status}`}>
          {PAYMENT_STATUS[order.payment.status]}
        </span>
      </div>

      <div className="card-items">
        {order.items.map((item, i) => (
          <div key={i} className="item-line">
            <span className="item-name">{item.product || '—'}</span>
            <span className="item-price">
              {item.quantity}x R$ {parseFloat(item.price || 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="card-footer">
        <div className="payment-row">
          <span>
            Total: <strong>R$ {total.toFixed(2)}</strong>
          </span>
          {order.payment.deposit && parseFloat(order.payment.deposit) > 0 && (
            <span className="deposit">
              Sinal: R$ {parseFloat(order.payment.deposit).toFixed(2)}
            </span>
          )}
          {remaining > 0 && (
            <span className="remaining">Restante: R$ {remaining.toFixed(2)}</span>
          )}
        </div>

        <div className="delivery-row">
          <span className="delivery-type">{DELIVERY_TYPE[order.delivery.type]}</span>
          {order.delivery.date && (
            <span>
              {new Date(order.delivery.date + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          )}
          {order.delivery.notes && <span className="delivery-notes">{order.delivery.notes}</span>}
        </div>

        <div className="card-actions">
          <button className="btn-edit" onClick={onEdit}>
            Editar
          </button>
          <button className="btn-delete" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

function OrderForm({ order, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    order
      ? { ...order, items: order.items.map((i) => ({ ...i })) }
      : emptyForm()
  )

  const itemsTotal = form.items.reduce(
    (s, i) => s + (parseInt(i.quantity) || 1) * (parseFloat(i.price) || 0),
    0
  )

  const setCustomer = (field, value) =>
    setForm((f) => ({ ...f, customer: { ...f.customer, [field]: value } }))

  const setPayment = (field, value) =>
    setForm((f) => ({ ...f, payment: { ...f.payment, [field]: value } }))

  const setDelivery = (field, value) =>
    setForm((f) => ({ ...f, delivery: { ...f.delivery, [field]: value } }))

  const setItem = (index, field, value) =>
    setForm((f) => {
      const items = [...f.items]
      items[index] = { ...items[index], [field]: value }
      return { ...f, items }
    })

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { product: '', quantity: 1, price: '' }] }))

  const removeItem = (i) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const total = form.payment.total || itemsTotal.toFixed(2)
    onSave({ ...form, payment: { ...form.payment, total } })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{form.id ? 'Editar Pedido' : 'Novo Pedido'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="order-form">
          <section className="form-section">
            <h3>👤 Cliente</h3>
            <div className="form-row">
              <label>
                Nome *
                <input
                  required
                  value={form.customer.name}
                  onChange={(e) => setCustomer('name', e.target.value)}
                  placeholder="Nome do cliente"
                />
              </label>
              <label>
                Telefone / WhatsApp
                <input
                  value={form.customer.phone}
                  onChange={(e) => setCustomer('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h3>🛒 Itens do Pedido</h3>
            {form.items.map((item, i) => (
              <div key={i} className="item-form-row">
                <input
                  className="input-product"
                  placeholder="Produto (ex: Ovo Leite Ninho 500g)"
                  value={item.product}
                  onChange={(e) => setItem(i, 'product', e.target.value)}
                />
                <input
                  className="input-qty"
                  type="number"
                  min="1"
                  placeholder="Qtd"
                  value={item.quantity}
                  onChange={(e) => setItem(i, 'quantity', e.target.value)}
                />
                <input
                  className="input-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Preço unit."
                  value={item.price}
                  onChange={(e) => setItem(i, 'price', e.target.value)}
                />
                {form.items.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-item"
                    onClick={() => removeItem(i)}
                    aria-label="Remover item"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className="items-actions">
              <button type="button" className="btn-add-item" onClick={addItem}>
                + Adicionar item
              </button>
              <span className="subtotal">Subtotal: R$ {itemsTotal.toFixed(2)}</span>
            </div>
          </section>

          <section className="form-section">
            <h3>💰 Pagamento</h3>
            <div className="form-row">
              <label>
                Valor Total (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`${itemsTotal.toFixed(2)} (calculado)`}
                  value={form.payment.total}
                  onChange={(e) => setPayment('total', e.target.value)}
                />
              </label>
              <label>
                Sinal Pago (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.payment.deposit}
                  onChange={(e) => setPayment('deposit', e.target.value)}
                />
              </label>
              <label>
                Status
                <select
                  value={form.payment.status}
                  onChange={(e) => setPayment('status', e.target.value)}
                >
                  <option value="pending">Pendente</option>
                  <option value="partial">Parcial</option>
                  <option value="paid">Pago</option>
                </select>
              </label>
            </div>
          </section>

          <section className="form-section">
            <h3>🚚 Entrega / Retirada</h3>
            <div className="form-row">
              <label>
                Tipo
                <select
                  value={form.delivery.type}
                  onChange={(e) => setDelivery('type', e.target.value)}
                >
                  <option value="pickup">Retirada</option>
                  <option value="delivery">Entrega</option>
                </select>
              </label>
              <label>
                Data
                <input
                  type="date"
                  value={form.delivery.date}
                  onChange={(e) => setDelivery('date', e.target.value)}
                />
              </label>
            </div>
            <label>
              {form.delivery.type === 'delivery' ? 'Endereço de Entrega' : 'Observações'}
              <input
                value={form.delivery.notes}
                onChange={(e) => setDelivery('notes', e.target.value)}
                placeholder={
                  form.delivery.type === 'delivery'
                    ? 'Rua, número, bairro...'
                    : 'Observações adicionais...'
                }
              />
            </label>
          </section>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar Pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
