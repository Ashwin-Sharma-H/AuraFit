import React, { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, CalendarRange, Check, Trash2,
  CheckCircle2, ShieldAlert, Layers, X, Flame, Dumbbell, Apple, Droplets
} from 'lucide-react'
import CustomSelect from '../components/CustomSelect.jsx'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function MealCalendar({ token, onLogout }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(formatDate(today.getFullYear(), today.getMonth(), today.getDate()))
  const [meals, setMeals] = useState([])
  const [bundles, setBundles] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState('')
  const [applyBundleId, setApplyBundleId] = useState('')
  const [applyingBundle, setApplyingBundle] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Fetch all meals for the visible month range ──
  useEffect(() => {
    fetchMonthMeals()
    fetchBundles()
    fetchProfile()
  }, [token])

  useEffect(() => {
    fetchMonthMeals()
  }, [viewYear, viewMonth])

  const fetchMonthMeals = async () => {
    setLoading(true)
    try {
      // Fetch all meals (no date filter) and filter in client for this month's range
      const res = await fetch('/api/meals/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) { if (onLogout) onLogout(); return }
      const data = await res.json()
      setMeals(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch meals:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBundles = async () => {
    try {
      const res = await fetch('/api/meal-bundles/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) { if (onLogout) onLogout(); return }
      const data = await res.json()
      setBundles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch bundles:', err)
    }
  }

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/auth/user/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) { if (onLogout) onLogout(); return }
      const data = await res.json()
      setProfile(data.profile || {})
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // ── Calendar grid computation ──
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startOffset = firstDay.getDay() // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells = []

    // Previous month trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day, dateStr: formatDate(y, m, day), isCurrentMonth: false })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: formatDate(viewYear, viewMonth, d), isCurrentMonth: true })
    }

    // Next month leading days (fill to 42)
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, dateStr: formatDate(y, m, d), isCurrentMonth: false })
    }

    return cells
  }, [viewYear, viewMonth])

  // ── Group meals by date ──
  const mealsByDate = useMemo(() => {
    const map = {}
    meals.forEach(meal => {
      if (!map[meal.date]) map[meal.date] = []
      map[meal.date].push(meal)
    })
    return map
  }, [meals])

  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const goToToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDate(todayStr)
    setDetailOpen(true)
  }

  const handleCellClick = (dateStr) => {
    setSelectedDate(dateStr)
    setDetailOpen(true)
  }

  // ── Selected day meals ──
  const selectedDayMeals = mealsByDate[selectedDate] || []

  // ── Macro goals calculation (mirrors Dashboard) ──
  const calculateGoals = () => {
    if (!profile) return { calories: 2000, protein: 130, carbs: 220, fat: 70 }
    
    if (profile.custom_calories) {
      return {
        calories: Math.round(profile.custom_calories),
        protein: Math.round(profile.custom_protein || 0),
        carbs: Math.round(profile.custom_carbs || 0),
        fat: Math.round(profile.custom_fat || 0)
      }
    }
    
    const weight = profile.weight || 70
    const goal = profile.fitness_goal || 'maintain_weight'
    const diet = profile.diet_plan || 'balanced'
    let baseCal = 1500 + (weight * 10)
    if (goal === 'lose_weight') baseCal -= 500
    if (goal === 'gain_muscle') baseCal += 400
    let pRatio = 0.25, cRatio = 0.50, fRatio = 0.25
    if (diet === 'keto') { pRatio = 0.20; cRatio = 0.05; fRatio = 0.75 }
    else if (diet === 'high_protein') { pRatio = 0.35; cRatio = 0.40; fRatio = 0.25 }
    else if (diet === 'vegan' || diet === 'vegetarian') { pRatio = 0.20; cRatio = 0.55; fRatio = 0.25 }
    return {
      calories: Math.round(baseCal),
      protein: Math.round((baseCal * pRatio) / 4),
      carbs: Math.round((baseCal * cRatio) / 4),
      fat: Math.round((baseCal * fRatio) / 9)
    }
  }
  const goals = calculateGoals()

  const selectedDayTotals = selectedDayMeals.reduce((acc, m) => {
    if (m.prepared) {
      acc.calories += m.calories || 0
      acc.protein += m.protein || 0
      acc.carbs += m.carbs || 0
      acc.fat += m.fat || 0
    }
    return acc
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  // ── Meal actions ──
  const togglePrepared = async (mealId, currentStatus) => {
    try {
      const res = await fetch(`/api/meals/${mealId}/`, {
        method: 'PATCH',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prepared: !currentStatus })
      })
      if (res.ok) {
        setMeals(meals.map(m => m.id === mealId ? { ...m, prepared: !currentStatus } : m))
        showToast(!currentStatus ? 'Meal marked as consumed!' : 'Meal unmarked.')
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteMeal = async (mealId) => {
    if (!window.confirm('Delete this meal log?')) return
    try {
      const res = await fetch(`/api/meals/${mealId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.ok) {
        setMeals(meals.filter(m => m.id !== mealId))
        showToast('Meal deleted.')
      }
    } catch (err) { console.error(err) }
  }

  const handleApplyBundle = async () => {
    if (!applyBundleId) return
    setApplyingBundle(true)
    try {
      const res = await fetch(`/api/meal-bundles/${applyBundleId}/apply/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      })
      if (res.ok) {
        showToast(`Bundle applied to ${selectedDate}!`)
        setApplyBundleId('')
        fetchMonthMeals()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to apply bundle.')
      }
    } catch (err) {
      showToast('Connection error applying bundle.')
    } finally {
      setApplyingBundle(false)
    }
  }

  // ── Helper: meal type dot color ──
  const mealTypeDotClass = (type) => {
    switch (type) {
      case 'breakfast': return 'dot-breakfast'
      case 'lunch': return 'dot-lunch'
      case 'dinner': return 'dot-dinner'
      case 'snack': return 'dot-snack'
      default: return ''
    }
  }

  const mealTypeEmoji = (type) => {
    switch (type) {
      case 'breakfast': return '🍳'
      case 'lunch': return '🥗'
      case 'dinner': return '🥩'
      case 'snack': return '🍎'
      default: return '🍽️'
    }
  }

  const bundleOptions = [
    { value: '', label: 'Select a bundle...' },
    ...bundles.map(b => ({ value: String(b.id), label: b.name }))
  ]

  if (loading && meals.length === 0) {
    return (
      <div className="aurafit-loader-wrapper">
        <div className="aurafit-loader-container">
          <div className="aurafit-loader-spinner">
            <div className="spinner-inner"></div>
            <div className="spinner-center">📅</div>
          </div>
          <p className="aurafit-loader-text">Loading meal calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="meal-calendar-page">
      {/* Toast */}
      {toastMessage && (
        <div className="mc-toast">
          <Check size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="mc-header">
        <div className="mc-header-left">
          <h1>Meal Calendar</h1>
          <p className="mc-subtitle">Track your daily nutrition intake across the month.</p>
        </div>
        <div className="mc-header-controls">
          <button className="mc-nav-btn" onClick={goToPrevMonth}>
            <ChevronLeft size={18} />
          </button>
          <h2 className="mc-month-label">{monthNames[viewMonth]} {viewYear}</h2>
          <button className="mc-nav-btn" onClick={goToNextMonth}>
            <ChevronRight size={18} />
          </button>
          <button className="mc-today-btn" onClick={goToToday}>Today</button>
        </div>
      </div>

      {/* Main Body: Calendar + Detail */}
      <div className={`mc-body ${detailOpen ? 'detail-open' : ''}`}>
        {/* Calendar Grid */}
        <div className="mc-grid-container">
          {/* Weekday Headers */}
          <div className="mc-weekday-row">
            {WEEKDAYS.map(d => <div key={d} className="mc-weekday-cell">{d}</div>)}
          </div>

          {/* Date Cells */}
          <div className="mc-date-grid">
            {calendarCells.map((cell, idx) => {
              const dayMeals = mealsByDate[cell.dateStr] || []
              const dayCalories = dayMeals.reduce((s, m) => s + (m.calories || 0), 0)
              const isToday = cell.dateStr === todayStr
              const isSelected = cell.dateStr === selectedDate
              const hasMeals = dayMeals.length > 0
              // Unique meal types present
              const mealTypes = [...new Set(dayMeals.map(m => m.meal_type))]

              return (
                <div
                  key={idx}
                  className={`mc-date-cell ${!cell.isCurrentMonth ? 'outside-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${hasMeals ? 'has-meals' : ''}`}
                  onClick={() => handleCellClick(cell.dateStr)}
                >
                  <span className="mc-day-number">{cell.day}</span>
                  {hasMeals && (
                    <div className="mc-cell-info">
                      <span className="mc-cell-kcal">{dayCalories} kcal</span>
                      <div className="mc-cell-dots">
                        {mealTypes.map(t => (
                          <span key={t} className={`mc-dot ${mealTypeDotClass(t)}`} title={t} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mc-legend">
            <span className="mc-legend-item"><span className="mc-dot dot-breakfast" /> Breakfast</span>
            <span className="mc-legend-item"><span className="mc-dot dot-lunch" /> Lunch</span>
            <span className="mc-legend-item"><span className="mc-dot dot-dinner" /> Dinner</span>
            <span className="mc-legend-item"><span className="mc-dot dot-snack" /> Snack</span>
          </div>
        </div>

        {/* Detail Panel */}
        {detailOpen && (
          <div className="mc-detail-panel">
            <div className="mc-detail-header">
              <div>
                <span className="badge badge-primary">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</span>
                <h3 className="mc-detail-date">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
              </div>
              <button className="mc-detail-close" onClick={() => setDetailOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="mc-detail-body">
              {/* Macro Progress */}
              <div className="mc-macro-section">
                <h4 className="mc-section-title">Daily Nutrition Progress</h4>
                <div className="mc-progress-rows">
                  <div className="mc-progress-row">
                    <div className="mc-progress-label">
                      <Flame size={14} className="mc-icon-cal" />
                      <span>Calories</span>
                    </div>
                    <div className="mc-progress-bar-wrap">
                      <div className="mc-progress-bar cal-bar" style={{ width: `${progressPercent(selectedDayTotals.calories, goals.calories)}%` }} />
                    </div>
                    <span className="mc-progress-value">{selectedDayTotals.calories} / {goals.calories}</span>
                  </div>
                  <div className="mc-progress-row">
                    <div className="mc-progress-label">
                      <Dumbbell size={14} className="mc-icon-prot" />
                      <span>Protein</span>
                    </div>
                    <div className="mc-progress-bar-wrap">
                      <div className="mc-progress-bar prot-bar" style={{ width: `${progressPercent(selectedDayTotals.protein, goals.protein)}%` }} />
                    </div>
                    <span className="mc-progress-value">{Math.round(selectedDayTotals.protein)}g / {goals.protein}g</span>
                  </div>
                  <div className="mc-progress-row">
                    <div className="mc-progress-label">
                      <Apple size={14} className="mc-icon-carb" />
                      <span>Carbs</span>
                    </div>
                    <div className="mc-progress-bar-wrap">
                      <div className="mc-progress-bar carb-bar" style={{ width: `${progressPercent(selectedDayTotals.carbs, goals.carbs)}%` }} />
                    </div>
                    <span className="mc-progress-value">{Math.round(selectedDayTotals.carbs)}g / {goals.carbs}g</span>
                  </div>
                  <div className="mc-progress-row">
                    <div className="mc-progress-label">
                      <Droplets size={14} className="mc-icon-fat" />
                      <span>Fat</span>
                    </div>
                    <div className="mc-progress-bar-wrap">
                      <div className="mc-progress-bar fat-bar" style={{ width: `${progressPercent(selectedDayTotals.fat, goals.fat)}%` }} />
                    </div>
                    <span className="mc-progress-value">{Math.round(selectedDayTotals.fat)}g / {goals.fat}g</span>
                  </div>
                </div>
              </div>

              {/* Meal List */}
              <div className="mc-meals-section">
                <h4 className="mc-section-title">Logged Meals ({selectedDayMeals.length})</h4>
                {selectedDayMeals.length === 0 ? (
                  <div className="mc-empty-day">
                    <CalendarRange size={32} className="mc-empty-icon" />
                    <p>No meals logged for this day.</p>
                    <span className="mc-empty-hint">Use the bundle selector below to populate this day.</span>
                  </div>
                ) : (
                  <div className="mc-meal-list">
                    {selectedDayMeals.map(meal => (
                      <div key={meal.id} className={`mc-meal-card ${meal.prepared ? 'consumed' : ''}`}>
                        <div className="mc-meal-left">
                          <span className="mc-meal-emoji">{mealTypeEmoji(meal.meal_type)}</span>
                          <div className="mc-meal-info">
                            <span className="mc-meal-type-label">{meal.meal_type}</span>
                            <h5>{meal.recipe_title}</h5>
                            <p className="mc-meal-macros">
                              {meal.calories} kcal &middot; P: {meal.protein}g &middot; C: {meal.carbs}g &middot; F: {meal.fat}g
                            </p>
                          </div>
                        </div>
                        <div className="mc-meal-actions">
                          <button
                            className={`mc-action-btn mc-check-btn ${meal.prepared ? 'active' : ''}`}
                            onClick={() => togglePrepared(meal.id, meal.prepared)}
                            title={meal.prepared ? 'Unmark consumed' : 'Mark consumed'}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            className="mc-action-btn mc-delete-btn"
                            onClick={() => handleDeleteMeal(meal.id)}
                            title="Delete meal"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Apply Bundle */}
              <div className="mc-bundle-section">
                <h4 className="mc-section-title">
                  <Layers size={16} />
                  Quick Apply Bundle
                </h4>
                <div className="mc-bundle-row">
                  <div className="mc-bundle-select-wrap">
                    <CustomSelect
                      id="calendar-bundle-select"
                      options={bundleOptions}
                      value={applyBundleId}
                      onChange={(val) => setApplyBundleId(val)}
                      placeholder="Select a bundle..."
                    />
                  </div>
                  <button
                    className="btn btn-primary mc-apply-btn"
                    onClick={handleApplyBundle}
                    disabled={!applyBundleId || applyingBundle}
                  >
                    {applyingBundle ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Override global padding for full-bleed layout */
        .main-content {
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .meal-calendar-page {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          background: rgba(8, 10, 16, 0.2);
        }

        /* ── Toast ── */
        .mc-toast {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 22px;
          border-radius: 14px;
          font-size: 0.92rem;
          font-weight: 600;
          font-family: var(--font-family);
          background: rgba(16, 185, 129, 0.18);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.3);
          backdrop-filter: blur(20px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          animation: mcToastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes mcToastIn {
          from { opacity: 0; transform: translateX(30px) translateY(-10px); }
          to { opacity: 1; transform: translateX(0) translateY(0); }
        }

        /* ── Header ── */
        .mc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 28px 40px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .mc-header h1 {
          margin: 0;
          font-size: 1.8rem;
          background: linear-gradient(135deg, #ffffff 40%, #c084fc 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .mc-subtitle {
          margin: 4px 0 0;
          color: var(--text-muted);
          font-size: 0.88rem;
        }

        .mc-header-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mc-month-label {
          font-size: 1.15rem;
          font-weight: 700;
          color: #fff;
          min-width: 180px;
          text-align: center;
          margin: 0;
        }

        .mc-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .mc-nav-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.15);
        }

        .mc-today-btn {
          padding: 8px 18px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          color: #c084fc;
          font-family: var(--font-family);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .mc-today-btn:hover {
          background: rgba(139, 92, 246, 0.2);
          border-color: rgba(139, 92, 246, 0.4);
        }

        /* ── Body Layout ── */
        .mc-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mc-grid-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px 32px 20px 40px;
          overflow-y: auto;
          min-width: 0;
        }

        /* ── Weekday Header ── */
        .mc-weekday-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          margin-bottom: 8px;
        }

        .mc-weekday-cell {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 8px 0;
        }

        /* ── Date Grid ── */
        .mc-date-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          flex: 1;
        }

        .mc-date-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 10px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 80px;
          position: relative;
        }

        .mc-date-cell:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .mc-date-cell.outside-month {
          opacity: 0.3;
        }

        .mc-date-cell.is-today {
          border-color: rgba(139, 92, 246, 0.4);
          background: rgba(139, 92, 246, 0.06);
        }

        .mc-date-cell.is-today .mc-day-number {
          background: var(--primary-gradient);
          color: #fff;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .mc-date-cell.is-selected {
          border-color: rgba(139, 92, 246, 0.6);
          background: rgba(139, 92, 246, 0.1);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.08);
        }

        .mc-day-number {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1;
        }

        .mc-cell-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: auto;
          width: 100%;
        }

        .mc-cell-kcal {
          font-size: 0.68rem;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.12);
          padding: 2px 6px;
          border-radius: 6px;
          align-self: flex-start;
        }

        .mc-cell-dots {
          display: flex;
          gap: 4px;
        }

        .mc-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dot-breakfast { background: #fbbf24; }
        .dot-lunch { background: #22d3ee; }
        .dot-dinner { background: #c084fc; }
        .dot-snack { background: #fb7185; }

        /* ── Legend ── */
        .mc-legend {
          display: flex;
          gap: 20px;
          padding: 14px 0 4px;
          flex-shrink: 0;
        }

        .mc-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        /* ── Detail Panel ── */
        .mc-detail-panel {
          width: 380px;
          flex-shrink: 0;
          border-left: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          background: rgba(12, 14, 22, 0.5);
          animation: mcPanelSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes mcPanelSlide {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .mc-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 24px 24px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .mc-detail-date {
          margin: 6px 0 0;
          font-size: 1.15rem;
          font-weight: 800;
          color: #fff;
        }

        .mc-detail-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-smooth);
        }

        .mc-detail-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .mc-detail-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .mc-detail-body::-webkit-scrollbar {
          width: 5px;
        }

        .mc-detail-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }

        .mc-section-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── Macro Progress ── */
        .mc-macro-section {
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .mc-progress-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mc-progress-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mc-progress-label {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 85px;
          flex-shrink: 0;
          font-size: 0.8rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }

        .mc-icon-cal { color: #fbbf24; }
        .mc-icon-prot { color: #c084fc; }
        .mc-icon-carb { color: #22d3ee; }
        .mc-icon-fat { color: #fb7185; }

        .mc-progress-bar-wrap {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 99px;
          overflow: hidden;
        }

        .mc-progress-bar {
          height: 100%;
          border-radius: 99px;
          transition: width 0.5s ease-out;
        }

        .cal-bar { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
        .prot-bar { background: linear-gradient(90deg, #8b5cf6, #c084fc); }
        .carb-bar { background: linear-gradient(90deg, #0891b2, #22d3ee); }
        .fat-bar { background: linear-gradient(90deg, #e11d48, #fb7185); }

        .mc-progress-value {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          width: 90px;
          text-align: right;
          flex-shrink: 0;
        }

        /* ── Empty Day ── */
        .mc-empty-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 30px 10px;
          gap: 6px;
        }

        .mc-empty-icon {
          color: rgba(255, 255, 255, 0.12);
          margin-bottom: 6px;
        }

        .mc-empty-day p {
          font-size: 0.88rem;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .mc-empty-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* ── Meal List ── */
        .mc-meal-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mc-meal-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          transition: all 0.2s ease;
          gap: 10px;
        }

        .mc-meal-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .mc-meal-card.consumed {
          border-color: rgba(16, 185, 129, 0.15);
          background: rgba(16, 185, 129, 0.03);
        }

        .mc-meal-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .mc-meal-emoji {
          font-size: 1.4rem;
          flex-shrink: 0;
        }

        .mc-meal-info {
          min-width: 0;
        }

        .mc-meal-type-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .mc-meal-info h5 {
          margin: 2px 0 3px;
          font-size: 0.9rem;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mc-meal-macros {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin: 0;
        }

        .mc-meal-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .mc-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.25);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .mc-check-btn:hover, .mc-check-btn.active {
          color: var(--accent-green);
          background: rgba(16, 185, 129, 0.1);
        }

        .mc-delete-btn:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.1);
        }

        /* ── Bundle Quick Apply ── */
        .mc-bundle-section {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: 20px;
        }

        .mc-bundle-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .mc-bundle-select-wrap {
          flex: 1;
        }

        .mc-apply-btn {
          padding: 14px 20px;
          font-size: 0.88rem;
          border-radius: 14px;
          flex-shrink: 0;
        }

        /* ── Responsive ── */
        @media (max-width: 992px) {
          .mc-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 14px;
            padding: 20px 20px 14px;
          }

          .mc-header h1 {
            font-size: 1.5rem;
          }

          .mc-header-controls {
            width: 100%;
            justify-content: space-between;
          }

          .mc-month-label {
            font-size: 1rem;
            min-width: 0;
          }

          .mc-body {
            flex-direction: column;
          }

          .mc-grid-container {
            padding: 12px 16px;
            flex: 1;
            overflow-y: auto;
          }

          .mc-date-cell {
            min-height: 56px;
            padding: 6px;
            border-radius: 8px;
          }

          .mc-cell-kcal {
            font-size: 0.58rem;
            padding: 1px 4px;
          }

          .mc-dot {
            width: 5px;
            height: 5px;
          }

          .mc-legend {
            gap: 12px;
            flex-wrap: wrap;
          }

          /* Full-screen overlay on mobile */
          .mc-detail-panel {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 70px; /* leave room for the bottom nav */
            width: 100%;
            max-height: none;
            border-left: none;
            border-top: none;
            background: rgba(10, 12, 18, 0.98);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            z-index: 500;
            animation: mcPanelFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          @keyframes mcPanelFadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .mc-detail-header {
            padding: 20px 20px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .mc-detail-close {
            width: 36px;
            height: 36px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }

          .mc-detail-body {
            padding: 16px 20px 24px;
            flex: 1;
            overflow-y: auto;
          }

          .mc-progress-label {
            width: 70px;
            font-size: 0.72rem;
          }

          .mc-progress-value {
            width: 75px;
            font-size: 0.65rem;
          }
        }
      `}</style>
    </div>
  )
}
