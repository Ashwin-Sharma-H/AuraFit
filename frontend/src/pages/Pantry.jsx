import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, X, ChevronLeft, Package, Search, Pencil } from 'lucide-react'
import CustomSelect from '../components/CustomSelect.jsx'

// ── Category Definitions ──
const CATEGORIES = [
  { key: 'essentials', label: 'Essentials', emoji: '🧂', color: '#f59e0b', desc: 'Salt, oil, flour, basics' },
  { key: 'fruits', label: 'Fruits', emoji: '🍎', color: '#ef4444', desc: 'Fresh & dried fruits' },
  { key: 'vegetables', label: 'Vegetables', emoji: '🥬', color: '#22c55e', desc: 'Leafy greens, roots, more' },
  { key: 'meat_seafood', label: 'Meat & Seafood', emoji: '🥩', color: '#dc2626', desc: 'Chicken, fish, mutton' },
  { key: 'dairy', label: 'Dairy', emoji: '🧀', color: '#fbbf24', desc: 'Milk, cheese, yogurt' },
  { key: 'grains_cereals', label: 'Grains & Cereals', emoji: '🌾', color: '#d97706', desc: 'Rice, wheat, oats' },
  { key: 'spices_condiments', label: 'Spices & Condiments', emoji: '🌶️', color: '#b91c1c', desc: 'Herbs, sauces, seasonings' },
  { key: 'beverages', label: 'Beverages', emoji: '🥤', color: '#06b6d4', desc: 'Tea, coffee, juices' },
  { key: 'snacks', label: 'Snacks', emoji: '🍿', color: '#a855f7', desc: 'Chips, nuts, biscuits' },
  { key: 'other', label: 'Other', emoji: '📦', color: '#64748b', desc: 'Miscellaneous items' },
]

export default function Pantry({ token, onLogout }) {
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Navigation state
  const [currentView, setCurrentView] = useState('grid') // 'grid' | 'detail'
  const [selectedCategory, setSelectedCategory] = useState(null)

  // Add-item modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1.0)
  const [unit, setUnit] = useState('pcs')

  // Search state for detail view
  const [searchQuery, setSearchQuery] = useState('')

  // Essentials init tracking
  const [essentialsInitialized, setEssentialsInitialized] = useState(false)

  useEffect(() => {
    fetchAllItems()
  }, [token])

  const fetchAllItems = async () => {
    try {
      const res = await fetch('/api/pantry/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }
      const data = await res.json()
      setAllItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts = {}
    CATEGORIES.forEach(c => { counts[c.key] = 0 })
    allItems.forEach(item => {
      const cat = item.category || 'other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [allItems])

  // Available counts per category (for badge display)
  const availableCounts = useMemo(() => {
    const counts = {}
    CATEGORIES.forEach(c => { counts[c.key] = 0 })
    allItems.forEach(item => {
      if (item.available) {
        const cat = item.category || 'other'
        counts[cat] = (counts[cat] || 0) + 1
      }
    })
    return counts
  }, [allItems])

  // Items for selected category
  const categoryItems = useMemo(() => {
    if (!selectedCategory) return []
    let filtered = allItems.filter(item => (item.category || 'other') === selectedCategory)
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [allItems, selectedCategory, searchQuery])

  // ── Navigate to category ──
  const openCategory = async (categoryKey) => {
    setSelectedCategory(categoryKey)
    setCurrentView('detail')
    setSearchQuery('')

    // Auto-init essentials if needed
    if (categoryKey === 'essentials' && !essentialsInitialized) {
      const essentialsExist = allItems.some(item => item.category === 'essentials')
      if (!essentialsExist) {
        try {
          const res = await fetch('/api/pantry/init-essentials/', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${token}`,
              'Content-Type': 'application/json'
            }
          })
          if (res.ok) {
            const newItems = await res.json()
            setAllItems(prev => [...prev, ...newItems])
          }
        } catch (err) {
          console.error('Failed to init essentials:', err)
        }
      }
      setEssentialsInitialized(true)
    }
  }

  const goBackToGrid = () => {
    setCurrentView('grid')
    setSelectedCategory(null)
    setSearchQuery('')
  }

  // ── CRUD Operations ──
  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!name) return
    setError('')

    const url = editingItemId ? `/api/pantry/${editingItemId}/` : '/api/pantry/'
    const method = editingItemId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          quantity,
          unit,
          category: selectedCategory || 'other'
        })
      })

      if (res.ok) {
        const savedItem = await res.json()
        if (editingItemId) {
          setAllItems(prev => prev.map(i => i.id === editingItemId ? savedItem : i))
        } else {
          setAllItems(prev => [...prev, savedItem])
        }
        closeModal()
      } else {
        setError(`Failed to ${editingItemId ? 'update' : 'add'} pantry item.`)
      }
    } catch (err) {
      setError('Connection error. Please try again.')
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItemId(null)
    setName('')
    setQuantity(1.0)
    setUnit('pcs')
    setError('')
  }

  const handleEditClick = (item) => {
    setEditingItemId(item.id)
    setName(item.name)
    setQuantity(item.quantity)
    setUnit(item.unit)
    setIsModalOpen(true)
  }

  const handleDeleteItem = async (itemId) => {
    try {
      const res = await fetch(`/api/pantry/${itemId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.ok) {
        setAllItems(prev => prev.filter(item => item.id !== itemId))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleAvailable = async (item) => {
    const newAvailable = !item.available
    // Optimistic update
    setAllItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, available: newAvailable } : i)
    )
    try {
      const res = await fetch(`/api/pantry/${item.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ available: newAvailable })
      })
      if (!res.ok) {
        // Revert on failure
        setAllItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, available: !newAvailable } : i)
        )
      }
    } catch (err) {
      // Revert on error
      setAllItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, available: !newAvailable } : i)
      )
    }
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="pantry-loader">
          <Package size={32} className="loader-icon" />
          <p>Loading your pantry...</p>
        </div>
      </div>
    )
  }

  // ── Total available count ──
  const totalAvailable = allItems.filter(i => i.available).length

  // ═══════════ RENDER ═══════════
  return (
    <div className="pantry-page">

      {/* ═══════════ VIEW 1: CATEGORY GRID ═══════════ */}
      {currentView === 'grid' && (
        <div className="pantry-grid-view">
          <header className="pantry-main-header">
            <div>
              <h1>Virtual Pantry</h1>
              <p>Organize your ingredients by category. AuraFit's AI uses available items to build your meal plans.</p>
            </div>
            <div className="header-stats">
              <div className="stat-chip">
                <span className="stat-val">{allItems.length}</span>
                <span className="stat-lbl">Total Items</span>
              </div>
              <div className="stat-chip available-chip">
                <span className="stat-val">{totalAvailable}</span>
                <span className="stat-lbl">Available</span>
              </div>
            </div>
          </header>

          <div className="category-grid">
            {CATEGORIES.map(cat => (
              <div
                key={cat.key}
                className="category-card"
                onClick={() => openCategory(cat.key)}
                style={{ '--cat-color': cat.color }}
              >
                <div className="cat-card-icon">
                  <span>{cat.emoji}</span>
                </div>
                <div className="cat-card-info">
                  <h3>{cat.label}</h3>
                  <p>{cat.desc}</p>
                </div>
                <div className="cat-card-counts">
                  <span className="cat-total-badge">{categoryCounts[cat.key]} items</span>
                  {availableCounts[cat.key] > 0 && (
                    <span className="cat-avail-badge">{availableCounts[cat.key]} available</span>
                  )}
                </div>
                <div className="cat-card-arrow">›</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ VIEW 2: CATEGORY DETAIL ═══════════ */}
      {currentView === 'detail' && selectedCategory && (() => {
        const catDef = CATEGORIES.find(c => c.key === selectedCategory) || CATEGORIES[CATEGORIES.length - 1]
        return (
          <div className="pantry-detail-view">
            {/* Detail Header */}
            <header className="detail-top-bar" style={{ '--cat-color': catDef.color }}>
              <div className="detail-top-left">
                <button onClick={goBackToGrid} className="back-btn">
                  <ChevronLeft size={20} /> Categories
                </button>
                <div className="detail-title-block">
                  <span className="detail-emoji">{catDef.emoji}</span>
                  <div>
                    <h2>{catDef.label}</h2>
                    <p>{categoryItems.length} items · {categoryItems.filter(i => i.available).length} available</p>
                  </div>
                </div>
              </div>
              <div className="detail-top-right">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button onClick={() => { setEditingItemId(null); setName(''); setQuantity(1.0); setUnit('pcs'); setIsModalOpen(true); }} className="btn btn-primary add-item-btn">
                  <Plus size={16} /> Add Item
                </button>
              </div>
            </header>

            {/* Detail Body */}
            <div className="detail-body-scroll">
              {categoryItems.length === 0 ? (
                <div className="empty-category-state">
                  <div className="empty-cat-icon">{catDef.emoji}</div>
                  <h3>No {catDef.label} Yet</h3>
                  <p>Add your first {catDef.label.toLowerCase()} item to start tracking.</p>
                  <button onClick={() => { setEditingItemId(null); setName(''); setQuantity(1.0); setUnit('pcs'); setIsModalOpen(true); }} className="btn btn-primary" style={{ marginTop: '12px' }}>
                    <Plus size={16} /> Add {catDef.label}
                  </button>
                </div>
              ) : (
                <div className="items-grid">
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className={`item-card ${!item.available ? 'unavailable' : ''}`}
                      style={{ '--cat-color': catDef.color }}
                    >
                      <div className="item-card-top">
                        <div className="item-card-info">
                          <h4>{item.name}</h4>
                          <span className="item-qty">{item.quantity} {item.unit}</span>
                        </div>
                        <div className="item-card-actions">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="item-action-btn item-edit-btn"
                            title="Edit item"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="item-action-btn item-delete-btn"
                            title="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="item-card-bottom">
                        <label className="toggle-switch" title={item.available ? 'Mark as unavailable' : 'Mark as available'}>
                          <input
                            type="checkbox"
                            checked={item.available}
                            onChange={() => handleToggleAvailable(item)}
                          />
                          <span className="toggle-slider"></span>
                          <span className="toggle-label">{item.available ? 'Available' : 'Unavailable'}</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ═══════════ ADD ITEM MODAL ═══════════ */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItemId ? <Pencil size={20} /> : <Plus size={20} />} {editingItemId ? 'Edit' : 'Add'} {selectedCategory ? CATEGORIES.find(c => c.key === selectedCategory)?.label : ''} Item</h2>
              <button className="close-modal-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={handleSaveItem} className="pantry-form">
              <div className="form-group">
                <label htmlFor="itemName">Item Name</label>
                <input
                  id="itemName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apples, Chicken, Oats"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="itemQty">Quantity</label>
                  <div className="quantity-input-container">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQuantity(prev => {
                        const val = parseFloat(prev) || 0;
                        const res = val - 1;
                        return res > 0 ? parseFloat(res.toFixed(3)) : 0;
                      })}
                    >
                      -
                    </button>
                    <input
                      id="itemQty"
                      type="number"
                      step="any"
                      className="qty-input-field"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQuantity(prev => {
                        const val = parseFloat(prev) || 0;
                        return parseFloat((val + 1).toFixed(3));
                      })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="itemUnit">Unit</label>
                  <CustomSelect
                    id="itemUnit"
                    options={[
                      { value: 'pcs', label: 'pcs (pieces)' },
                      { value: 'g', label: 'g (grams)' },
                      { value: 'kg', label: 'kg (kilograms)' },
                      { value: 'ml', label: 'ml (milliliters)' },
                      { value: 'cups', label: 'cups' },
                      { value: 'cans', label: 'cans' },
                      { value: 'packets', label: 'packets' },
                      { value: 'bottles', label: 'bottles' },
                      { value: 'boxes', label: 'boxes' },
                      { value: 'tbsp', label: 'tbsp (tablespoons)' },
                      { value: 'tsp', label: 'tsp (teaspoons)' }
                    ]}
                    value={unit}
                    onChange={setUnit}
                  />
                </div>
              </div>

                <button type="submit" className="btn btn-primary submit-btn">
                  {editingItemId ? 'Save Changes' : 'Add to Pantry'}
                </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        /* ====== PANTRY PAGE ROOT ====== */
        .pantry-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 100px);
          overflow: hidden;
        }

        /* ====== GRID VIEW (Level 1) ====== */
        .pantry-grid-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .pantry-main-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 28px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          margin-bottom: 28px;
          gap: 20px;
          flex-shrink: 0;
        }

        .pantry-main-header h1 {
          font-size: 1.8rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 6px;
        }

        .pantry-main-header > div > p {
          color: var(--text-muted);
          font-size: 0.9rem;
          max-width: 500px;
        }

        .header-stats {
          display: flex;
          gap: 12px;
          flex-shrink: 0;
        }

        .stat-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 20px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .stat-chip.available-chip {
          background: rgba(16, 185, 129, 0.06);
          border-color: rgba(16, 185, 129, 0.15);
        }

        .stat-val {
          font-size: 1.3rem;
          font-weight: 800;
          color: #fff;
        }

        .stat-lbl {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        /* ── Category Grid ── */
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          flex: 1;
          overflow-y: auto;
          padding-bottom: 20px;
          padding-right: 4px;
        }

        .category-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 22px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }

        .category-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: var(--cat-color);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .category-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: color-mix(in srgb, var(--cat-color) 30%, transparent);
          transform: translateX(4px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        .category-card:hover::before {
          opacity: 1;
        }

        .cat-card-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: color-mix(in srgb, var(--cat-color) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--cat-color) 20%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          flex-shrink: 0;
          transition: all 0.3s ease;
        }

        .category-card:hover .cat-card-icon {
          transform: scale(1.08);
          background: color-mix(in srgb, var(--cat-color) 18%, transparent);
        }

        .cat-card-info {
          flex: 1;
          min-width: 0;
        }

        .cat-card-info h3 {
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 3px;
        }

        .cat-card-info p {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .cat-card-counts {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }

        .cat-total-badge {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 3px 10px;
          border-radius: 8px;
        }

        .cat-avail-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: #34d399;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.15);
          padding: 2px 8px;
          border-radius: 6px;
        }

        .cat-card-arrow {
          font-size: 1.5rem;
          color: rgba(255, 255, 255, 0.15);
          font-weight: 300;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .category-card:hover .cat-card-arrow {
          color: var(--cat-color);
          transform: translateX(4px);
        }

        /* ====== DETAIL VIEW (Level 2) ====== */
        .pantry-detail-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .detail-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 22px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          margin-bottom: 22px;
          gap: 16px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .detail-top-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          font-size: 0.88rem;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .detail-title-block {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .detail-emoji {
          font-size: 2rem;
        }

        .detail-title-block h2 {
          font-size: 1.4rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }

        .detail-title-block p {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin: 2px 0 0;
        }

        .detail-top-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          color: var(--text-muted);
          transition: all 0.2s ease;
        }

        .search-box:focus-within {
          border-color: rgba(139, 92, 246, 0.3);
          background: rgba(255, 255, 255, 0.04);
        }

        .search-box input {
          border: none;
          background: transparent;
          color: #fff;
          font-size: 0.88rem;
          font-family: inherit;
          outline: none;
          width: 160px;
        }

        .search-box input::placeholder {
          color: var(--text-muted);
        }

        .add-item-btn {
          flex-shrink: 0;
        }

        /* ── Detail Body Scroll ── */
        .detail-body-scroll {
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
          padding-bottom: 20px;
        }

        /* ── Items Grid ── */
        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
        }

        .item-card {
          padding: 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .item-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: color-mix(in srgb, var(--cat-color) 25%, transparent);
        }

        .item-card.unavailable {
          opacity: 0.45;
        }

        .item-card.unavailable:hover {
          opacity: 0.6;
        }

        .item-card.unavailable .item-card-info h4 {
          text-decoration: line-through;
          color: var(--text-muted);
        }

        .item-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .item-card-info h4 {
          font-size: 0.98rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .item-qty {
          font-size: 0.82rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .item-card-actions {
          display: flex;
          gap: 4px;
        }

        .item-action-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.15);
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          transition: all 0.2s ease;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-edit-btn:hover {
          color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
        }

        .item-delete-btn:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.1);
        }

        .item-card-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: 12px;
        }

        /* ── Toggle Switch ── */
        .toggle-switch {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }

        .toggle-switch input {
          display: none;
        }

        .toggle-slider {
          width: 38px;
          height: 20px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          position: relative;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .toggle-slider::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .toggle-switch input:checked + .toggle-slider {
          background: rgba(16, 185, 129, 0.3);
        }

        .toggle-switch input:checked + .toggle-slider::after {
          left: 20px;
          background: #34d399;
          box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
        }

        .toggle-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .toggle-switch input:checked ~ .toggle-label {
          color: #34d399;
        }

        /* ── Empty Category State ── */
        .empty-category-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 60px 30px;
          gap: 10px;
        }

        .empty-cat-icon {
          font-size: 3.5rem;
          margin-bottom: 10px;
          opacity: 0.5;
        }

        .empty-category-state h3 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
        }

        .empty-category-state p {
          font-size: 0.88rem;
          color: var(--text-muted);
          max-width: 300px;
        }

        /* ── Loading ── */
        .pantry-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          color: var(--text-muted);
        }

        .loader-icon {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }

        /* ── Modal ── */
        .form-row {
          display: flex;
          gap: 16px;
        }

        .flex-1 {
          flex: 1;
        }

        .error-msg {
          padding: 10px;
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 0.85rem;
        }

        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(5, 5, 8, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.25s ease-out;
        }

        .modal-content {
          width: 100%;
          max-width: 480px;
          background: rgba(20, 22, 32, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.12);
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          padding: 28px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .close-modal-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-smooth);
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-modal-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.9) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }

        .quantity-input-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0;
          width: 100%;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: var(--transition-smooth);
        }

        .quantity-input-container:focus-within {
          outline: none;
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 4px var(--primary-glow);
        }

        .qty-input-field {
          flex: 1;
          width: 100%;
          height: 50px;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: var(--font-family);
          font-size: 1rem;
          text-align: center;
          padding: 0;
          -moz-appearance: textfield;
        }

        .qty-input-field::-webkit-outer-spin-button,
        .qty-input-field::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .qty-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 100%;
          min-height: 50px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          user-select: none;
        }

        .qty-btn:hover {
          color: var(--primary);
          background: rgba(255, 255, 255, 0.04);
        }

        .qty-btn:first-of-type {
          border-top-left-radius: 14px;
          border-bottom-left-radius: 14px;
        }

        .qty-btn:last-of-type {
          border-top-right-radius: 14px;
          border-bottom-right-radius: 14px;
        }

        /* ── Responsive ── */
        @media (max-width: 992px) {
          .pantry-page {
            height: 100%;
          }
          .pantry-main-header {
            flex-direction: column;
            align-items: stretch;
            margin-bottom: 16px;
            padding-bottom: 16px;
            gap: 12px;
          }
          .pantry-main-header h1 {
            font-size: 1.5rem;
          }
          .pantry-main-header > div > p {
            font-size: 0.8rem;
          }
          .header-stats {
            justify-content: space-between;
            width: 100%;
          }
          .stat-chip {
            padding: 8px 14px;
            border-radius: 10px;
            flex: 1;
          }
          .stat-val {
            font-size: 1.1rem;
          }
          .stat-lbl {
            font-size: 0.65rem;
          }
          .category-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .category-card {
            padding: 14px 16px;
            border-radius: 14px;
            gap: 12px;
            flex-shrink: 0;
          }
          .cat-card-icon {
            width: 42px;
            height: 42px;
            font-size: 1.3rem;
            border-radius: 10px;
          }
          .cat-card-info h3 {
            font-size: 0.95rem;
          }
          .cat-card-info p {
            font-size: 0.75rem;
          }
          .cat-total-badge {
            font-size: 0.7rem;
            padding: 2px 8px;
          }
          .cat-avail-badge {
            font-size: 0.65rem;
            padding: 1px 6px;
          }
          .detail-top-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 16px;
          }
          .detail-top-left {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .detail-title-block h2 {
            font-size: 1.2rem;
          }
          .detail-emoji {
            font-size: 1.6rem;
          }
          .detail-top-right {
            width: 100%;
            flex-direction: row;
            gap: 10px;
          }
          .search-box {
            flex: 1;
            padding: 8px 12px;
          }
          .search-box input {
            width: 100%;
          }
          .add-item-btn {
            padding: 8px 14px;
            font-size: 0.85rem;
          }
          .items-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
          }
          .item-card {
            padding: 12px;
            border-radius: 12px;
            gap: 10px;
          }
          .item-card-info h4 {
            font-size: 0.88rem;
          }
          .item-qty {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  )
}
