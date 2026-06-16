import React, { useState, useEffect } from 'react'
import { Sparkles, UtensilsCrossed, Calendar, Check, BookOpen, ChevronRight, ChevronLeft, X, Trash2, ShieldAlert, Plus, RefreshCw, Search } from 'lucide-react'
import CustomSelect from '../components/CustomSelect.jsx'

function MarkdownRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const renderedElements = [];

  let currentList = [];
  let currentListType = null; // 'ul' | 'ol' | null

  const flushList = (keyPrefix) => {
    if (currentList.length === 0) return;

    if (currentListType === 'ul') {
      renderedElements.push(
        <ul key={`${keyPrefix}-ul`} className="markdown-ul">
          {currentList.map((item, index) => (
            <li key={index} className="markdown-li">{renderInline(item)}</li>
          ))}
        </ul>
      );
    } else if (currentListType === 'ol') {
      renderedElements.push(
        <ol key={`${keyPrefix}-ol`} className="markdown-ol">
          {currentList.map((item, index) => (
            <li key={index} className="markdown-ol-li">
              <span className="step-num">{index + 1}</span>
              <div className="step-content-text">{renderInline(item)}</div>
            </li>
          ))}
        </ol>
      );
    }

    currentList = [];
    currentListType = null;
  };

  const renderInline = (str) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index}>{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }

    return parts;
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(lineIdx);
      return;
    }

    // Headers
    if (trimmed.startsWith('###')) {
      flushList(lineIdx);
      renderedElements.push(
        <h4 key={lineIdx} className="markdown-h4">
          {renderInline(trimmed.replace(/^###\s*/, ''))}
        </h4>
      );
    } else if (trimmed.startsWith('##')) {
      flushList(lineIdx);
      renderedElements.push(
        <h3 key={lineIdx} className="markdown-h3">
          {renderInline(trimmed.replace(/^##\s*/, ''))}
        </h3>
      );
    } else if (trimmed.startsWith('#')) {
      flushList(lineIdx);
      renderedElements.push(
        <h2 key={lineIdx} className="markdown-h2">
          {renderInline(trimmed.replace(/^#\s*/, ''))}
        </h2>
      );
    }
    // Unordered List (- or *)
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentListType !== 'ul') {
        flushList(lineIdx);
        currentListType = 'ul';
      }
      currentList.push(trimmed.replace(/^[-*]\s*/, ''));
    }
    // Ordered List (1. or 2. etc)
    else if (/^\d+\.\s+/.test(trimmed)) {
      if (currentListType !== 'ol') {
        flushList(lineIdx);
        currentListType = 'ol';
      }
      currentList.push(trimmed.replace(/^\d+\.\s+/, ''));
    }
    // Plain Paragraph
    else {
      flushList(lineIdx);
      renderedElements.push(
        <p key={lineIdx} className="markdown-p">
          {renderInline(trimmed)}
        </p>
      );
    }
  });

  flushList('final');

  return <div className="markdown-body">{renderedElements}</div>;
}

export default function MealPlanner({ token, onLogout }) {
  // Wizard & Generation States
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(1) // 1: MealType, 2: Exclusions, 3: Cravings, 4: Review, 5: Result
  const [mealType, setMealType] = useState('lunch')
  const [servings, setServings] = useState(2)
  const [excludedItems, setExcludedItems] = useState([])
  const [cravings, setCravings] = useState('')
  const [generatedRecipe, setGeneratedRecipe] = useState(null)

  // Library & Data States
  const [pantryItems, setPantryItems] = useState([])
  const [savedRecipes, setSavedRecipes] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLibraryRecipe, setSelectedLibraryRecipe] = useState(null)
  const [profile, setProfile] = useState(null)

  // Feedback states
  const [loading, setLoading] = useState(false)
  const [loadingStepText, setLoadingStepText] = useState('')
  const [error, setError] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [logSuccess, setLogSuccess] = useState(false)
  const [logMealType, setLogMealType] = useState('lunch')
  const [filterMealType, setFilterMealType] = useState('all')
  const [generatingImage, setGeneratingImage] = useState(false)

  useEffect(() => {
    fetchSavedRecipes()
    fetchPantry()
    fetchUserProfile()
  }, [token])

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/auth/user/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile || {})
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
    }
  }

  // Pre-select the dropdown option to match the recipe's saved meal type
  useEffect(() => {
    if (selectedLibraryRecipe && selectedLibraryRecipe.meal_type) {
      setLogMealType(selectedLibraryRecipe.meal_type)
    }
  }, [selectedLibraryRecipe])

  const fetchPantry = async () => {
    try {
      const res = await fetch('/api/pantry/', {
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }
      const data = await res.json()
      // Only show items marked as "available" in the wizard
      const availableItems = Array.isArray(data) ? data.filter(item => item.available !== false) : []
      setPantryItems(availableItems)
    } catch (err) {
      console.error('Failed to fetch pantry items for exclusion list', err)
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
      console.error('Failed to fetch recipe library', err)
    }
  }

  const toggleExcludeItem = (itemName) => {
    if (excludedItems.includes(itemName)) {
      setExcludedItems(excludedItems.filter(item => item !== itemName))
    } else {
      setExcludedItems([...excludedItems, itemName])
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setGeneratedRecipe(null)
    setSavedSuccess(false)
    setLogSuccess(false)
    setStep(0) // 0 represents active loading state in the modal

    const steps = [
      'Scouting virtual pantry shelves...',
      'Filtering out excluded ingredients...',
      'Injecting goal nutrition profile...',
      'Hashing custom cravings and preferences...',
      'Gemini AI Chef is composing recipe...'
    ]
    let currentStepIdx = 0
    setLoadingStepText(steps[0])
    const interval = setInterval(() => {
      currentStepIdx++
      if (currentStepIdx < steps.length) {
        setLoadingStepText(steps[currentStepIdx])
      }
    }, 1200)

    try {
      const res = await fetch('/api/meals/generate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meal_type: mealType,
          excluded_items: excludedItems,
          preferences: cravings,
          servings: servings
        })
      })

      if (res.status === 401) {
        clearInterval(interval)
        if (onLogout) onLogout()
        return
      }

      const data = await res.json()
      clearInterval(interval)

      if (res.ok) {
        setGeneratedRecipe(data)
        setStep(6) // Show recipe details step
      } else {
        setError(data.error || 'Failed to generate recipe. Try updating details and generating again.')
        setStep(5) // Go back to review step
      }
    } catch (err) {
      clearInterval(interval)
      setError('Connection failed. Please verify that server is running.')
      setStep(5)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToFavorites = async (recipeObj) => {
    if (!recipeObj) return
    setError('')

    try {
      const res = await fetch('/api/recipes/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipe_title: recipeObj.recipe_title,
          recipe_description: recipeObj.recipe_description,
          ingredients_used: recipeObj.ingredients_used,
          calories: recipeObj.calories,
          protein: recipeObj.protein,
          carbs: recipeObj.carbs,
          fat: recipeObj.fat,
          servings: recipeObj.servings || servings,
          meal_type: recipeObj.meal_type || mealType,
          image_data: recipeObj.image_data || null
        })
      })

      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }

      if (res.ok) {
        setSavedSuccess(true)
        fetchSavedRecipes() // refresh library list
      } else {
        setError('Failed to bookmark recipe to favorites.')
      }
    } catch (err) {
      setError('Bookmark action failed.')
    }
  }

  const handleLogMeal = async (recipeObj, type = mealType) => {
    if (!recipeObj) return
    setError('')
    console.log('[handleLogMeal] Logging meal:', recipeObj.recipe_title, 'as', type)

    try {
      const d = new Date()
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const payload = {
        date: todayStr,
        meal_type: type,
        recipe_title: recipeObj.recipe_title,
        recipe_description: recipeObj.recipe_description || 'No description provided.',
        ingredients_used: recipeObj.ingredients_used || '',
        calories: recipeObj.calories,
        protein: recipeObj.protein,
        carbs: recipeObj.carbs,
        fat: recipeObj.fat,
        prepared: false,
        servings: recipeObj.servings || servings,
        image_data: recipeObj.image_data || null
      }
      console.log('[handleLogMeal] POST payload:', JSON.stringify(payload).substring(0, 300))
      const res = await fetch('/api/meals/', {
        method: 'POST',
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
        console.log('[handleLogMeal] Meal logged successfully!')
        setLogSuccess(true)
        setTimeout(() => setLogSuccess(false), 3500)
      } else {
        const errData = await res.text()
        console.error('[handleLogMeal] Failed:', res.status, errData)
        setError('Failed to log meal to Dashboard.')
      }
    } catch (err) {
      console.error('[handleLogMeal] Error:', err)
      setError('Save operation encountered an error.')
    }
  }

  const handleGenerateLibraryImage = async () => {
    if (!selectedLibraryRecipe) return
    console.log('Generating image for:', selectedLibraryRecipe.recipe_title)
    setGeneratingImage(true)
    setError('')

    try {
      const res = await fetch('/api/meals/generate-image/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          dish_name: selectedLibraryRecipe.recipe_title,
          ingredients: selectedLibraryRecipe.ingredients_used
        })
      })

      console.log('Generate image response status:', res.status)
      if (res.ok) {
        const data = await res.json()
        const imageBase64 = data.image_data
        console.log('Image generated successfully, base64 length:', imageBase64?.length)

        // Save image to the database via PATCH
        console.log('Saving image to recipe ID:', selectedLibraryRecipe.id)
        const updateRes = await fetch(`/api/recipes/${selectedLibraryRecipe.id}/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ image_data: imageBase64 })
        })

        console.log('PATCH response status:', updateRes.status)
        if (updateRes.ok) {
          const updatedRecipe = { ...selectedLibraryRecipe, image_data: imageBase64 }
          setSelectedLibraryRecipe(updatedRecipe)
          setSavedRecipes(savedRecipes.map(r => r.id === selectedLibraryRecipe.id ? updatedRecipe : r))
          console.log('Recipe updated successfully in state!')
        } else {
          const errText = await updateRes.text()
          console.error('PATCH failed:', errText)
          setError('Failed to persist generated image: ' + errText)
        }
      } else {
        const errText = await res.text()
        console.error('Generate image API failed:', errText)
        setError('Failed to generate AI image representation: ' + errText)
      }
    } catch (err) {
      console.error('Error in handleGenerateLibraryImage:', err)
      setError('Image generation failed: ' + err.message)
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleDeleteLibraryImage = async () => {
    if (!selectedLibraryRecipe) return
    setError('')
    try {
      const res = await fetch(`/api/recipes/${selectedLibraryRecipe.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_data: null })
      })
      if (res.ok) {
        const updatedRecipe = { ...selectedLibraryRecipe, image_data: null }
        setSelectedLibraryRecipe(updatedRecipe)
        setSavedRecipes(savedRecipes.map(r => r.id === selectedLibraryRecipe.id ? updatedRecipe : r))
        console.log('Library image removed successfully from database and state!')
      } else {
        const text = await res.text()
        setError('Failed to delete library image: ' + text)
      }
    } catch (err) {
      setError('Delete library image action failed: ' + err.message)
    }
  }

  const handleGenerateWizardImage = async () => {
    if (!generatedRecipe) return
    console.log('Generating wizard image for:', generatedRecipe.recipe_title)
    setGeneratingImage(true)
    setError('')
    const oldUrl = generatedRecipe.image_data

    try {
      const res = await fetch('/api/meals/generate-image/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          dish_name: generatedRecipe.recipe_title,
          ingredients: generatedRecipe.ingredients_used
        })
      })

      console.log('Generate wizard image response status:', res.status)
      if (res.ok) {
        const data = await res.json()
        
        // Clean up old temporary image to prevent orphans
        if (oldUrl && oldUrl.startsWith('/media/')) {
          try {
            await fetch('/api/meals/delete-image/', {
              method: 'POST',
              headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ image_url: oldUrl })
            })
          } catch (e) {
            console.error('Failed to delete old temporary image:', e)
          }
        }

        console.log('Wizard image generated, length:', data.image_data?.length)
        setGeneratedRecipe({ ...generatedRecipe, image_data: data.image_data })
      } else {
        const errText = await res.text()
        console.error('Generate wizard image API failed:', errText)
        setError('Failed to generate AI image representation: ' + errText)
      }
    } catch (err) {
      console.error('Error in handleGenerateWizardImage:', err)
      setError('Image generation failed: ' + err.message)
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleDeleteWizardImage = async () => {
    if (!generatedRecipe || !generatedRecipe.image_data) return
    setError('')
    const oldUrl = generatedRecipe.image_data
    try {
      if (oldUrl.startsWith('/media/')) {
        await fetch('/api/meals/delete-image/', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ image_url: oldUrl })
        })
      }
      setGeneratedRecipe({ ...generatedRecipe, image_data: null })
      console.log('Wizard image cleared from state!')
    } catch (err) {
      setError('Delete wizard image action failed: ' + err.message)
    }
  }

  const handleDeleteSavedRecipe = async (recipeId, e) => {
    e.stopPropagation() // prevent opening card details
    try {
      const res = await fetch(`/api/recipes/${recipeId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      })
      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }
      if (res.ok) {
        setSavedRecipes(savedRecipes.filter(r => r.id !== recipeId))
        if (selectedLibraryRecipe?.id === recipeId) {
          setSelectedLibraryRecipe(null)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const openWizard = () => {
    setStep(1)
    setExcludedItems([])
    setCravings('')
    setServings(2)
    setGeneratedRecipe(null)
    setSavedSuccess(false)
    setLogSuccess(false)
    setError('')
    setWizardOpen(true)
    fetchPantry() // load fresh pantry items
  }

  const filteredRecipes = savedRecipes
    .filter(r => filterMealType === 'all' || r.meal_type === filterMealType)
    .filter(r => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        r.recipe_title.toLowerCase().includes(query) ||
        (r.recipe_description && r.recipe_description.toLowerCase().includes(query)) ||
        (r.ingredients_used && r.ingredients_used.toLowerCase().includes(query))
      );
    });

  return (
    <div className="meal-planner-page">
      {/* Floating Toast for Eat & Log */}
      {logSuccess && (
        <div className="mp-toast">
          <Check size={18} />
          <span>Meal logged to your Dashboard!</span>
        </div>
      )}

      {/* ============ SPLIT DUAL SCREEN LAYOUT ============ */}
      <div className={`dual-screen-container ${selectedLibraryRecipe ? 'recipe-selected' : ''}`}>

        {/* ───── LEFT PANEL: Recipe Library ───── */}
        <div className="dual-panel left-panel">
          <div className="panel-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="panel-header-text">
                <h2>Recipe Library</h2>
                <p>Your saved AI-generated recipes</p>
              </div>
              <span className="recipe-count-badge">
                {searchQuery || filterMealType !== 'all' ? `${filteredRecipes.length} shown` : `${savedRecipes.length} saved`}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  type="text"
                  placeholder="Search recipe name or ingredients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  className="recipe-search-input"
                />
              </div>
              <div style={{ width: '100%' }}>
                <CustomSelect
                  id="library-filter-select"
                  options={[
                    { value: 'all', label: 'All Meals' },
                    { value: 'breakfast', label: '🍳 Breakfast' },
                    { value: 'lunch', label: '🥗 Lunch' },
                    { value: 'dinner', label: '🥩 Dinner' },
                    { value: 'snack', label: '🍎 Snack' }
                  ]}
                  value={filterMealType}
                  onChange={(val) => setFilterMealType(val)}
                  placeholder="Filter by meal type..."
                />
              </div>
            </div>
          </div>

          <div className="panel-body">
            {savedRecipes.length === 0 ? (
              <div className="empty-library-state">
                <div className="empty-icon-wrapper">
                  <BookOpen size={42} />
                </div>
                <h3>No Recipes Yet</h3>
                <p>Launch the AI Prep Wizard to generate personalized recipes and bookmark them here.</p>
                <button onClick={openWizard} className="btn btn-primary" style={{ marginTop: '10px' }}>
                  <Sparkles size={16} /> Start AI Wizard
                </button>
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="empty-library-state">
                <div className="empty-icon-wrapper">
                  <BookOpen size={42} />
                </div>
                <h3>No Matches Found</h3>
                <p>Try searching for a different keyword or checking your filters.</p>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="btn btn-secondary" style={{ marginTop: '10px' }}>
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="saved-recipes-shelf">
                {filteredRecipes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedLibraryRecipe(r)}
                    className={`saved-recipe-card ${selectedLibraryRecipe?.id === r.id ? 'active-recipe' : ''}`}
                  >
                    <div className="saved-card-icon">
                      <UtensilsCrossed size={18} />
                    </div>
                    <div className="saved-card-brief">
                      <h4>{r.recipe_title}</h4>
                      <p className="saved-card-macros">
                        <span className="macro-chip">{r.calories} kcal</span>
                        <span className="macro-chip">P: {r.protein}g</span>
                        <span className="macro-chip">C: {r.carbs}g</span>
                        <span className="macro-chip">F: {r.fat}g</span>
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSavedRecipe(r.id, e)}
                      className="trash-recipe-btn"
                      title="Remove Bookmark"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-footer">
            <button onClick={openWizard} className="btn btn-primary wizard-launch-btn">
              <Sparkles size={18} /> Start AI Prep Wizard
            </button>
          </div>
        </div>

        {/* ───── CENTER DIVIDER ───── */}
        <div className="dual-divider">
          <div className="divider-line" />
        </div>

        {/* ───── RIGHT PANEL: Recipe Detail Viewer ───── */}
        <div className="dual-panel right-panel">
          {!selectedLibraryRecipe ? (
            <div className="detail-empty-state">
              <div className="empty-icon-wrapper large">
                <UtensilsCrossed size={48} />
              </div>
              <h2>Select a Recipe</h2>
              <p>Click any recipe from your library to view its full preparation details, ingredients, macros, and step-by-step instructions.</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="detail-header">
                <div className="detail-header-left">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="badge badge-secondary">Saved Recipe</span>
                    <span className="badge badge-secondary">Serves {selectedLibraryRecipe.servings || 2}</span>
                  </div>
                  <h2>{selectedLibraryRecipe.recipe_title}</h2>
                </div>
                <div className="detail-header-actions">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '160px' }}>
                      <CustomSelect
                        id="log-meal-type-select"
                        options={[
                          { value: 'breakfast', label: '🍳 Breakfast' },
                          { value: 'lunch', label: '🥗 Lunch' },
                          { value: 'dinner', label: '🥩 Dinner' },
                          { value: 'snack', label: '🍎 Snack' }
                        ]}
                        value={logMealType}
                        onChange={(val) => setLogMealType(val)}
                      />
                    </div>
                    <button
                      onClick={() => handleLogMeal(selectedLibraryRecipe, logMealType)}
                      disabled={logSuccess}
                      className={`btn ${logSuccess ? 'btn-secondary' : 'btn-primary'}`}
                    >
                      {logSuccess ? <><Check size={16} /> Logged</> : <><Plus size={16} /> Add Meal</>}
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedLibraryRecipe(null)}
                    className="btn btn-secondary"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Detail Body */}
              <div className="detail-body">

                {error && (
                  <div className="error-banner" style={{ marginBottom: '15px' }}>
                    <ShieldAlert size={20} />
                    <span>{error}</span>
                  </div>
                )}

                {selectedLibraryRecipe.image_data ? (
                  <div className="recipe-image-container">
                    <img src={selectedLibraryRecipe.image_data} alt={selectedLibraryRecipe.recipe_title} className="recipe-img" />
                    <div className="recipe-image-actions">
                      <button
                        onClick={handleGenerateLibraryImage}
                        disabled={generatingImage}
                        className="btn btn-secondary btn-image-action"
                        title="Regenerate Image"
                      >
                        <RefreshCw size={14} className={generatingImage ? 'animate-spin' : ''} />
                        <span>Regenerate</span>
                      </button>
                      <button
                        onClick={handleDeleteLibraryImage}
                        className="btn btn-secondary btn-image-action btn-danger"
                        title="Delete Image"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ) : generatingImage ? (
                  <div className="recipe-image-container skeleton">
                    <div className="image-skeleton-loader">
                      <div className="loader-shimmer"></div>
                      <div className="loader-content">
                        <Sparkles className="animate-pulse" size={32} style={{ color: 'var(--text-accent, #3b82f6)' }} />
                        <span>Creating culinary artwork...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="generate-image-placeholder">
                    <p>No culinary artwork representation generated yet.</p>
                    <button
                      onClick={handleGenerateLibraryImage}
                      className="btn btn-secondary btn-image-gen"
                    >
                      🎨 Generate AI Representation
                    </button>
                  </div>
                )}

                {/* Macro Summary Strip */}
                <div className="macro-strip">
                  <div className="macro-strip-item calories-accent">
                    <span className="macro-strip-val">{selectedLibraryRecipe.calories}</span>
                    <span className="macro-strip-lbl">Calories</span>
                  </div>
                  <div className="macro-strip-item protein-accent">
                    <span className="macro-strip-val">{selectedLibraryRecipe.protein}g</span>
                    <span className="macro-strip-lbl">Protein</span>
                  </div>
                  <div className="macro-strip-item carbs-accent">
                    <span className="macro-strip-val">{selectedLibraryRecipe.carbs}g</span>
                    <span className="macro-strip-lbl">Carbs</span>
                  </div>
                  <div className="macro-strip-item fat-accent">
                    <span className="macro-strip-val">{selectedLibraryRecipe.fat}g</span>
                    <span className="macro-strip-lbl">Fat</span>
                  </div>
                </div>

                {/* Ingredients */}
                <div className="detail-section">
                  <h3 className="detail-section-title">Pantry Ingredients Used</h3>
                  <div className="ingredients-chips">
                    {(selectedLibraryRecipe.ingredients_used || 'Standard pantry basics').split(',').map((item, i) => (
                      <span key={i} className="ingredient-chip">{item.trim()}</span>
                    ))}
                  </div>
                </div>

                {/* Recipe Markdown */}
                <div className="detail-section">
                  <h3 className="detail-section-title">Full Recipe</h3>
                  <div className="detail-recipe-body">
                    <MarkdownRenderer text={selectedLibraryRecipe.recipe_description} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Advanced Step-by-Step Modal Wizard */}
      {wizardOpen && (
        <div className="modal-backdrop" onClick={() => setWizardOpen(false)}>
          <div className="modal-content glass-card wizard-modal fullscreen-wizard" onClick={(e) => e.stopPropagation()}>

            {/* Split Sidebar & Main Pane */}
            <div className="wizard-split-layout">
              {/* Stepper Sidebar */}
              <div className="wizard-sidebar">
                <div className="wizard-brand">
                  <div className="wizard-brand-left">
                    <div className="chef-icon-container">
                      <Sparkles size={22} color="#a78bfa" />
                    </div>
                    <h3>AuraFit Chef</h3>
                  </div>
                  {step > 0 && step < 6 && (
                    <span className="wizard-brand-step-indicator">
                      Step {step} of 5
                    </span>
                  )}
                </div>
                <div className="stepper-steps">
                  <div
                    className={`stepper-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}
                    onClick={() => step > 0 && step < 6 && setStep(1)}
                  >
                    <div className="step-badge">{step > 1 ? <Check size={14} /> : '1'}</div>
                    <div className="step-info">
                      <span className="step-title">Meal Target</span>
                      <span className="step-desc">Pick target meal type</span>
                    </div>
                  </div>
                  <div
                    className={`stepper-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}
                    onClick={() => step > 0 && step < 6 && setStep(2)}
                  >
                    <div className="step-badge">{step > 2 ? <Check size={14} /> : '2'}</div>
                    <div className="step-info">
                      <span className="step-title">Servings</span>
                      <span className="step-desc">Set portion size</span>
                    </div>
                  </div>
                  <div
                    className={`stepper-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}
                    onClick={() => step > 0 && step < 6 && setStep(3)}
                  >
                    <div className="step-badge">{step > 3 ? <Check size={14} /> : '3'}</div>
                    <div className="step-info">
                      <span className="step-title">Pantry Exclusions</span>
                      <span className="step-desc">Filter active ingredients</span>
                    </div>
                  </div>
                  <div
                    className={`stepper-step ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}
                    onClick={() => step > 0 && step < 6 && setStep(4)}
                  >
                    <div className="step-badge">{step > 4 ? <Check size={14} /> : '4'}</div>
                    <div className="step-info">
                      <span className="step-title">Active Cravings</span>
                      <span className="step-desc">Any specific cravings</span>
                    </div>
                  </div>
                  <div
                    className={`stepper-step ${step === 5 ? 'active' : step > 5 ? 'completed' : ''}`}
                    onClick={() => step > 0 && step < 6 && setStep(5)}
                  >
                    <div className="step-badge">{step > 5 ? <Check size={14} /> : '5'}</div>
                    <div className="step-info">
                      <span className="step-title">Review Selections</span>
                      <span className="step-desc">Launch Gemini generator</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="wizard-main-area">
                {/* Modal Header */}
                <div className="modal-header">
                  <div>
                    <span className="step-indicator">
                      {step === 0 ? 'Chef is cooking' : step === 6 ? 'Chef Masterpiece' : `Step ${step} of 5`}
                    </span>
                    <h2>
                      {step === 0 ? 'Gemini Chef is Thinking...' : step === 6 ? 'Your Generated AI Recipe' :
                        step === 1 ? 'Which meal are we preparing?' :
                          step === 2 ? 'How many servings?' :
                            step === 3 ? 'Any ingredients to exclude?' :
                              step === 4 ? 'What are you craving today?' : 'Double check your selections'}
                    </h2>
                  </div>
                  {profile?.allergies && (
                    <div className="header-allergies-indicator">
                      <span className="allergies-lbl">⚠️ Restrictions:</span>
                      <span className="allergies-val">{profile.allergies}</span>
                    </div>
                  )}
                  <button className="close-modal-btn" onClick={() => setWizardOpen(false)}>
                    <X size={24} />
                  </button>
                </div>

                {error && (
                  <div className="error-banner" style={{ marginBottom: '15px' }}>
                    <ShieldAlert size={20} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Step Content */}
                <div className="wizard-step-body">
                  {/* Loader View */}
                  {step === 0 && (() => {
                    const phases = [
                      { text: 'Scouting Pantry Ingredients', match: 'Scouting' },
                      { text: 'Filtering Excluded Items', match: 'Filtering' },
                      { text: 'Balancing Macro-Nutrient Profile', match: 'Injecting' },
                      { text: 'Gemini AI Chef Composing Recipe', match: 'composing' }
                    ];

                    let activeIndex = 0;
                    if (loadingStepText?.includes('Filtering')) activeIndex = 1;
                    else if (loadingStepText?.includes('Injecting')) activeIndex = 2;
                    else if (loadingStepText?.includes('Hashing') || loadingStepText?.includes('composing') || loadingStepText?.includes('Chef')) activeIndex = 3;

                    return (
                      <div className="wizard-loader-state">
                        {/* Glowing Heat Ring & Cloche Platter */}
                        <div className="culinary-loader-container">
                          <div className="cloche-glow-ring"></div>
                          
                          {/* Animated Steam Curves */}
                          <div className="steam-container">
                            <svg className="steam-svg" viewBox="0 0 100 50">
                              <path className="steam-path steam-path-1" d="M30,50 Q25,35 30,20 T25,0" />
                              <path className="steam-path steam-path-2" d="M50,50 Q55,35 50,20 T55,0" />
                              <path className="steam-path steam-path-3" d="M70,50 Q65,35 70,20 T65,0" />
                            </svg>
                          </div>

                          {/* Serving Cloche Dome */}
                          <div className="cloche-dome-wrapper">
                            <div className="cloche-handle"></div>
                            <div className="cloche-dome"></div>
                            <div className="cloche-platter"></div>
                          </div>
                        </div>

                        {/* Title and Active Progress Subtitle */}
                        <div className="loader-header-text">
                          <h3>Chef is crafting your menu...</h3>
                          <p className="loading-step-subtitle">{loadingStepText}</p>
                        </div>

                        {/* Progress Dashboard Checklist */}
                        <div className="loader-progress-dashboard">
                          {phases.map((phase, idx) => {
                            const isCompleted = idx < activeIndex;
                            const isActive = idx === activeIndex;
                            const isWaiting = idx > activeIndex;

                            return (
                              <div
                                key={idx}
                                className={`progress-phase-item ${isCompleted ? 'completed' : isActive ? 'active' : 'waiting'}`}
                              >
                                <div className="phase-indicator">
                                  {isCompleted ? (
                                    <Check size={12} className="phase-check-icon" />
                                  ) : isActive ? (
                                    <div className="phase-active-pulse"></div>
                                  ) : (
                                    <div className="phase-waiting-dot"></div>
                                  )}
                                </div>
                                <span className="phase-text">{phase.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Form step 1: Meal Type */}
                  {step === 1 && (
                    <div className="step-content">
                      <p className="step-help-text">Choose the target meal category. The AI will curate suitable serving sizes and macronutrients based on this selection.</p>

                      <div className="meal-target-cards-grid">
                        {[
                          { value: 'breakfast', label: 'Breakfast', icon: '🍳', desc: 'Light, energizing morning starts' },
                          { value: 'lunch', label: 'Lunch', icon: '🥗', desc: 'Balanced mid-day nourishment' },
                          { value: 'dinner', label: 'Dinner', icon: '🥩', desc: 'Hearty, satisfying dinner plates' },
                          { value: 'snack', label: 'Snack', icon: '🍎', desc: 'Quick snacks to keep active' }
                        ].map(item => (
                          <div
                            key={item.value}
                            onClick={() => setMealType(item.value)}
                            className={`meal-target-item-card ${mealType === item.value ? 'selected' : ''}`}
                          >
                            <span className="card-emoji">{item.icon}</span>
                            <div className="card-meta">
                              <h4>{item.label}</h4>
                              <p>{item.desc}</p>
                            </div>
                            <div className="selection-dot"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Form step 2: Servings */}
                  {step === 2 && (
                    <div className="step-content">
                      <p className="step-help-text">Select how many servings this recipe should yield.</p>

                      {/* Servings Selector */}
                      <div className="servings-section">
                        <h4 className="servings-title">Number of Servings</h4>
                        <div className="servings-chips">
                          {[
                            { value: 1, label: 'Solo', icon: '🧑', desc: '1 serving' },
                            { value: 2, label: 'Pair', icon: '👫', desc: '2 servings' },
                            { value: 4, label: 'Family', icon: '👨‍👩‍👧‍👦', desc: '4 servings' },
                            { value: 6, label: 'Gathering', icon: '🎉', desc: '6 servings' },
                          ].map(s => (
                            <div
                              key={s.value}
                              onClick={() => setServings(s.value)}
                              className={`serving-chip ${servings === s.value ? 'selected' : ''}`}
                            >
                              <span className="serving-chip-icon">{s.icon}</span>
                              <span className="serving-chip-label">{s.label}</span>
                              <span className="serving-chip-desc">{s.desc}</span>
                            </div>
                          ))}
                        </div>
                        <div className="servings-custom">
                          <span className="servings-custom-label">Or set custom:</span>
                          <div className="servings-counter">
                            <button type="button" onClick={() => setServings(Math.max(1, servings - 1))} className="counter-btn">−</button>
                            <span className="counter-value">{servings}</span>
                            <button type="button" onClick={() => setServings(Math.min(12, servings + 1))} className="counter-btn">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form step 3: Pantry Exclusions */}
                  {step === 3 && (
                    <div className="step-content height-full-flex">
                      <p className="step-help-text">Drag or click ingredients to exclude them. The recipe generator will skip these ingredients entirely.</p>

                      {pantryItems.length === 0 ? (
                        <div className="no-items-warning">
                          <p>Your Virtual Pantry is empty! Go to <strong>"My Pantry"</strong> to list your groceries first, or continue to generate with general items.</p>
                        </div>
                      ) : (
                        <div className="split-pantry-exclusions">
                          {/* Left Panel: Available ingredients */}
                          <div className="exclusions-column available-column">
                            <div className="column-header">
                              <h4>Available in Pantry ({pantryItems.filter(item => !excludedItems.includes(item.name)).length})</h4>
                            </div>
                            <div className="column-list">
                              {pantryItems.filter(item => !excludedItems.includes(item.name)).length === 0 ? (
                                <div className="empty-column-msg">All items have been excluded.</div>
                              ) : (
                                pantryItems.filter(item => !excludedItems.includes(item.name)).map(item => (
                                  <div
                                    key={item.id}
                                    onClick={() => toggleExcludeItem(item.name)}
                                    className="exclusion-item-pill available"
                                  >
                                    <span>{item.name}</span>
                                    <span className="pill-action">+ Exclude</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Right Panel: Excluded ingredients */}
                          <div className="exclusions-column excluded-column">
                            <div className="column-header">
                              <h4>Excluded Ingredients ({excludedItems.length})</h4>
                            </div>
                            <div className="column-list">
                              {excludedItems.length === 0 ? (
                                <div className="empty-column-msg">No exclusions selected. All items will be considered.</div>
                              ) : (
                                excludedItems.map((itemName, index) => (
                                  <div
                                    key={index}
                                    onClick={() => toggleExcludeItem(itemName)}
                                    className="exclusion-item-pill excluded"
                                  >
                                    <span>{itemName}</span>
                                    <span className="pill-action">Remove ❌</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form step 4: Custom Cravings */}
                  {step === 4 && (
                    <div className="step-content">
                      <p className="step-help-text">Enter any ingredients you crave or describe the style of meal you want. The AI will weave it into your meal proposal.</p>

                      <div className="premium-cravings-panel">
                        <textarea
                          className="form-input premium-cravings-area"
                          placeholder="e.g. I crave chicken with a rich garlic sauce, maybe some roasted vegetables on the side..."
                          value={cravings}
                          onChange={(e) => setCravings(e.target.value)}
                          rows={6}
                          autoFocus
                        />
                        <div className="suggestions-tags-title">Suggested Cravings & Preferences:</div>
                        <div className="cravings-tags-cloud">
                          {[
                            { label: 'Chicken Craving 🍗', val: 'chicken' },
                            { label: 'Spicy Flavor 🌶️', val: 'spicy' },
                            { label: 'Warm & Comforting 🍜', val: 'warm comforting soup' },
                            { label: 'Low Carb / Keto 🥑', val: 'low carb keto' },
                            { label: 'High Protein 💪', val: 'high protein' },
                            { label: 'Sweet Tooth 🍓', val: 'fruity sweet' },
                            { label: 'Garlicky 🧄', val: 'extra garlic' },
                            { label: 'Cheese / Creamy 🧀', val: 'creamy cheese' }
                          ].map(tag => (
                            <button
                              key={tag.val}
                              type="button"
                              onClick={() => {
                                const current = cravings.trim()
                                setCravings(current ? `${current}, ${tag.val}` : tag.val)
                              }}
                              className="craving-suggestion-tag"
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form step 5: Review */}
                  {step === 5 && (
                    <div className="step-content">
                      <p className="step-help-text">Verify your AI meal request configuration before launching the Gemini chef:</p>

                      <div className="premium-review-container">
                        <div className="review-stat-box">
                          <div className="stat-label">Meal Type</div>
                          <div className="stat-val capitalize">
                            <span className="type-icon">
                              {mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : mealType === 'dinner' ? '🥩' : '🍎'}
                            </span>
                            {mealType}
                          </div>
                        </div>

                        <div className="review-stat-box">
                          <div className="stat-label">Excluded Ingredients</div>
                          <div className="stat-val flex-wrap">
                            {excludedItems.length > 0 ? (
                              excludedItems.map((item, idx) => (
                                <span key={idx} className="review-exclude-tag">{item}</span>
                              ))
                            ) : (
                              <span className="empty-review-text">No ingredients excluded.</span>
                            )}
                          </div>
                        </div>

                        <div className="review-stat-box">
                          <div className="stat-label">Servings</div>
                          <div className="stat-val">
                            <span className="type-icon">🍽️</span>
                            {servings} {servings === 1 ? 'serving' : 'servings'}
                          </div>
                        </div>

                        <div className="review-stat-box">
                          <div className="stat-label">Profile Allergies & Dietary Restrictions</div>
                          <div className="stat-val" style={{ color: profile?.allergies ? '#f43f5e' : 'var(--text-muted)' }}>
                            {profile?.allergies ? profile.allergies : 'No allergies or dietary restrictions saved in your profile settings.'}
                          </div>
                        </div>

                        <div className="review-stat-box full-row">
                          <div className="stat-label">Cravings & Custom Preferences</div>
                          <div className="stat-val italic">
                            {cravings ? `"${cravings}"` : 'No specific cravings entered. Generating standard recipe matches.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result View step 6 */}
                  {step === 6 && generatedRecipe && (
                    <div className="step-content height-full-flex">
                      <div className="recipe-result-split">
                        {/* Left Side: Macro Summary & Ingredients */}
                        <div className="recipe-info-panel">
                          <div className="recipe-meta-header">
                            <span className="badge badge-secondary capitalize">{mealType}</span>
                            <h3>{generatedRecipe.recipe_title}</h3>
                          </div>

                          {generatedRecipe.image_data ? (
                            <div className="recipe-image-container">
                              <img src={generatedRecipe.image_data} alt={generatedRecipe.recipe_title} className="recipe-img" />
                              <div className="recipe-image-actions">
                                <button
                                  onClick={handleGenerateWizardImage}
                                  disabled={generatingImage}
                                  className="btn btn-secondary btn-image-action"
                                  title="Regenerate Image"
                                >
                                  <RefreshCw size={14} className={generatingImage ? 'animate-spin' : ''} />
                                  <span>Regenerate</span>
                                </button>
                                <button
                                  onClick={handleDeleteWizardImage}
                                  className="btn btn-secondary btn-image-action btn-danger"
                                  title="Delete Image"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          ) : generatingImage ? (
                            <div className="recipe-image-container skeleton">
                              <div className="image-skeleton-loader">
                                <div className="loader-shimmer"></div>
                                <div className="loader-content">
                                  <Sparkles className="animate-pulse" size={32} style={{ color: 'var(--text-accent, #3b82f6)' }} />
                                  <span>Creating culinary artwork...</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="generate-image-placeholder">
                              <p>No visual representation generated for this dish yet.</p>
                              <button
                                onClick={handleGenerateWizardImage}
                                className="btn btn-secondary btn-image-gen"
                              >
                                🎨 Generate AI Image
                              </button>
                            </div>
                          )}

                          <div className="premium-macro-badges">
                            <div className="macro-badge-item">
                              <span className="val">{generatedRecipe.calories}</span>
                              <span className="lbl">Calories</span>
                            </div>
                            <div className="macro-badge-item">
                              <span className="val">{generatedRecipe.protein}g</span>
                              <span className="lbl">Protein</span>
                            </div>
                            <div className="macro-badge-item">
                              <span className="val">{generatedRecipe.carbs}g</span>
                              <span className="lbl">Carbs</span>
                            </div>
                            <div className="macro-badge-item">
                              <span className="val">{generatedRecipe.fat}g</span>
                              <span className="lbl">Fat</span>
                            </div>
                          </div>

                          <div className="recipe-ingredients-box">
                            <h4>Pantry Ingredients Used</h4>
                            <p className="ingredients-list-txt">
                              {generatedRecipe.ingredients_used || 'Standard basic items'}
                            </p>
                          </div>
                        </div>

                        {/* Right Side: Step Instructions */}
                        <div className="recipe-instructions-panel">
                          <h4>Chef's Preparation Guide</h4>
                          <div className="instructions-scroller">
                            <MarkdownRenderer text={generatedRecipe.recipe_description} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer Controls */}
                <div className="wizard-controls">
                  {step > 1 && step < 6 && (
                    <button onClick={() => setStep(step - 1)} className="btn btn-secondary btn-large">
                      <ChevronLeft size={18} /> Back
                    </button>
                  )}

                  {step > 0 && step < 5 && (
                    <button onClick={() => setStep(step + 1)} className="btn btn-primary btn-large">
                      Continue <ChevronRight size={18} />
                    </button>
                  )}

                  {step === 5 && (
                    <button onClick={handleGenerate} className="btn btn-primary btn-large glowing-gen-btn">
                      👨‍🍳 Generate AI Recipe
                    </button>
                  )}

                  {step === 6 && generatedRecipe && (
                    <div className="modal-result-actions">
                      {!generatedRecipe.image_data && (
                        <button
                          onClick={handleGenerateWizardImage}
                          disabled={generatingImage}
                          className="btn btn-large btn-secondary image-gen-btn"
                        >
                          {generatingImage ? 'Generating Image...' : '🎨 Generate AI Image'}
                        </button>
                      )}
                      <button
                        onClick={() => handleSaveToFavorites(generatedRecipe)}
                        disabled={savedSuccess}
                        className={`btn btn-large ${savedSuccess ? 'btn-secondary' : 'btn-primary'}`}
                      >
                        {savedSuccess ? <><Check size={18} /> Bookmarked</> : <><BookOpen size={18} /> Save to Book</>}
                      </button>
                      <button
                        onClick={() => handleLogMeal(generatedRecipe)}
                        disabled={logSuccess}
                        className={`btn btn-large ${logSuccess ? 'btn-secondary' : 'btn-primary'}`}
                      >
                        {logSuccess ? <><Check size={18} /> Logged</> : <><Plus size={18} /> Add Meal</>}
                      </button>
                      <button onClick={() => setWizardOpen(false)} className="btn btn-secondary btn-large">
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Override global padding for full-bleed dual screen */
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

        /* ====== DUAL SCREEN CONTAINER ====== */
        .dual-screen-container {
          display: flex;
          flex: 1;
          min-height: 0;
          gap: 0;
        }

        .dual-panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .left-panel {
          width: 420px;
          min-width: 320px;
          background: rgba(12, 14, 22, 0.6);
          border-right: 1px solid rgba(255, 255, 255, 0.04);
        }

        .right-panel {
          flex: 1;
          background: rgba(8, 10, 16, 0.3);
        }

        /* ── Panel Header ── */
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 28px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .panel-header-text h2 {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px;
          letter-spacing: -0.01em;
        }

        .panel-header-text p {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin: 0;
        }

        .recipe-count-badge {
          background: rgba(139, 92, 246, 0.12);
          color: #c084fc;
          border: 1px solid rgba(139, 92, 246, 0.2);
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }

        /* ── Panel Body (scrollable) ── */
        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }

        /* ── Panel Footer ── */
        .panel-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .wizard-launch-btn {
          width: 100%;
          justify-content: center;
          padding: 14px 24px !important;
          font-size: 1rem !important;
          border-radius: 14px !important;
          gap: 10px;
        }

        /* ── Center Divider ── */
        .dual-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1px;
          position: relative;
        }

        .divider-line {
          width: 1px;
          height: 100%;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(139, 92, 246, 0.15) 20%,
            rgba(139, 92, 246, 0.3) 50%,
            rgba(139, 92, 246, 0.15) 80%,
            transparent 100%
          );
        }

        /* ====== RECIPE CARDS (Left Panel) ====== */
        .saved-recipes-shelf {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .saved-recipe-card {
          padding: 14px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .saved-recipe-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(139, 92, 246, 0.2);
          transform: translateX(4px);
        }

        .saved-recipe-card.active-recipe {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.08);
          box-shadow: inset 3px 0 0 var(--primary), 0 0 20px rgba(139, 92, 246, 0.08);
        }

        .saved-card-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          flex-shrink: 0;
        }

        .saved-recipe-card.active-recipe .saved-card-icon {
          background: rgba(139, 92, 246, 0.2);
          border-color: rgba(139, 92, 246, 0.3);
          color: #c084fc;
        }

        .saved-card-brief {
          flex: 1;
          min-width: 0;
        }

        .saved-card-brief h4 {
          color: #fff;
          font-size: 0.92rem;
          font-weight: 600;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .saved-card-macros {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .macro-chip {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 6px;
        }

        .trash-recipe-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.15);
          cursor: pointer;
          transition: var(--transition-smooth);
          padding: 6px;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .trash-recipe-btn:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.1);
        }

        /* ── Empty States ── */
        .empty-library-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 12px;
          padding: 40px 30px;
          min-height: 300px;
        }

        .empty-library-state h3 {
          color: #fff;
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0;
        }

        .empty-library-state p {
          color: var(--text-muted);
          font-size: 0.88rem;
          max-width: 280px;
          line-height: 1.5;
        }

        .empty-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          margin-bottom: 8px;
        }

        .empty-icon-wrapper.large {
          width: 80px;
          height: 80px;
          border-radius: 22px;
        }

        .detail-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 14px;
          padding: 40px;
        }

        .detail-empty-state h2 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }

        .detail-empty-state p {
          color: var(--text-muted);
          font-size: 0.92rem;
          max-width: 360px;
          line-height: 1.6;
        }

        /* ====== RIGHT PANEL DETAIL VIEW ====== */
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 36px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          gap: 20px;
        }

        .detail-header-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
          min-width: 0;
        }

        .detail-header-left .badge {
          margin-bottom: 6px;
        }

        .detail-header-left h2 {
          font-size: 1.4rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
          line-height: 1.3;
        }

        .detail-header-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .detail-body {
          flex: 1;
          overflow-y: auto;
          padding: 28px 36px 40px;
          display: flex;
          flex-direction: column;
          gap: 28px;
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
          background: rgba(251, 191, 36, 0.06);
          border: 1px solid rgba(251, 191, 36, 0.12);
        }
        .macro-strip-item.protein-accent {
          background: rgba(139, 92, 246, 0.06);
          border: 1px solid rgba(139, 92, 246, 0.12);
        }
        .macro-strip-item.carbs-accent {
          background: rgba(6, 182, 212, 0.06);
          border: 1px solid rgba(6, 182, 212, 0.12);
        }
        .macro-strip-item.fat-accent {
          background: rgba(244, 63, 94, 0.06);
          border: 1px solid rgba(244, 63, 94, 0.12);
        }

        .macro-strip-item:hover {
          transform: translateY(-2px);
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

        .ingredients-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ingredient-chip {
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          font-size: 0.85rem;
          color: var(--text-main);
          transition: all 0.2s ease;
        }

        .ingredient-chip:hover {
          border-color: rgba(6, 182, 212, 0.3);
          background: rgba(6, 182, 212, 0.05);
        }

        .detail-recipe-body {
          padding: 20px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 16px;
        }

        /* Error */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(244, 63, 94, 0.12);
          color: #fecdd3;
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 14px;
        }

        /* Fullscreen Wizard Modal Layout */
        .modal-content.wizard-modal.fullscreen-wizard {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          max-width: none;
          border-radius: 0;
          border: none;
          background: #08090e;
          padding: 0 !important;
          animation: fadeIn 0.3s ease-out;
        }

        .wizard-split-layout {
          display: flex;
          width: 100%;
          height: 100%;
        }

        /* Sidebar Styling */
        .wizard-sidebar {
          width: 300px;
          background: rgba(15, 17, 26, 0.95);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          padding: 40px 30px;
        }

        .wizard-brand {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 12px;
          margin-bottom: 50px;
        }

        .wizard-brand-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .wizard-brand-step-indicator {
          display: none;
        }

        .chef-icon-container {
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 10px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wizard-brand h3 {
          font-size: 1.25rem;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .stepper-steps {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .stepper-step {
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          opacity: 0.5;
          transition: var(--transition-smooth);
        }

        .stepper-step.active {
          opacity: 1;
        }

        .stepper-step.completed {
          opacity: 0.85;
        }

        .step-badge {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          font-weight: 700;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-smooth);
        }

        .stepper-step.active .step-badge {
          background: var(--primary);
          border-color: var(--primary);
          box-shadow: 0 0 10px var(--primary-glow);
        }

        .stepper-step.completed .step-badge {
          background: rgba(16, 185, 129, 0.2);
          border-color: var(--accent-green);
          color: var(--accent-green);
        }

        .step-info {
          display: flex;
          flex-direction: column;
        }

        .step-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #fff;
        }

        .step-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        /* Main Area */
        .wizard-main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 40px 60px;
          height: 100%;
        }

        .wizard-main-area .modal-header {
          margin-bottom: 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-allergies-indicator {
          margin-left: auto;
          margin-right: 20px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.25);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.82rem;
          color: #f43f5e;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .header-allergies-indicator .allergies-lbl {
          font-weight: 700;
        }

        @media (max-width: 992px) {
          .header-allergies-indicator {
            display: none;
          }
        }

        .step-indicator {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--primary);
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 6px;
        }

        .wizard-main-area h2 {
          font-size: 1.8rem;
          font-weight: 800;
          margin: 0;
          color: #fff;
        }

        .wizard-step-body {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 30px;
          padding-right: 10px;
        }

        /* Step Content details */
        .meal-target-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 25px;
        }

        .meal-target-item-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          display: flex;
          align-items: center;
          gap: 20px;
          cursor: pointer;
          transition: var(--transition-smooth);
          position: relative;
          margin: 3px;
        }

        .meal-target-item-card:hover {
          border-color: rgba(139, 92, 246, 0.3);
          background: rgba(255, 255, 255, 0.04);
          transform: translateY(-2px);
        }

        .meal-target-item-card.selected {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.08);
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.15);
        }

        .card-emoji {
          font-size: 2.2rem;
        }

        .card-meta h4 {
          color: #fff;
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .card-meta p {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .selection-dot {
          position: absolute;
          top: 24px;
          right: 24px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
          transition: var(--transition-smooth);
        }

        .meal-target-item-card.selected .selection-dot {
          border-color: var(--primary);
          background: var(--primary);
          box-shadow: 0 0 8px var(--primary);
        }

        /* ── Servings Selector ── */
        .servings-section {
          margin-top: 30px;
          padding-top: 26px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .servings-title {
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 16px;
        }

        .servings-chips {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .serving-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 16px 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: center;
        }

        .serving-chip:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(139, 92, 246, 0.2);
          transform: translateY(-2px);
        }

        .serving-chip.selected {
          background: rgba(139, 92, 246, 0.1);
          border-color: var(--primary);
          box-shadow: 0 0 16px rgba(139, 92, 246, 0.15);
        }

        .serving-chip-icon {
          font-size: 1.4rem;
        }

        .serving-chip-label {
          font-size: 0.88rem;
          font-weight: 700;
          color: #fff;
        }

        .serving-chip-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .serving-chip.selected .serving-chip-label {
          color: #c084fc;
        }

        .servings-custom {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .servings-custom-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .servings-counter {
          display: flex;
          align-items: center;
          gap: 0;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
        }

        .counter-btn {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 1.1rem;
          font-weight: 700;
          width: 38px;
          height: 38px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .counter-btn:hover {
          background: rgba(139, 92, 246, 0.15);
          color: #c084fc;
        }

        .counter-value {
          font-size: 1.1rem;
          font-weight: 800;
          color: #fff;
          min-width: 36px;
          text-align: center;
          border-left: 1px solid rgba(255, 255, 255, 0.06);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0 4px;
        }

        /* Split Pantry Exclusions styles */
        .split-pantry-exclusions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          flex: 1;
          min-height: 0;
          margin-top: 25px;
        }

        .exclusions-column {
          background: rgba(15, 17, 26, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .exclusions-column .column-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.01);
        }

        .exclusions-column h4 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .exclusions-column .column-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .empty-column-msg {
          color: var(--text-muted);
          font-size: 0.85rem;
          text-align: center;
          padding: 40px 20px;
          font-style: italic;
        }

        .exclusion-item-pill {
          padding: 12px 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: var(--transition-smooth);
          margin: 3px;
        }

        .exclusion-item-pill:hover {
          transform: translateY(-1px);
        }

        .exclusion-item-pill.available:hover {
          border-color: rgba(244, 63, 94, 0.3);
          background: rgba(244, 63, 94, 0.05);
        }

        .exclusion-item-pill.excluded:hover {
          border-color: rgba(16, 185, 129, 0.3);
          background: rgba(16, 185, 129, 0.05);
        }

        .exclusion-item-pill.excluded {
          border-color: rgba(244, 63, 94, 0.4);
          background: rgba(244, 63, 94, 0.08);
          color: #fca5a5;
        }

        .pill-action {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .exclusion-item-pill.available .pill-action {
          color: var(--text-muted);
        }

        .exclusion-item-pill.available:hover .pill-action {
          color: var(--accent-red);
        }

        .exclusion-item-pill.excluded .pill-action {
          color: #fda4af;
        }

        .exclusion-item-pill.excluded:hover .pill-action {
          color: var(--accent-green);
        }

        /* Cravings styling */
        .premium-cravings-panel {
          margin-top: 25px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .premium-cravings-area {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 20px;
          font-size: 1.05rem;
          line-height: 1.6;
          color: #fff;
          resize: none;
        }

        .suggestions-tags-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .cravings-tags-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .craving-suggestion-tag {
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          color: var(--text-main);
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .craving-suggestion-tag:hover {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.08);
          transform: translateY(-1px);
        }

        /* Review steps summary */
        .premium-review-container {
          margin-top: 25px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .review-stat-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .review-stat-box.full-row {
          grid-column: span 2;
        }

        .review-stat-box .stat-label {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }

        .review-stat-box .stat-val {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .review-exclude-tag {
          padding: 6px 12px;
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.2);
          color: #fca5a5;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .flex-wrap {
          flex-wrap: wrap;
        }

        /* Premium Culinary Loader State */
        .wizard-loader-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 20px;
          overflow: hidden;
          animation: fadeIn 0.5s ease-out;
        }

        .culinary-loader-container {
          position: relative;
          width: 150px;
          height: 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }

        .cloche-glow-ring {
          position: absolute;
          bottom: 3px;
          width: 100px;
          height: 12px;
          background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.45) 0%, rgba(139, 92, 246, 0) 70%);
          filter: blur(3px);
          animation: heatPulse 2s infinite alternate;
        }

        .cloche-dome-wrapper {
          position: relative;
          width: 90px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: clocheHover 3s ease-in-out infinite;
          z-index: 2;
        }

        .cloche-handle {
          width: 10px;
          height: 10px;
          border: 2.5px solid #a78bfa;
          border-radius: 50%;
          margin-bottom: -3px;
          z-index: 2;
        }

        .cloche-dome {
          width: 76px;
          height: 38px;
          background: linear-gradient(135deg, #c084fc 0%, #7c3aed 100%);
          border-top-left-radius: 76px;
          border-top-right-radius: 76px;
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 6px 15px rgba(139, 92, 246, 0.3);
        }

        .cloche-platter {
          width: 92px;
          height: 5px;
          background: #a78bfa;
          border-radius: 2.5px;
          margin-top: 1.5px;
        }

        .steam-container {
          position: absolute;
          bottom: 48px;
          width: 80px;
          height: 40px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .steam-svg {
          width: 46px;
          height: 36px;
          fill: none;
          stroke: rgba(167, 139, 250, 0.45);
          stroke-width: 2.5;
          stroke-linecap: round;
        }

        .steam-path {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
        }

        .steam-path-1 { animation: steamRise 3s infinite linear; }
        .steam-path-2 { animation: steamRise 3s infinite linear 1s; }
        .steam-path-3 { animation: steamRise 3s infinite linear 2s; }

        @keyframes steamRise {
          0% { stroke-dashoffset: 60; opacity: 0; }
          30% { opacity: 0.6; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }

        @keyframes clocheHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes heatPulse {
          0% { transform: scale(0.9); opacity: 0.4; }
          100% { transform: scale(1.1); opacity: 1; }
        }

        .loader-header-text {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .loader-header-text h3 {
          font-size: 1.25rem;
          font-weight: 750;
          background: linear-gradient(135deg, #fff 50%, #c084fc 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .loader-progress-dashboard {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          max-width: 320px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 16px;
          border-radius: 14px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .progress-phase-item {
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .progress-phase-item.completed {
          opacity: 1;
          color: #34d399;
        }

        .progress-phase-item.active {
          opacity: 1;
          color: #a78bfa;
          font-weight: 600;
        }

        .progress-phase-item.waiting {
          opacity: 0.3;
          color: var(--text-muted, #94a3b8);
        }

        .phase-indicator {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .progress-phase-item.completed .phase-indicator {
          background: rgba(52, 211, 153, 0.12);
          border-color: rgba(52, 211, 153, 0.3);
        }

        .progress-phase-item.active .phase-indicator {
          background: rgba(167, 139, 250, 0.12);
          border-color: rgba(167, 139, 250, 0.4);
        }

        .phase-check-icon {
          color: #34d399;
        }

        .phase-active-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #a78bfa;
          animation: dotPulse 1.2s infinite alternate;
        }

        .phase-waiting-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-muted, #94a3b8);
        }

        @keyframes dotPulse {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 1; }
        }

        /* Recipe result split layouts */
        .recipe-result-split {
          display: grid;
          grid-template-columns: 1.2fr 1.8fr;
          gap: 40px;
          height: 100%;
          align-items: stretch;
          margin-top: 20px;
        }

        .recipe-info-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
          padding-right: 10px;
        }

        .recipe-meta-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .recipe-meta-header .badge {
          margin-bottom: 8px;
        }

        .recipe-meta-header h3 {
          font-size: 1.8rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
          line-height: 1.3;
        }

        .premium-macro-badges {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .macro-badge-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 12px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .macro-badge-item .val {
          font-size: 1.15rem;
          font-weight: 850;
          color: #fff;
        }

        .macro-badge-item .lbl {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .recipe-ingredients-box {
          background: rgba(15, 17, 26, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
        }

        .recipe-ingredients-box h4 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
        }

        .ingredients-list-txt {
          font-size: 0.95rem;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .recipe-instructions-panel {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .recipe-instructions-panel h4 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 20px;
        }

        .instructions-scroller {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-right: 10px;
        }

        .instruction-step-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .step-number-bullet {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--primary-glow);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #c084fc;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .instruction-step-item p {
          font-size: 0.95rem;
          color: var(--text-main);
          line-height: 1.6;
          margin: 0;
        }

        .btn-large {
          padding: 16px 32px !important;
          font-size: 1.05rem !important;
          border-radius: 16px !important;
        }

        .wizard-controls, .modal-result-actions {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          width: 100%;
        }

        .wizard-controls {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 25px;
          margin-top: 20px;
        }

        .wizard-controls .btn-secondary {
          background: rgba(255, 255, 255, 0.03) !important;
          color: rgba(255, 255, 255, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .wizard-controls .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #fff !important;
          border-color: rgba(139, 92, 246, 0.4) !important;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.15) !important;
          transform: translateY(-2px);
        }

        .wizard-controls .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .wizard-controls .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
          background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%) !important;
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 0 10px var(--primary-glow); }
          50% { box-shadow: 0 0 22px rgba(139, 92, 246, 0.5); }
          100% { box-shadow: 0 0 10px var(--primary-glow); }
        }

        /* Modal Backdrop styling */
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

        /* Modal Content styling */
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

        .height-full-flex {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }

        .step-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        /* Custom Premium Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.01);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          transition: all 0.3s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.3);
        }

        /* Custom Markdown Renderer Styles */
        .markdown-body {
          color: var(--text-main);
          font-size: 0.95rem;
          line-height: 1.7;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .markdown-h2 {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
          margin-top: 15px;
          margin-bottom: 5px;
          border-left: 4px solid var(--primary);
          padding-left: 12px;
        }

        .markdown-h3 {
          font-size: 1.25rem;
          font-weight: 750;
          color: #fff;
          margin-top: 12px;
          margin-bottom: 4px;
          border-left: 3.5px solid var(--primary);
          padding-left: 10px;
        }

        .markdown-h4 {
          font-size: 1.15rem;
          font-weight: 700;
          color: #fff;
          margin-top: 10px;
          margin-bottom: 4px;
          border-left: 3px solid var(--primary);
          padding-left: 8px;
        }

        .markdown-p {
          color: var(--text-muted);
          margin: 0;
          line-height: 1.6;
        }

        .markdown-ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .markdown-li {
          position: relative;
          padding-left: 20px;
          color: var(--text-main);
          line-height: 1.5;
        }

        .markdown-li::before {
          content: "•";
          position: absolute;
          left: 6px;
          color: var(--primary);
          font-weight: 900;
        }

        .markdown-ol {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .markdown-ol-li {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 12px 16px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .markdown-ol-li:hover {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(139, 92, 246, 0.15);
          transform: translateX(4px);
        }

        .markdown-ol-li .step-num {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--primary-glow);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #c084fc;
          font-weight: 800;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.2);
        }

        .markdown-ol-li .step-content-text {
          flex: 1;
          color: var(--text-main);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .markdown-ol-li .step-content-text strong {
          color: #fff;
          font-weight: 600;
        }

        /* ── AI Meal/Recipe Food Image styling ── */
        .recipe-image-container {
          position: relative;
          width: 100%;
          aspect-ratio: 2 / 1;
          height: auto;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
          background: rgba(15, 23, 42, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .recipe-image-actions {
          position: absolute;
          bottom: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10;
        }

        .recipe-image-container:hover .recipe-image-actions {
          opacity: 1;
          transform: translateY(0);
        }

        .btn-image-action {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px !important;
          font-size: 0.82rem !important;
          font-weight: 600 !important;
          border-radius: 10px !important;
          background: rgba(15, 17, 26, 0.75) !important;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.9) !important;
          cursor: pointer;
          transition: all 0.2s ease !important;
        }

        .btn-image-action:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          transform: translateY(-1px);
        }

        .btn-image-action.btn-danger:hover {
          background: rgba(244, 63, 94, 0.2) !important;
          border-color: rgba(244, 63, 94, 0.4) !important;
          color: #fca5a5 !important;
        }

        /* Support keyframe animations */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .recipe-image-container.skeleton {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.6) 100%);
          border: 1px dashed rgba(59, 130, 246, 0.25);
        }

        .recipe-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .recipe-image-container:hover .recipe-img {
          transform: scale(1.02);
        }

        .generate-image-placeholder {
          width: 100%;
          padding: 24px 20px;
          border-radius: 16px;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.01);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
        }

        .generate-image-placeholder p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--text-muted, #94a3b8);
          max-width: 280px;
          line-height: 1.5;
        }

        .btn-image-gen {
          padding: 8px 16px;
          font-size: 0.85rem;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .btn-image-gen:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
          transform: translateY(-1px);
        }

        .image-skeleton-loader {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .loader-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.03) 20%,
            rgba(255, 255, 255, 0.07) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 200% 100%;
          animation: shimmerSweep 1.8s infinite linear;
        }

        .loader-content {
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .loader-content span {
          font-size: 0.88rem;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.5px;
          animation: pulseText 1.5s infinite alternate;
        }

        @keyframes shimmerSweep {
          0% {
            background-position: -150% 0;
          }
          100% {
            background-position: 150% 0;
          }
        }

        @keyframes pulseText {
          0% {
            opacity: 0.6;
          }
          100% {
            opacity: 1;
          }
        }

        @media (max-width: 992px) {
          .main-content {
            height: calc(100vh - 90px) !important;
          }
          .dual-screen-container {
            flex-direction: column;
          }
          .dual-divider {
            display: none;
          }

          /* Mobile Panel Toggle based on Selection */
          .dual-screen-container:not(.recipe-selected) .left-panel {
            width: 100%;
            min-width: 0;
            max-height: none;
            flex: 1;
            display: flex;
            border-right: none;
          }
          .dual-screen-container:not(.recipe-selected) .right-panel {
            display: none;
          }

          .dual-screen-container.recipe-selected .left-panel {
            display: none;
          }
          .dual-screen-container.recipe-selected .right-panel {
            width: 100%;
            flex: 1;
            display: flex;
          }
          
          /* Library listing compact rules */
          .panel-header {
            padding: 16px 20px;
          }
          .panel-header-text h2 {
            font-size: 1.15rem;
          }
          .panel-body {
            padding: 12px 16px;
          }
          .saved-recipe-card {
            padding: 10px 12px;
            border-radius: 10px;
            gap: 10px;
          }
          .saved-card-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }
          .saved-card-brief h4 {
            font-size: 0.85rem;
          }
          .macro-chip {
            font-size: 0.68rem;
            padding: 1px 6px;
          }
          .panel-footer {
            padding: 12px 16px;
          }
          .wizard-launch-btn {
            padding: 10px 16px !important;
            font-size: 0.88rem !important;
            border-radius: 10px !important;
          }

          /* Detail Viewer compact rules */
          .detail-header {
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .detail-header-left {
            width: 100%;
          }
          .detail-header-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            gap: 8px;
          }
          .detail-header-left h2 {
            font-size: 1.15rem;
            margin-top: 2px;
            margin-bottom: 0;
          }
          .detail-header-left .badge,
          .recipe-meta-header .badge {
            padding: 2px 8px !important;
            font-size: 0.65rem !important;
            font-weight: 700 !important;
            margin-bottom: 4px !important;
            letter-spacing: 0.02em !important;
            display: inline-flex !important;
          }
          .detail-header-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            gap: 8px;
          }
          .detail-header-actions .custom-select-trigger {
            padding: 0 14px !important;
            height: 38px !important;
            font-size: 0.85rem !important;
            border-radius: 10px !important;
          }
          .detail-header-actions .btn {
            padding: 0 14px !important;
            font-size: 0.85rem !important;
            border-radius: 10px !important;
            height: 38px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
          }
          .detail-header-actions .btn svg {
            width: 14px !important;
            height: 14px !important;
          }
          .detail-body {
            padding: 16px 20px 24px;
            gap: 20px;
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
          .detail-section-title {
            font-size: 0.95rem;
          }
          .ingredient-chip {
            padding: 4px 10px;
            font-size: 0.78rem;
            border-radius: 8px;
          }
          .detail-recipe-body {
            padding: 14px;
            border-radius: 12px;
          }
          .detail-empty-state {
            padding: 24px;
            gap: 10px;
          }
          .detail-empty-state h2 {
            font-size: 1.25rem;
          }
          .detail-empty-state p {
            font-size: 0.85rem;
          }
          .empty-icon-wrapper.large {
            width: 60px;
            height: 60px;
          }

          /* --- Wizard Stepper Mobile Layout --- */
          .wizard-split-layout {
            flex-direction: column;
            height: 100%;
            min-height: 0;
          }
          .wizard-sidebar {
            width: 100%;
            padding: 14px 20px;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            background: rgba(15, 17, 26, 0.98);
          }
          .wizard-brand {
            margin-bottom: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
          }
          .wizard-brand-step-indicator {
            display: inline-block;
            font-size: 0.78rem;
            color: #c084fc;
            background: rgba(139, 92, 246, 0.12);
            border: 1px solid rgba(139, 92, 246, 0.2);
            padding: 4px 12px;
            border-radius: 999px;
            font-weight: 700;
            white-space: nowrap;
          }
          .stepper-steps {
            display: none; /* Hide horizontal circles on mobile */
          }
          .step-indicator {
            display: none; /* Hide redundant step text on mobile */
          }
          .wizard-main-area {
            padding: 20px;
            flex: 1;
            min-height: 0;
            height: auto;
            display: flex;
            flex-direction: column;
          }
          .wizard-main-area .modal-header {
            margin-bottom: 20px;
            padding-bottom: 12px;
          }
          .wizard-main-area h2 {
            font-size: 1.35rem;
          }
          .wizard-step-body {
            margin-bottom: 20px;
          }

          /* Wizard steps details responsive */
          .meal-target-cards-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-top: 15px;
          }
          .meal-target-item-card {
            padding: 14px 16px;
            border-radius: 12px;
            gap: 12px;
          }
          .card-emoji {
            font-size: 1.6rem;
          }
          .card-meta h4 {
            font-size: 0.95rem;
          }
          .card-meta p {
            font-size: 0.75rem;
          }
          .selection-dot {
            top: 16px;
            right: 16px;
          }
          
          .servings-chips {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .serving-chip {
            padding: 10px;
            border-radius: 10px;
            gap: 4px;
          }
          .serving-chip-icon {
            font-size: 1.1rem;
          }
          .serving-chip-label {
            font-size: 0.78rem;
          }
          .serving-chip-desc {
            font-size: 0.65rem;
          }

          .split-pantry-exclusions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 12px;
            height: calc(100vh - 240px);
            min-height: 250px;
          }
          .exclusions-column {
            border-radius: 12px;
            background: rgba(15, 17, 26, 0.6);
          }
          .exclusions-column .column-header {
            padding: 8px 10px;
          }
          .exclusions-column h4 {
            font-size: 0.8rem;
          }
          .exclusions-column .column-list {
            padding: 6px;
            gap: 6px;
          }
          .exclusion-item-pill {
            padding: 8px 10px;
            font-size: 0.78rem;
            border-radius: 8px;
            margin: 0;
            gap: 4px;
            line-height: 1.2;
          }
          .exclusion-item-pill.available .pill-action {
            font-size: 0;
          }
          .exclusion-item-pill.available .pill-action::before {
            content: "+";
            font-size: 0.85rem;
            font-weight: 700;
          }
          .exclusion-item-pill.excluded .pill-action {
            font-size: 0;
          }
          .exclusion-item-pill.excluded .pill-action::before {
            content: "×";
            font-size: 0.95rem;
            font-weight: 700;
          }
          .empty-column-msg {
            font-size: 0.72rem;
            padding: 20px 8px;
          }
          
          .premium-cravings-area {
            font-size: 0.92rem;
            padding: 12px;
            border-radius: 12px;
          }

          .premium-review-container {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-top: 15px;
          }
          .review-stat-box {
            padding: 14px;
            border-radius: 12px;
          }
          .review-stat-box.full-row {
            grid-column: span 1;
          }
          .review-stat-box .stat-val {
            font-size: 1rem;
          }

          .recipe-result-split {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-top: 10px;
            height: auto;
          }
          .recipe-info-panel {
            overflow: visible;
            height: auto;
            padding-right: 0;
            gap: 16px;
          }
          .recipe-meta-header h3 {
            font-size: 1.35rem;
          }
          .recipe-ingredients-box {
            padding: 14px;
            border-radius: 12px;
          }
          .recipe-instructions-panel {
            padding: 16px;
            border-radius: 16px;
            overflow: visible;
            height: auto;
          }
          .recipe-instructions-panel h4 {
            font-size: 0.95rem;
            margin-bottom: 12px;
          }
          .instructions-scroller {
            overflow: visible;
            height: auto;
            padding-right: 0;
          }
          
          .btn-large {
            padding: 8px 12px !important;
            font-size: 0.82rem !important;
            border-radius: 10px !important;
          }
          .btn-large svg {
            width: 14px !important;
            height: 14px !important;
          }
          .wizard-controls, .modal-result-actions {
            padding-top: 12px;
            margin-top: 10px;
          }
        }

        .recipe-search-input:focus {
          border-color: rgba(139, 92, 246, 0.4) !important;
          background: rgba(255, 255, 255, 0.04) !important;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.15);
        }
      `}</style>
    </div>
  )
}
