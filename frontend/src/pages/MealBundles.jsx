import React, { useState, useEffect } from 'react'
import { Sparkles, Check, Trash2, Layers, ShieldAlert, Plus, Calendar, X, ChevronRight, BookOpen, Edit2 } from 'lucide-react'
import CustomSelect from '../components/CustomSelect.jsx'

export default function MealBundles({ token, onLogout }) {
  // Bundles and Recipes data states
  const [bundles, setBundles] = useState([])
  const [savedRecipes, setSavedRecipes] = useState([])
  const [selectedBundle, setSelectedBundle] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Editor form states
  const [bundleName, setBundleName] = useState('')
  const [breakfastId, setBreakfastId] = useState('')
  const [lunchId, setLunchId] = useState('')
  const [dinnerId, setDinnerId] = useState('')
  const [snackId, setSnackId] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Actions / UI feedback states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [applyDates, setApplyDates] = useState({}) // maps bundleId -> dateString
  
  // AI Assistant States
  const [aiLoading, setAiLoading] = useState(false)
  const [aiFeedback, setAiFeedback] = useState('')

  useEffect(() => {
    fetchBundles()
    fetchSavedRecipes()
  }, [token])

  const fetchBundles = async () => {
    try {
      const res = await fetch('/api/meal-bundles/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }
      const data = await res.json()
      setBundles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch bundles:', err)
      setError('Failed to load meal bundles.')
    }
  }

  const fetchSavedRecipes = async () => {
    try {
      const res = await fetch('/api/recipes/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }
      const data = await res.json()
      setSavedRecipes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch saved recipes:', err)
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const handleAILibrarySelect = async () => {
    setAiLoading(true)
    setError('')
    setAiFeedback('')
    try {
      const res = await fetch('/api/meal-bundles/ai-recommend/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          mode: 'auto_fill',
          breakfast_id: breakfastId || null,
          lunch_id: lunchId || null,
          dinner_id: dinnerId || null,
          snack_id: snackId || null
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.breakfast_id) setBreakfastId(String(data.breakfast_id))
        if (data.lunch_id) setLunchId(String(data.lunch_id))
        if (data.dinner_id) setDinnerId(String(data.dinner_id))
        if (data.snack_id) setSnackId(String(data.snack_id))
        setAiFeedback(data.explanation || 'Optimal combination selected.')
        showToast('AI optimized recipe selection!')
      } else {
        const text = await res.text()
        setError('AI recommendation failed: ' + text)
      }
    } catch (err) {
      setError('Connection to AI service failed.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAIGenerateNew = async () => {
    setAiLoading(true)
    setError('')
    setAiFeedback('')
    try {
      const res = await fetch('/api/meal-bundles/ai-recommend/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          mode: 'generate_new',
          breakfast_id: breakfastId || null,
          lunch_id: lunchId || null,
          dinner_id: dinnerId || null,
          snack_id: snackId || null
        })
      })
      if (res.ok) {
        const data = await res.json()
        // Refetch saved recipes list first so they exist in dropdowns
        await fetchSavedRecipes()
        
        if (data.breakfast_id) setBreakfastId(String(data.breakfast_id))
        if (data.lunch_id) setLunchId(String(data.lunch_id))
        if (data.dinner_id) setDinnerId(String(data.dinner_id))
        if (data.snack_id) setSnackId(String(data.snack_id))
        setAiFeedback(data.explanation || 'Perfect new recipes generated.')
        showToast('AI generated and saved new healthy recipes!')
      } else {
        const text = await res.text()
        setError('AI generation failed: ' + text)
      }
    } catch (err) {
      setError('Connection to AI service failed.')
    } finally {
      setAiLoading(false)
    }
  }

  // Calculate sum of macros for a set of recipe IDs
  const calculateTotalMacros = (bId, lId, dId, sId) => {
    const selected = [bId, lId, dId, sId].map(id => savedRecipes.find(r => r.id === parseInt(id)))
    return selected.reduce((totals, recipe) => {
      if (recipe) {
        totals.calories += recipe.calories || 0
        totals.protein += recipe.protein || 0
        totals.carbs += recipe.carbs || 0
        totals.fat += recipe.fat || 0
      }
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }

  const handleSaveBundle = async (e) => {
    e.preventDefault()
    if (!bundleName.trim()) {
      setError('Please enter a name for the bundle.')
      return
    }
    setError('')
    setLoading(true)

    const payload = {
      name: bundleName,
      breakfast: breakfastId ? parseInt(breakfastId) : null,
      lunch: lunchId ? parseInt(lunchId) : null,
      dinner: dinnerId ? parseInt(dinnerId) : null,
      snack: snackId ? parseInt(snackId) : null,
    }

    try {
      const url = isEditing ? `/api/meal-bundles/${selectedBundle.id}/` : '/api/meal-bundles/'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }

      if (res.ok) {
        showToast(isEditing ? 'Bundle updated successfully!' : 'Bundle created successfully!')
        closeModal()
        fetchBundles()
      } else {
        const text = await res.text()
        setError('Failed to save bundle: ' + text)
      }
    } catch (err) {
      setError('Connection failed. Verify server is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBundle = async (bundleId, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this bundle?')) return
    setError('')

    try {
      const res = await fetch(`/api/meal-bundles/${bundleId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      })

      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }

      if (res.ok) {
        showToast('Bundle deleted.')
        if (selectedBundle?.id === bundleId) {
          resetEditor()
        }
        fetchBundles()
      } else {
        setError('Failed to delete bundle.')
      }
    } catch (err) {
      setError('Failed to execute delete bundle action.')
    }
  }

  const handleApplyBundle = async (bundleId) => {
    const targetDate = applyDates[bundleId]
    if (!targetDate) {
      alert('Please select a target date first.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/meal-bundles/${bundleId}/apply/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: targetDate })
      })

      if (res.ok) {
        showToast(`Bundle successfully applied to ${targetDate}!`)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to apply bundle to selected date.')
      }
    } catch (err) {
      setError('Failed to apply bundle.')
    } finally {
      setLoading(false)
    }
  }

  const loadBundleToEditor = (bundle) => {
    setSelectedBundle(bundle)
    setBundleName(bundle.name)
    setBreakfastId(bundle.breakfast ? String(bundle.breakfast) : '')
    setLunchId(bundle.lunch ? String(bundle.lunch) : '')
    setDinnerId(bundle.dinner ? String(bundle.dinner) : '')
    setSnackId(bundle.snack ? String(bundle.snack) : '')
    setIsEditing(true)
    setError('')
    setModalOpen(true)
  }

  const resetEditor = () => {
    setSelectedBundle(null)
    setBundleName('')
    setBreakfastId('')
    setLunchId('')
    setDinnerId('')
    setSnackId('')
    setIsEditing(false)
    setError('')
    setAiFeedback('')
  }

  const openComposerModal = () => {
    resetEditor()
    setModalOpen(true)
  }

  const closeModal = () => {
    resetEditor()
    setModalOpen(false)
  }

  // Filter recipes for each slot's dropdown list
  const getRecipeOptions = (mealType) => {
    return [
      { value: '', label: 'Not Selected' },
      ...savedRecipes
        .filter(r => r.meal_type === mealType)
        .map(r => ({ value: String(r.id), label: `${r.recipe_title} (${r.calories} kcal)` }))
    ]
  }

  const activeTotals = calculateTotalMacros(breakfastId, lunchId, dinnerId, snackId)

  // Mini-recipe preview helper
  const renderRecipeMiniPreview = (slotLabel, recipeId) => {
    const recipe = savedRecipes.find(r => r.id === parseInt(recipeId))
    if (!recipe) return <div className="bundle-slot-empty-preview">No {slotLabel.toLowerCase()} recipe assigned.</div>
    return (
      <div className="bundle-slot-mini-card">
        {recipe.image_data && (
          <img src={recipe.image_data} alt={recipe.recipe_title} className="slot-mini-img" />
        )}
        <div className="slot-mini-info">
          <h5>{recipe.recipe_title}</h5>
          <p className="slot-mini-macros">
            <span>{recipe.calories} kcal</span>
            <span>P: {recipe.protein}g</span>
            <span>C: {recipe.carbs}g</span>
            <span>F: {recipe.fat}g</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="meal-planner-page day-bundles-page">
      {/* Success Toast */}
      {toastMessage && (
        <div className="mp-toast">
          <Check size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Day Bundles Gallery Header */}
      <div className="gallery-header-section">
        <div className="header-title-block">
          <div className="title-row">
            <h1>Day Bundles</h1>
            <span className="badge badge-primary saved-count-badge">
              {bundles.length} Saved
            </span>
          </div>
          <p className="header-subtitle">Compose and apply 4-meal daily structures to your diary calendar in one click.</p>
        </div>
        <button onClick={openComposerModal} className="btn btn-primary compose-btn">
          <Plus size={18} /> Compose Day Bundle
        </button>
      </div>

      {/* Body container (scrollable grid) */}
      <div className="gallery-body-section">
        {bundles.length === 0 ? (
          <div className="empty-gallery-state">
            <Layers size={48} className="empty-state-icon" />
            <h3>No Day Bundles Saved Yet</h3>
            <p>Composing daily structures makes diary logging incredibly fast. Save a breakfast, lunch, dinner, and snack bundle to get started.</p>
            <button onClick={openComposerModal} className="btn btn-primary empty-compose-btn">
              <Plus size={16} /> Compose First Bundle
            </button>
          </div>
        ) : (
          <div className="bundles-grid-layout">
            {bundles.map((bundle) => {
              const totals = calculateTotalMacros(
                bundle.breakfast,
                bundle.lunch,
                bundle.dinner,
                bundle.snack
              )

              return (
                <div key={bundle.id} className="bundle-card-item glass-card">
                  <div className="bundle-card-header">
                    <div className="bundle-card-title-group">
                      <div className="saved-card-icon">
                        <Layers size={18} />
                      </div>
                      <h4>{bundle.name}</h4>
                    </div>
                    <div className="bundle-card-actions">
                      <button
                        onClick={() => loadBundleToEditor(bundle)}
                        className="btn btn-secondary action-icon-btn"
                        title="Edit Bundle"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteBundle(bundle.id, e)}
                        className="btn btn-secondary action-icon-btn delete-btn"
                        title="Delete Bundle"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Summary slots info */}
                  <div className="bundle-card-slots">
                    <div className="bundle-card-slot-row">
                      <span className="slot-emoji-label">🍳 Breakfast</span>
                      <strong className="slot-recipe-title" title={bundle.breakfast_details?.recipe_title || 'Not Set'}>
                        {bundle.breakfast_details?.recipe_title || 'Not Set'}
                      </strong>
                    </div>
                    <div className="bundle-card-slot-row">
                      <span className="slot-emoji-label">🥗 Lunch</span>
                      <strong className="slot-recipe-title" title={bundle.lunch_details?.recipe_title || 'Not Set'}>
                        {bundle.lunch_details?.recipe_title || 'Not Set'}
                      </strong>
                    </div>
                    <div className="bundle-card-slot-row">
                      <span className="slot-emoji-label">🥩 Dinner</span>
                      <strong className="slot-recipe-title" title={bundle.dinner_details?.recipe_title || 'Not Set'}>
                        {bundle.dinner_details?.recipe_title || 'Not Set'}
                      </strong>
                    </div>
                    <div className="bundle-card-slot-row">
                      <span className="slot-emoji-label">🍎 Snack</span>
                      <strong className="slot-recipe-title" title={bundle.snack_details?.recipe_title || 'Not Set'}>
                        {bundle.snack_details?.recipe_title || 'Not Set'}
                      </strong>
                    </div>
                  </div>

                  {/* Macros line */}
                  <div className="bundle-card-macros">
                    <span className="macro-chip cal-chip">{totals.calories} kcal</span>
                    <span className="macro-chip prot-chip">Protein: {totals.protein}g</span>
                    <span className="macro-chip carb-chip">Carbs: {totals.carbs}g</span>
                    <span className="macro-chip fat-chip">Fat: {totals.fat}g</span>
                  </div>

                  {/* Date picker + apply button */}
                  <div className="bundle-card-apply-row">
                    <div className="bundle-date-input-container">
                      <Calendar size={14} className="bundle-date-input-icon" />
                      <input
                        type="date"
                        value={applyDates[bundle.id] || ''}
                        onChange={(e) => setApplyDates({ ...applyDates, [bundle.id]: e.target.value })}
                        className="bundle-date-input"
                      />
                    </div>
                    <button
                      onClick={() => handleApplyBundle(bundle.id)}
                      className="btn btn-primary apply-btn"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Compose/Edit Modal Popup */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content glass-card bundle-composer-modal" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <span className="badge badge-secondary modal-badge">
                  {isEditing ? 'Edit Bundle' : 'Compose Day Bundle'}
                </span>
                <h3 className="modal-title">
                  {isEditing ? `Edit: ${bundleName}` : 'Compose Daily Meal Bundle'}
                </h3>
              </div>
              <button className="close-modal-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable Form) */}
            <form id="bundle-composer-form" onSubmit={handleSaveBundle} className="detail-body">
              {error && (
                <div className="error-banner">
                  <ShieldAlert size={20} />
                  <span>{error}</span>
                </div>
              )}

              {/* Bundle Name Field */}
              <div className="detail-section">
                <h3 className="detail-section-title">Bundle Details</h3>
                <div className="input-group">
                  <label className="input-label">Daily Bundle Name</label>
                  <input
                    type="text"
                    placeholder="e.g. High Protein Prep Monday"
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                    className="bundle-name-input"
                  />
                </div>
              </div>

              {/* AI Bundle Assistant Section */}
              <div className="detail-section ai-assistant-section-wrap">
                <div className="ai-assistant-card glass-card">
                  <div className="ai-assistant-header">
                    <div className="ai-header-title">
                      <Sparkles size={16} className="sparkle-icon" />
                      <span>AI Bundle Assistant</span>
                    </div>
                    <p className="ai-header-desc">
                      Select optimal recipes from your library or generate new healthy recipes matching your profile goals.
                    </p>
                  </div>
                  
                  <div className="ai-assistant-actions">
                    <button
                      type="button"
                      onClick={handleAILibrarySelect}
                      disabled={aiLoading}
                      className="btn btn-secondary ai-opt-btn"
                    >
                      {aiLoading ? 'Optimizing...' : '✨ Auto-Select Library'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAIGenerateNew}
                      disabled={aiLoading}
                      className="btn btn-primary ai-gen-btn"
                    >
                      {aiLoading ? 'Generating...' : '✨ Generate New Recipes'}
                    </button>
                  </div>

                  {aiFeedback && (
                    <div className="ai-feedback-box">
                      <p className="ai-feedback-text">{aiFeedback}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Combined Macro Summary */}
              <div className="detail-section">
                <h3 className="detail-section-title">Combined Daily Macros</h3>
                <div className="macro-strip">
                  <div className="macro-strip-item calories-accent">
                    <span className="macro-strip-val">{activeTotals.calories}</span>
                    <span className="macro-strip-lbl">Calories</span>
                  </div>
                  <div className="macro-strip-item protein-accent">
                    <span className="macro-strip-val">{activeTotals.protein}g</span>
                    <span className="macro-strip-lbl">Protein</span>
                  </div>
                  <div className="macro-strip-item carbs-accent">
                    <span className="macro-strip-val">{activeTotals.carbs}g</span>
                    <span className="macro-strip-lbl">Carbs</span>
                  </div>
                  <div className="macro-strip-item fat-accent">
                    <span className="macro-strip-val">{activeTotals.fat}g</span>
                    <span className="macro-strip-lbl">Fat</span>
                  </div>
                </div>
              </div>

              {/* Slots selector */}
              <div className="detail-section">
                <h3 className="detail-section-title">Compose Daily Slots</h3>
                
                <div className="bundle-form-slots-container">
                  {/* Breakfast */}
                  <div className="bundle-form-slot-row">
                    <label className="bundle-slot-label">🥞 Breakfast Slot</label>
                    <CustomSelect
                      id="bundle-select-breakfast"
                      options={getRecipeOptions('breakfast')}
                      value={breakfastId}
                      onChange={(val) => setBreakfastId(val)}
                    />
                    {renderRecipeMiniPreview('Breakfast', breakfastId)}
                  </div>

                  {/* Lunch */}
                  <div className="bundle-form-slot-row">
                    <label className="bundle-slot-label">🥗 Lunch Slot</label>
                    <CustomSelect
                      id="bundle-select-lunch"
                      options={getRecipeOptions('lunch')}
                      value={lunchId}
                      onChange={(val) => setLunchId(val)}
                    />
                    {renderRecipeMiniPreview('Lunch', lunchId)}
                  </div>

                  {/* Dinner */}
                  <div className="bundle-form-slot-row">
                    <label className="bundle-slot-label">🥩 Dinner Slot</label>
                    <CustomSelect
                      id="bundle-select-dinner"
                      options={getRecipeOptions('dinner')}
                      value={dinnerId}
                      onChange={(val) => setDinnerId(val)}
                    />
                    {renderRecipeMiniPreview('Dinner', dinnerId)}
                  </div>

                  {/* Snack */}
                  <div className="bundle-form-slot-row">
                    <label className="bundle-slot-label">🍎 Snack Slot</label>
                    <CustomSelect
                      id="bundle-select-snack"
                      options={getRecipeOptions('snack')}
                      value={snackId}
                      onChange={(val) => setSnackId(val)}
                    />
                    {renderRecipeMiniPreview('Snack', snackId)}
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer actions */}
            <div className="modal-footer">
              <button
                type="button"
                onClick={closeModal}
                className="btn btn-secondary modal-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bundle-composer-form"
                disabled={loading}
                className="btn btn-primary modal-save-btn"
              >
                {loading ? 'Saving...' : isEditing ? 'Update Bundle' : 'Save Daily Bundle'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Override global padding for full-bleed scrollable content */
        .main-content {
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .meal-planner-page {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .day-bundles-page {
          background: rgba(8, 10, 16, 0.2);
        }

        /* ── Header Area ── */
        .gallery-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 30px 40px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .header-title-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .title-row h1 {
          margin: 0;
          font-size: 1.8rem;
          background: linear-gradient(135deg, #ffffff 40%, #c084fc 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .saved-count-badge {
          font-size: 0.75rem;
          padding: 4px 12px;
          border-radius: 12px;
          margin-bottom: 0;
          height: fit-content;
        }

        .header-subtitle {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.88rem;
        }

        .compose-btn {
          border-radius: 14px;
          padding: 12px 24px;
          font-size: 0.92rem;
          gap: 8px;
        }

        /* ── Body Container ── */
        .gallery-body-section {
          flex: 1;
          overflow-y: auto;
          padding: 24px 40px 40px;
        }

        /* ── Empty State ── */
        .empty-gallery-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.01);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          min-height: 320px;
        }

        .empty-state-icon {
          color: var(--primary);
          margin-bottom: 16px;
        }

        .empty-gallery-state h3 {
          color: #fff;
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0;
        }

        .empty-gallery-state p {
          max-width: 400px;
          color: var(--text-muted);
          margin: 8px 0 20px;
          line-height: 1.5;
          font-size: 0.88rem;
        }

        .empty-compose-btn {
          gap: 6px;
        }

        /* ====== GALLERY BUNDLES GRID ====== */
        .bundles-grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        .bundle-card-item {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px;
          border-radius: 20px;
          background: rgba(18, 20, 30, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .bundle-card-item:hover {
          transform: translateY(-4px);
          border-color: rgba(139, 92, 246, 0.3) !important;
          box-shadow: 0 12px 30px rgba(139, 92, 246, 0.08);
        }

        .bundle-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .bundle-card-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .bundle-card-title-group h4 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
        }

        .saved-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c084fc;
          flex-shrink: 0;
        }

        .bundle-card-actions {
          display: flex;
          gap: 4px;
        }

        .action-icon-btn {
          padding: 8px;
          border-radius: 8px;
          border: none;
          background: rgba(255, 255, 255, 0.03);
          color: rgba(255, 255, 255, 0.6);
        }

        .action-icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .action-icon-btn.delete-btn {
          color: var(--accent-red);
        }

        .action-icon-btn.delete-btn:hover {
          background: rgba(244, 63, 94, 0.1);
          color: #fca5a5;
        }

        /* ── Slots Summary Card Style ── */
        .bundle-card-slots {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.88rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          padding: 14px;
          border-radius: 12px;
        }

        .bundle-card-slot-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .slot-emoji-label {
          flex-shrink: 0;
        }

        .slot-recipe-title {
          color: #fff;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
        }

        /* ── Macros Chips ── */
        .bundle-card-macros {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .macro-chip {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 8px;
        }

        .cal-chip {
          background: rgba(251, 191, 36, 0.08);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.15);
        }

        .prot-chip {
          background: rgba(139, 92, 246, 0.08);
          color: #c084fc;
          border: 1px solid rgba(139, 92, 246, 0.15);
        }

        .carb-chip {
          background: rgba(6, 182, 212, 0.08);
          color: #22d3ee;
          border: 1px solid rgba(6, 182, 212, 0.15);
        }

        .fat-chip {
          background: rgba(244, 63, 94, 0.08);
          color: #fca5a5;
          border: 1px solid rgba(244, 63, 94, 0.15);
        }

        /* ── Apply Actions ── */
        .bundle-card-apply-row {
          display: flex;
          gap: 10px;
          align-items: center;
          marginTop: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: 14px;
        }

        .bundle-date-input-container {
          flex: 1;
          position: relative;
        }

        .bundle-date-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
        }

        .bundle-date-input {
          width: 100%;
          padding: 10px 10px 10px 34px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 0.85rem;
          outline: none;
          font-family: var(--font-family);
          transition: var(--transition-smooth);
        }

        .bundle-date-input:focus {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.04);
        }

        .apply-btn {
          padding: 10px 20px;
          font-size: 0.85rem;
          border-radius: 10px;
        }

        /* ====== MODAL BACKDROP & BOX ====== */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(5, 5, 8, 0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          animation: fadeIn 0.25s ease-out;
        }

        .modal-content.bundle-composer-modal {
          width: 100%;
          max-width: 650px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          padding: 0 !important;
          background: rgba(14, 16, 24, 0.98) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 24px !important;
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7);
          overflow: hidden;
        }

        .modal-header {
          padding: 24px 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.01);
        }

        .modal-badge {
          margin-bottom: 6px;
        }

        .modal-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          color: #fff;
        }

        .close-modal-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-smooth);
          padding: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-modal-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        /* ── Detail Body Scrollable Form ── */
        .bundle-composer-modal .detail-body {
          flex: 1;
          overflow-y: auto;
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .bundle-composer-modal .detail-body::-webkit-scrollbar {
          width: 6px;
        }

        .bundle-composer-modal .detail-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 10px;
        }

        .bundle-composer-modal .detail-body::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }

        /* ── Error Banner ── */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(244, 63, 94, 0.12);
          color: #fecdd3;
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 14px;
          font-size: 0.9rem;
        }

        /* ── Detail Section ── */
        .detail-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .detail-section-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
          border-left: 3px solid var(--primary);
          padding-left: 12px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .bundle-name-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 0.95rem;
          outline: none;
          transition: var(--transition-smooth);
        }

        .bundle-name-input:focus {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 0 4px var(--primary-glow);
        }

        /* ── Macro Strip ── */
        .macro-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .macro-strip-item {
          padding: 16px 12px;
          border-radius: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: all 0.25s ease;
        }

        .macro-strip-item.calories-accent {
          background: rgba(251, 191, 36, 0.04);
          border: 1px solid rgba(251, 191, 36, 0.1);
        }
        .macro-strip-item.protein-accent {
          background: rgba(139, 92, 246, 0.04);
          border: 1px solid rgba(139, 92, 246, 0.1);
        }
        .macro-strip-item.carbs-accent {
          background: rgba(6, 182, 212, 0.04);
          border: 1px solid rgba(6, 182, 212, 0.1);
        }
        .macro-strip-item.fat-accent {
          background: rgba(244, 63, 94, 0.04);
          border: 1px solid rgba(244, 63, 94, 0.1);
        }

        .macro-strip-val {
          font-size: 1.3rem;
          font-weight: 800;
          color: #fff;
        }

        .macro-strip-lbl {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
        }

        /* ── Slots Form Section ── */
        .bundle-form-slots-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 10px;
        }

        .bundle-form-slot-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 14px;
          padding: 16px;
          transition: var(--transition-smooth);
        }

        .bundle-form-slot-row:focus-within {
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .bundle-slot-label {
          font-weight: 700;
          font-size: 0.9rem;
          color: #fff;
          letter-spacing: -0.01em;
        }

        .bundle-slot-empty-preview {
          font-size: 0.82rem;
          color: var(--text-muted);
          font-style: italic;
          padding: 4px 0 0;
        }

        .bundle-slot-mini-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 8px 12px;
          margin-top: 4px;
          animation: fadeIn 0.2s ease-out;
        }

        .slot-mini-img {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .slot-mini-info {
          flex: 1;
          min-width: 0;
        }

        .slot-mini-info h5 {
          margin: 0 0 3px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .slot-mini-macros {
          margin: 0;
          font-size: 0.72rem;
          color: var(--text-muted);
          display: flex;
          gap: 8px;
        }

        /* ── Modal Footer ── */
        .modal-footer {
          padding: 20px 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          background: rgba(10, 11, 18, 0.4);
        }

        .modal-cancel-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 0.9rem;
        }

        .modal-save-btn {
          padding: 10px 24px;
          border-radius: 10px;
          font-size: 0.9rem;
        }

        /* ── Animations ── */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.9) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }

        /* ── Floating Toast ── */
        .mp-toast {
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
          animation: mpToastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes mpToastIn {
          from {
            opacity: 0;
            transform: translateX(30px) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0);
          }
        }

        /* ── AI Assistant Card ── */
        .ai-assistant-section-wrap {
          margin-top: 15px;
        }

        .ai-assistant-card {
          padding: 16px 20px;
          background: rgba(139, 92, 246, 0.03);
          border: 1px solid rgba(139, 92, 246, 0.15) !important;
          border-radius: 14px;
          box-shadow: 0 4px 24px rgba(139, 92, 246, 0.03);
          position: relative;
          overflow: hidden;
        }

        .ai-assistant-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 3px;
          height: 100%;
          background: linear-gradient(to bottom, #a78bfa, #8b5cf6);
        }

        .ai-assistant-header {
          margin-bottom: 12px;
        }

        .ai-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
          font-weight: 700;
          color: #c084fc;
        }

        .sparkle-icon {
          color: #c084fc;
          animation: sparklePulse 2s infinite ease-in-out;
        }

        @keyframes sparklePulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 4px #c084fc); }
        }

        .ai-header-desc {
          margin: 4px 0 0;
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .ai-assistant-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .ai-opt-btn, .ai-gen-btn {
          padding: 8px 16px;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          font-family: var(--font-family);
          transition: all 0.2s ease;
        }

        .ai-opt-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.9);
        }

        .ai-opt-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .ai-gen-btn {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #fff;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
        }

        .ai-gen-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
        }

        .ai-opt-btn:disabled, .ai-gen-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-feedback-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          padding: 10px 14px;
        }

        .ai-feedback-text {
          margin: 0;
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.45;
          font-style: italic;
        }

        /* ── Responsive adjustments ── */
        @media (max-width: 992px) {
          .gallery-header-section {
            padding: 20px 20px 14px !important;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 14px;
          }
          .title-row h1 {
            font-size: 1.55rem !important;
          }
          .gallery-body-section {
            padding: 16px 20px !important;
          }
          .bundles-grid-layout {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .macro-strip {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .macro-strip-item {
            padding: 10px;
            border-radius: 10px;
          }
          .macro-strip-val {
            font-size: 1.1rem;
          }
          .macro-strip-lbl {
            font-size: 0.65rem;
          }
        }
      `}</style>
    </div>
  )
}
