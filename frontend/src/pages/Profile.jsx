import React, { useState, useEffect, useRef } from 'react'
import { Save, User, Ruler, Weight, Activity, Target, Salad, AlertTriangle, CheckCircle, XCircle, Sparkles, Shield, TrendingUp, Heart } from 'lucide-react'
import CustomSelect from '../components/CustomSelect.jsx'

export default function Profile({ token, onLogout }) {
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState('sedentary')
  const [fitnessGoal, setFitnessGoal] = useState('maintain_weight')
  const [dietPlan, setDietPlan] = useState('balanced')
  const [allergies, setAllergies] = useState('')
  
  const [customCalories, setCustomCalories] = useState('')
  const [customProtein, setCustomProtein] = useState('')
  const [customCarbs, setCustomCarbs] = useState('')
  const [customFat, setCustomFat] = useState('')
  const [customMicroTargets, setCustomMicroTargets] = useState('')

  // AI Calculation temp states
  const [aiCalculating, setAiCalculating] = useState(false)
  const [calculatedTargets, setCalculatedTargets] = useState(null)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/user/', {
          headers: { 'Authorization': `Token ${token}` }
        })
        if (res.status === 401) {
          if (onLogout) onLogout()
          return
        }
        const data = await res.json()
        const prof = data.profile || {}
        
        setAge(prof.age || '')
        setHeight(prof.height || '')
        setWeight(prof.weight || '')
        setActivityLevel(prof.activity_level || 'sedentary')
        setFitnessGoal(prof.fitness_goal || 'maintain_weight')
        setDietPlan(prof.diet_plan || 'balanced')
        setAllergies(prof.allergies || '')
        
        setCustomCalories(prof.custom_calories || '')
        setCustomProtein(prof.custom_protein || '')
        setCustomCarbs(prof.custom_carbs || '')
        setCustomFat(prof.custom_fat || '')
        setCustomMicroTargets(prof.custom_micro_targets || '')
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [token, onLogout])

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    setMessage('')
    setSaveSuccess(null)

    try {
      const res = await fetch('/api/auth/user/', {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            age: age ? parseInt(age) : null,
            height: height ? parseFloat(height) : null,
            weight: weight ? parseFloat(weight) : null,
            activity_level: activityLevel,
            fitness_goal: fitnessGoal,
            diet_plan: dietPlan,
            allergies,
            custom_calories: customCalories ? parseInt(customCalories) : null,
            custom_protein: customProtein ? parseFloat(customProtein) : null,
            custom_carbs: customCarbs ? parseFloat(customCarbs) : null,
            custom_fat: customFat ? parseFloat(customFat) : null,
            custom_micro_targets: customMicroTargets
          }
        })
      })

      if (res.status === 401) {
        if (onLogout) onLogout()
        return
      }

      if (res.ok) {
        setMessage('Profile updated successfully!')
        setSaveSuccess(true)
      } else {
        setMessage('Failed to update profile settings.')
        setSaveSuccess(false)
      }
    } catch (err) {
      setMessage('Connection error. Please try again.')
      setSaveSuccess(false)
    } finally {
      setSaving(false)
      setTimeout(() => {
        setMessage('')
        setSaveSuccess(null)
      }, 4000)
    }
  }

  const handleCalculateAITargets = async () => {
    setAiCalculating(true)
    setMessage('')
    setCalculatedTargets(null)
    try {
      const res = await fetch('/api/auth/calculate-ai-targets/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            age: age ? parseInt(age) : 25,
            height: height ? parseFloat(height) : 170,
            weight: weight ? parseFloat(weight) : 70,
            activity_level: activityLevel,
            fitness_goal: fitnessGoal,
            diet_plan: dietPlan,
            allergies
          }
        })
      })
      if (res.ok) {
        const data = await res.json()
        setCalculatedTargets(data)
      } else {
        setMessage('Failed to calculate targets with AI.')
      }
    } catch (err) {
      setMessage('Error connecting to AI Targets Optimizer.')
    } finally {
      setAiCalculating(false)
    }
  }

  const handleApplyAITargets = async () => {
    if (!calculatedTargets) return
    setSaving(true)
    try {
      const microStr = JSON.stringify(calculatedTargets.micronutrients || {})
      const res = await fetch('/api/auth/user/', {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            age: age ? parseInt(age) : null,
            height: height ? parseFloat(height) : null,
            weight: weight ? parseFloat(weight) : null,
            activity_level: activityLevel,
            fitness_goal: fitnessGoal,
            diet_plan: dietPlan,
            allergies,
            custom_calories: calculatedTargets.calories,
            custom_protein: calculatedTargets.protein,
            custom_carbs: calculatedTargets.carbs,
            custom_fat: calculatedTargets.fat,
            custom_micro_targets: microStr
          }
        })
      })
      if (res.ok) {
        setCustomCalories(calculatedTargets.calories)
        setCustomProtein(calculatedTargets.protein)
        setCustomCarbs(calculatedTargets.carbs)
        setCustomFat(calculatedTargets.fat)
        setCustomMicroTargets(microStr)
        setCalculatedTargets(null)
        setMessage('AI targets applied and saved successfully!')
        setSaveSuccess(true)
      } else {
        setMessage('Failed to save AI targets.')
        setSaveSuccess(false)
      }
    } catch (err) {
      setMessage('Connection error saving targets.')
      setSaveSuccess(false)
    } finally {
      setSaving(false)
      setTimeout(() => {
        setMessage('')
        setSaveSuccess(null)
      }, 4000)
    }
  }

  const handleResetToDefaultTargets = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/auth/user/', {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            custom_calories: null,
            custom_protein: null,
            custom_carbs: null,
            custom_fat: null,
            custom_micro_targets: ''
          }
        })
      })
      if (res.ok) {
        setCustomCalories('')
        setCustomProtein('')
        setCustomCarbs('')
        setCustomFat('')
        setCustomMicroTargets('')
        setMessage('Reset to default formula targets.')
        setSaveSuccess(true)
      } else {
        setMessage('Failed to clear custom targets.')
        setSaveSuccess(false)
      }
    } catch (err) {
      setMessage('Connection error clearing targets.')
      setSaveSuccess(false)
    } finally {
      setSaving(false)
      setTimeout(() => {
        setMessage('')
        setSaveSuccess(null)
      }, 4000)
    }
  }

  const bmi = (height && weight) ? (weight / ((height / 100) ** 2)).toFixed(1) : null
  const getBmiCategory = (bmi) => {
    if (!bmi) return { label: '—', color: '#94a3b8' }
    const val = parseFloat(bmi)
    if (val < 18.5) return { label: 'Underweight', color: '#60a5fa' }
    if (val < 25) return { label: 'Normal', color: '#10b981' }
    if (val < 30) return { label: 'Overweight', color: '#f59e0b' }
    return { label: 'Obese', color: '#f43f5e' }
  }
  const bmiInfo = getBmiCategory(bmi)

  const activityLabels = {
    sedentary: 'Sedentary',
    lightly_active: 'Lightly Active',
    moderately_active: 'Moderately Active',
    very_active: 'Very Active'
  }

  const goalLabels = {
    lose_weight: 'Lose Weight',
    maintain_weight: 'Maintain Weight',
    gain_muscle: 'Gain Muscle',
    improve_endurance: 'Improve Endurance'
  }

  const goalIcons = {
    lose_weight: '🔥',
    maintain_weight: '⚖️',
    gain_muscle: '💪',
    improve_endurance: '🏃'
  }

  const dietLabels = {
    balanced: 'Balanced',
    keto: 'Ketogenic',
    paleo: 'Paleo',
    vegan: 'Vegan',
    vegetarian: 'Vegetarian',
    mediterranean: 'Mediterranean',
    high_protein: 'High Protein'
  }

  if (loading) {
    return (
      <div className="aurafit-loader-wrapper">
        <div className="aurafit-loader-container">
          <div className="aurafit-loader-spinner">
            <div className="spinner-inner"></div>
            <div className="spinner-center">⚙️</div>
          </div>
          <p className="aurafit-loader-text">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`profile-page ${mounted ? 'mounted' : ''}`}>
      {/* Floating Toast Notification */}
      {message && (
        <div className={`profile-toast ${saveSuccess ? 'success' : 'error'} ${message ? 'show' : ''}`}>
          {saveSuccess ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{message}</span>
        </div>
      )}

      {/* Hero Header Section */}
      <header className="profile-hero">
        <div className="profile-hero-bg">
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="hero-grid-pattern"></div>
        </div>
        <div className="profile-hero-content">
          <div className="profile-hero-left">
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                <User size={32} />
              </div>
              <div className="avatar-status-dot"></div>
            </div>
            <div className="profile-hero-info">
              <h1 className="profile-hero-title">Profile Settings</h1>
              <p className="profile-hero-subtitle">
                Configure your biometrics and preferences to personalize your AI-powered fitness journey.
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary profile-save-btn">
            <Save size={18} />
            <span className="save-btn-text">{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div className="profile-scroll-area">

        {/* Quick Stats Bar */}
        <div className="profile-stats-bar">
          <div className="profile-stat-chip">
            <div className="stat-chip-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
              <Ruler size={16} />
            </div>
            <div className="stat-chip-info">
              <span className="stat-chip-label">Height</span>
              <span className="stat-chip-value">{height ? `${height} cm` : '—'}</span>
            </div>
          </div>
          <div className="profile-stat-chip">
            <div className="stat-chip-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
              <Weight size={16} />
            </div>
            <div className="stat-chip-info">
              <span className="stat-chip-label">Weight</span>
              <span className="stat-chip-value">{weight ? `${weight} kg` : '—'}</span>
            </div>
          </div>
          <div className="profile-stat-chip">
            <div className="stat-chip-icon" style={{ background: `${bmiInfo.color}22`, color: bmiInfo.color }}>
              <Heart size={16} />
            </div>
            <div className="stat-chip-info">
              <span className="stat-chip-label">BMI</span>
              <span className="stat-chip-value" style={{ color: bmiInfo.color }}>{bmi || '—'}</span>
            </div>
          </div>
          <div className="profile-stat-chip">
            <div className="stat-chip-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Target size={16} />
            </div>
            <div className="stat-chip-info">
              <span className="stat-chip-label">Goal</span>
              <span className="stat-chip-value">{goalLabels[fitnessGoal] || '—'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="profile-form-layout">

          {/* Section 1: Body Metrics */}
          <section className="profile-section glass-card" style={{ animationDelay: '0.1s' }}>
            <div className="section-header">
              <div className="section-icon-wrapper section-icon-purple">
                <TrendingUp size={20} />
              </div>
              <div className="section-header-text">
                <h2 className="section-title">Body Metrics</h2>
                <p className="section-desc">Your physical measurements for accurate calorie and macro calculations.</p>
              </div>
            </div>

            <div className="section-form-grid three-col">
              <div className="form-group profile-form-group">
                <label htmlFor="userAge">
                  <span className="label-icon">🎂</span> Age
                </label>
                <div className="input-wrapper">
                  <input
                    id="userAge"
                    type="number"
                    className="form-input profile-input"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 28"
                  />
                  <span className="input-unit">years</span>
                </div>
              </div>

              <div className="form-group profile-form-group">
                <label htmlFor="userHeight">
                  <span className="label-icon">📏</span> Height
                </label>
                <div className="input-wrapper">
                  <input
                    id="userHeight"
                    type="number"
                    step="any"
                    className="form-input profile-input"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 175"
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>

              <div className="form-group profile-form-group">
                <label htmlFor="userWeight">
                  <span className="label-icon">⚖️</span> Weight
                </label>
                <div className="input-wrapper">
                  <input
                    id="userWeight"
                    type="number"
                    step="any"
                    className="form-input profile-input"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 72.5"
                  />
                  <span className="input-unit">kg</span>
                </div>
              </div>
            </div>

            {/* BMI Visual Indicator */}
            {bmi && (
              <div className="bmi-indicator">
                <div className="bmi-bar-track">
                  <div 
                    className="bmi-bar-fill"
                    style={{ 
                      width: `${Math.min(Math.max(((parseFloat(bmi) - 15) / 25) * 100, 2), 98)}%`,
                      background: bmiInfo.color 
                    }}
                  ></div>
                  <div className="bmi-bar-labels">
                    <span>15</span>
                    <span>18.5</span>
                    <span>25</span>
                    <span>30</span>
                    <span>40</span>
                  </div>
                </div>
                <div className="bmi-result">
                  <span className="bmi-value" style={{ color: bmiInfo.color }}>{bmi}</span>
                  <span className="bmi-label" style={{ color: bmiInfo.color }}>{bmiInfo.label}</span>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Fitness Goals */}
          <section className="profile-section glass-card" style={{ animationDelay: '0.2s' }}>
            <div className="section-header">
              <div className="section-icon-wrapper section-icon-cyan">
                <Activity size={20} />
              </div>
              <div className="section-header-text">
                <h2 className="section-title">Fitness Goals</h2>
                <p className="section-desc">Define your activity level and primary fitness objective.</p>
              </div>
            </div>

            <div className="section-form-grid two-col">
              <div className="form-group profile-form-group">
                <label htmlFor="activityLevel">
                  <span className="label-icon">🏋️</span> Activity Level
                </label>
                <CustomSelect
                  id="activityLevel"
                  options={[
                    { value: 'sedentary', label: 'Sedentary (No exercise)' },
                    { value: 'lightly_active', label: 'Lightly Active (1-3 days/week)' },
                    { value: 'moderately_active', label: 'Moderately Active (3-5 days/week)' },
                    { value: 'very_active', label: 'Very Active (6-7 days/week)' }
                  ]}
                  value={activityLevel}
                  onChange={setActivityLevel}
                />
              </div>

              <div className="form-group profile-form-group">
                <label htmlFor="fitnessGoal">
                  <span className="label-icon">🎯</span> Fitness Goal
                </label>
                <CustomSelect
                  id="fitnessGoal"
                  options={[
                    { value: 'lose_weight', label: 'Lose Weight' },
                    { value: 'maintain_weight', label: 'Maintain Weight' },
                    { value: 'gain_muscle', label: 'Gain Muscle' },
                    { value: 'improve_endurance', label: 'Improve Endurance' }
                  ]}
                  value={fitnessGoal}
                  onChange={setFitnessGoal}
                />
              </div>
            </div>

            {/* Active Goal Display */}
            <div className="active-goal-display">
              <span className="active-goal-emoji">{goalIcons[fitnessGoal] || '🎯'}</span>
              <div className="active-goal-info">
                <span className="active-goal-label">Current Focus</span>
                <span className="active-goal-value">{goalLabels[fitnessGoal] || 'Maintain Weight'}</span>
              </div>
              <div className="active-goal-badge">
                <Sparkles size={14} />
                Active
              </div>
            </div>
          </section>

          {/* Section 3: Diet & Nutrition */}
          <section className="profile-section glass-card" style={{ animationDelay: '0.3s' }}>
            <div className="section-header">
              <div className="section-icon-wrapper section-icon-amber">
                <Salad size={20} />
              </div>
              <div className="section-header-text">
                <h2 className="section-title">Diet & Nutrition</h2>
                <p className="section-desc">Set your dietary preferences and any food restrictions for AI meal planning.</p>
              </div>
            </div>

            <div className="section-form-grid one-col">
              <div className="form-group profile-form-group">
                <label htmlFor="dietPlan">
                  <span className="label-icon">🥗</span> Diet Plan Preference
                </label>
                <CustomSelect
                  id="dietPlan"
                  options={[
                    { value: 'balanced', label: 'Balanced / Anything' },
                    { value: 'keto', label: 'Ketogenic (Keto)' },
                    { value: 'paleo', label: 'Paleo' },
                    { value: 'vegan', label: 'Vegan' },
                    { value: 'vegetarian', label: 'Vegetarian' },
                    { value: 'mediterranean', label: 'Mediterranean' },
                    { value: 'high_protein', label: 'High Protein' }
                  ]}
                  value={dietPlan}
                  onChange={setDietPlan}
                />
              </div>

              <div className="form-group profile-form-group">
                <label htmlFor="allergies">
                  <span className="label-icon">⚠️</span> Allergies / Excluded Ingredients
                </label>
                <div className="input-wrapper">
                  <input
                    id="allergies"
                    type="text"
                    className="form-input profile-input"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Peanuts, Seafood, Dairy, Gluten (comma-separated)"
                  />
                </div>
                {allergies && (
                  <div className="allergy-tags">
                    {allergies.split(',').map((item, i) => {
                      const trimmed = item.trim()
                      if (!trimmed) return null
                      return (
                        <span key={i} className="allergy-tag">
                          <AlertTriangle size={12} />
                          {trimmed}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: AI Nutrition Coach */}
          <section className="profile-section glass-card" style={{ animationDelay: '0.4s' }}>
            <div className="section-header">
              <div className="section-icon-wrapper section-icon-purple">
                <Sparkles size={20} className="sparkle-icon" />
              </div>
              <div className="section-header-text">
                <h2 className="section-title">AI Nutrition Coach</h2>
                <p className="section-desc">Optimize your daily goals and calculate micronutrient targets based on your unique metabolism.</p>
              </div>
            </div>

            {/* Currently Applied Targets */}
            {customCalories ? (
              <div className="active-custom-targets-box">
                <div className="active-targets-header">
                  <div className="targets-badge">
                    <CheckCircle size={14} />
                    <span>Personalized AI Targets Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetToDefaultTargets}
                    className="btn btn-secondary reset-targets-btn"
                  >
                    Reset to Default Formula
                  </button>
                </div>
                
                <div className="custom-targets-grid">
                  <div className="custom-target-card cal-card">
                    <span className="val">{customCalories}</span>
                    <span className="lbl">Calories</span>
                  </div>
                  <div className="custom-target-card prot-card">
                    <span className="val">{customProtein}g</span>
                    <span className="lbl">Protein</span>
                  </div>
                  <div className="custom-target-card carb-card">
                    <span className="val">{customCarbs}g</span>
                    <span className="lbl">Carbohydrates</span>
                  </div>
                  <div className="custom-target-card fat-card">
                    <span className="val">{customFat}g</span>
                    <span className="lbl">Fats</span>
                  </div>
                </div>

                {/* Micronutrients display */}
                {customMicroTargets && (
                  <div className="micros-display-section">
                    <h4 className="micros-title">Recommended Daily Micronutrients</h4>
                    <div className="micros-grid">
                      {Object.entries(
                        (() => {
                          try { return JSON.parse(customMicroTargets); } 
                          catch(e) { return {}; }
                        })()
                      ).map(([name, value]) => (
                        <div key={name} className="micro-chip-item">
                          <span className="micro-name">{name}</span>
                          <span className="micro-val">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="default-formula-hint">
                <Shield size={16} />
                <span>Currently using BMR mathematical estimation. Generate personalized targets with AI for extreme accuracy.</span>
              </div>
            )}

            {/* AI Generator Button */}
            {!calculatedTargets && !aiCalculating && (
              <div className="ai-calc-action-row">
                <button
                  type="button"
                  onClick={handleCalculateAITargets}
                  className="btn btn-primary ai-calc-btn"
                >
                  <Sparkles size={16} />
                  <span>Calculate Custom Targets with AI</span>
                </button>
              </div>
            )}

            {/* Loading State */}
            {aiCalculating && (
              <div className="ai-coach-loading">
                <div className="steam-loader-cloche">
                  <Sparkles size={32} className="pulsing-sparkles" />
                </div>
                <p>Analyzing biometrics and calculating optimal targets...</p>
              </div>
            )}

            {/* Calculation Result */}
            {calculatedTargets && (
              <div className="ai-calc-results-panel">
                <h4 className="results-panel-title">AI Suggested Targets</h4>
                
                <div className="custom-targets-grid preview-grid">
                  <div className="custom-target-card cal-card preview">
                    <span className="val">{calculatedTargets.calories}</span>
                    <span className="lbl">Calories</span>
                  </div>
                  <div className="custom-target-card prot-card preview">
                    <span className="val">{calculatedTargets.protein}g</span>
                    <span className="lbl">Protein</span>
                  </div>
                  <div className="custom-target-card carb-card preview">
                    <span className="val">{calculatedTargets.carbs}g</span>
                    <span className="lbl">Carbs</span>
                  </div>
                  <div className="custom-target-card fat-card preview">
                    <span className="val">{calculatedTargets.fat}g</span>
                    <span className="lbl">Fat</span>
                  </div>
                </div>

                {/* Micronutrients grid */}
                {calculatedTargets.micronutrients && (
                  <div className="micros-display-section">
                    <h4 className="micros-title">Micronutrient Guidelines</h4>
                    <div className="micros-grid">
                      {Object.entries(calculatedTargets.micronutrients).map(([name, value]) => (
                        <div key={name} className="micro-chip-item">
                          <span className="micro-name">{name}</span>
                          <span className="micro-val">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explanation text */}
                {calculatedTargets.explanation && (
                  <div className="coach-rationale-box">
                    <h5 className="rationale-title">Coach Dietitian Rationale</h5>
                    <p className="rationale-text">{calculatedTargets.explanation}</p>
                  </div>
                )}

                <div className="results-panel-actions">
                  <button
                    type="button"
                    onClick={() => setCalculatedTargets(null)}
                    className="btn btn-secondary discard-btn"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyAITargets}
                    className="btn btn-primary apply-ai-targets-btn"
                  >
                    Apply & Save AI Targets
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Mobile Save Button */}
          <div className="profile-mobile-save">
            <button type="submit" disabled={saving} className="btn btn-primary profile-save-btn-mobile">
              <Save size={18} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>

        </form>
      </div>

      <style>{`
        /* ============================================
           PROFILE PAGE - PREMIUM REDESIGN
           ============================================ */

        .profile-page {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .profile-page.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        /* ---- Floating Toast ---- */
        .profile-toast {
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
          backdrop-filter: blur(20px);
          animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }

        .profile-toast.success {
          background: rgba(16, 185, 129, 0.18);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .profile-toast.error {
          background: rgba(244, 63, 94, 0.18);
          color: #fca5a5;
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(30px) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0);
          }
        }

        /* ---- Hero Header ---- */
        .profile-hero {
          position: relative;
          border-radius: var(--border-radius);
          overflow: hidden;
          padding: 32px 36px;
          margin-bottom: 0;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .profile-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            rgba(139, 92, 246, 0.12) 0%, 
            rgba(6, 182, 212, 0.08) 50%, 
            rgba(15, 17, 26, 0.9) 100%);
          z-index: 0;
        }

        .hero-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          animation: orbFloat 8s ease-in-out infinite;
        }

        .hero-orb-1 {
          width: 200px;
          height: 200px;
          top: -60px;
          left: -40px;
          background: rgba(139, 92, 246, 0.25);
          animation-delay: 0s;
        }

        .hero-orb-2 {
          width: 160px;
          height: 160px;
          bottom: -40px;
          right: 80px;
          background: rgba(6, 182, 212, 0.2);
          animation-delay: -3s;
        }

        .hero-orb-3 {
          width: 120px;
          height: 120px;
          top: 20px;
          right: -20px;
          background: rgba(245, 158, 11, 0.12);
          animation-delay: -5s;
        }

        .hero-grid-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10px, -15px) scale(1.05); }
          66% { transform: translate(-8px, 10px) scale(0.95); }
        }

        .profile-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .profile-hero-left {
          display: flex;
          align-items: center;
          gap: 20px;
          flex: 1;
          min-width: 0;
        }

        .profile-avatar-container {
          position: relative;
          flex-shrink: 0;
        }

        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%);
          border: 2px solid rgba(139, 92, 246, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c084fc;
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.2);
        }

        .avatar-status-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent-green);
          border: 3px solid var(--bg-dark);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }

        .profile-hero-info {
          min-width: 0;
        }

        .profile-hero-title {
          font-size: 2rem;
          font-weight: 850;
          margin: 0 0 6px 0;
          background: linear-gradient(135deg, #ffffff 40%, #c084fc 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }

        .profile-hero-subtitle {
          font-size: 0.95rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }

        .profile-save-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 13px 28px;
          flex-shrink: 0;
          font-size: 0.95rem;
          white-space: nowrap;
        }

        /* ---- Scroll Area ---- */
        .profile-scroll-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding-top: 20px;
          padding-bottom: 30px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ---- Stats Bar ---- */
        .profile-stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .profile-stat-chip {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
          background: var(--bg-card);
          border: 1px solid var(--bg-card-border);
          border-radius: 16px;
          backdrop-filter: blur(12px);
          transition: var(--transition-smooth);
        }

        .profile-stat-chip:hover {
          border-color: rgba(139, 92, 246, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        }

        .stat-chip-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-chip-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .stat-chip-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .stat-chip-value {
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ---- Section Cards ---- */
        .profile-section {
          padding: 28px 30px;
          animation: sectionFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          overflow: visible;
          position: relative;
          z-index: 2;
        }

        .profile-page .profile-section:hover {
          transform: none;
          border-color: rgba(139, 92, 246, 0.2);
          box-shadow: 0 20px 48px 0 rgba(139, 92, 246, 0.12);
        }

        @keyframes sectionFadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
        }

        .section-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .section-icon-purple {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.08));
          color: #a78bfa;
        }

        .section-icon-cyan {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.08));
          color: #22d3ee;
        }

        .section-icon-amber {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.08));
          color: #fbbf24;
        }

        .section-header-text {
          flex: 1;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #fff;
          background: none;
          -webkit-text-fill-color: unset;
          letter-spacing: -0.01em;
        }

        .section-desc {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }

        /* ---- Form Grid Layouts ---- */
        .section-form-grid {
          display: grid;
          gap: 18px;
        }

        .section-form-grid.three-col {
          grid-template-columns: repeat(3, 1fr);
        }

        .section-form-grid.two-col {
          grid-template-columns: repeat(2, 1fr);
        }

        .section-form-grid.one-col {
          grid-template-columns: 1fr;
        }

        .profile-form-group {
          margin-bottom: 0;
        }

        .profile-form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .label-icon {
          font-size: 0.9rem;
          line-height: 1;
        }

        .input-wrapper {
          position: relative;
        }

        .profile-input {
          padding-right: 52px;
        }

        .input-unit {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(148, 163, 184, 0.5);
          pointer-events: none;
          letter-spacing: 0.02em;
        }

        /* ---- BMI Indicator ---- */
        .bmi-indicator {
          margin-top: 20px;
          padding: 18px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .bmi-bar-track {
          flex: 1;
          position: relative;
        }

        .bmi-bar-track > div:first-child {
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          overflow: hidden;
          position: relative;
        }

        .bmi-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.6s ease, background 0.3s ease;
          box-shadow: 0 0 10px currentColor;
        }

        .bmi-bar-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 0.65rem;
          color: rgba(148, 163, 184, 0.4);
          font-weight: 500;
        }

        .bmi-result {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }

        .bmi-value {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1;
        }

        .bmi-label {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ---- Active Goal Display ---- */
        .active-goal-display {
          margin-top: 20px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%);
          border: 1px solid rgba(6, 182, 212, 0.12);
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: var(--transition-smooth);
        }

        .active-goal-display:hover {
          border-color: rgba(6, 182, 212, 0.25);
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.06) 100%);
        }

        .active-goal-emoji {
          font-size: 1.6rem;
          line-height: 1;
        }

        .active-goal-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .active-goal-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .active-goal-value {
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
        }

        .active-goal-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          background: rgba(16, 185, 129, 0.12);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        /* ---- Allergy Tags ---- */
        .allergy-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .allergy-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.2);
          animation: tagPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes tagPop {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* ---- Mobile Save ---- */
        .profile-mobile-save {
          display: none;
          position: relative;
          z-index: 1;
        }

        .profile-save-btn-mobile {
          width: 100%;
          padding: 14px 24px;
          justify-content: center;
          gap: 10px;
          font-size: 1rem;
        }

        .profile-form-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ---- AI Nutrition Coach ---- */
        .ai-assistant-section-wrap {
          margin-top: 10px;
        }

        .active-custom-targets-box {
          background: rgba(139, 92, 246, 0.02);
          border: 1px solid rgba(139, 92, 246, 0.12);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .active-targets-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .targets-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #a78bfa;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          padding: 6px 14px;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .reset-targets-btn {
          padding: 6px 14px;
          font-size: 0.78rem;
          border-radius: 10px;
        }

        .custom-targets-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .custom-target-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        .custom-target-card .val {
          font-size: 1.4rem;
          font-weight: 800;
          line-height: 1.2;
        }

        .custom-target-card .lbl {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: 4px;
        }

        .cal-card { border-color: rgba(245, 158, 11, 0.15); }
        .cal-card .val { color: #fbbf24; }
        .prot-card { border-color: rgba(139, 92, 246, 0.15); }
        .prot-card .val { color: #c084fc; }
        .carb-card { border-color: rgba(6, 182, 212, 0.15); }
        .carb-card .val { color: #22d3ee; }
        .fat-card { border-color: rgba(244, 63, 94, 0.15); }
        .fat-card .val { color: #fb7185; }

        .default-formula-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .ai-calc-action-row {
          margin-top: 15px;
        }

        .ai-calc-btn {
          width: 100%;
          padding: 12px 24px;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          border: 1px solid rgba(139, 92, 246, 0.25);
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.2);
        }

        .ai-calc-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.3);
        }

        .ai-coach-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 10px;
          gap: 14px;
          text-align: center;
        }

        .ai-coach-loading p {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
        }

        .steam-loader-cloche {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(139, 92, 246, 0.1);
          border: 2px solid rgba(139, 92, 246, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pulsing-sparkles {
          color: #c084fc;
          animation: coachPulse 1.5s infinite ease-in-out;
        }

        @keyframes coachPulse {
          0%, 100% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 6px #c084fc); }
        }

        .ai-calc-results-panel {
          background: rgba(139, 92, 246, 0.02);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 14px;
          padding: 20px;
          margin-top: 15px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          animation: resultsSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes resultsSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .results-panel-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .micros-display-section {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: 16px;
        }

        .micros-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .micros-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .micro-chip-item {
          display: flex;
          flex-direction: column;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          align-items: center;
        }

        .micro-name {
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .micro-val {
          font-size: 0.92rem;
          font-weight: 700;
          color: #fff;
          margin-top: 2px;
        }

        .coach-rationale-box {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 14px 18px;
        }

        .rationale-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: #c084fc;
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .rationale-text {
          margin: 0;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.45;
          font-style: italic;
        }

        .results-panel-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: 16px;
        }

        .discard-btn {
          padding: 8px 16px;
          font-size: 0.82rem;
          border-radius: 10px;
        }

        .apply-ai-targets-btn {
          padding: 8px 20px;
          font-size: 0.82rem;
          border-radius: 10px;
        }

        @media (max-width: 1200px) {
          .profile-stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 992px) {
          .profile-page {
            height: 100%;
            overflow: hidden;
          }

          .profile-hero {
            margin: 0;
            border-radius: 16px;
            padding: 18px 20px;
            border: 1px solid rgba(139, 92, 246, 0.15);
            background: rgba(18, 20, 32, 0.85);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          }

          .profile-hero::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 20px;
            right: 20px;
            height: 0;
            background: none;
          }

          .profile-hero-bg {
            border-radius: 16px;
            background: linear-gradient(90deg, 
              rgba(139, 92, 246, 0.1) 0%, 
              transparent 50%,
              rgba(6, 182, 212, 0.06) 100%);
          }

          .profile-hero-content {
            flex-direction: row;
            align-items: center;
            gap: 14px;
          }

          .profile-avatar {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            border: 1.5px solid rgba(139, 92, 246, 0.5);
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%);
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
          }

          .profile-avatar svg {
            width: 20px;
            height: 20px;
          }

          .avatar-status-dot {
            width: 11px;
            height: 11px;
            border-width: 2px;
          }

          .profile-hero-title {
            font-size: 1.2rem;
            margin-bottom: 0;
          }

          .profile-hero-subtitle {
            display: none;
          }

          .hero-orb {
            display: none;
          }

          .hero-grid-pattern {
            display: none;
          }

          .profile-save-btn {
            padding: 9px 16px;
            font-size: 0.85rem;
            border-radius: 10px;
          }

          .profile-scroll-area {
            padding-top: 16px;
            padding-bottom: 20px;
            gap: 14px;
          }

          .profile-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .profile-stat-chip {
            padding: 12px 14px;
            gap: 10px;
          }

          .stat-chip-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }

          .stat-chip-label {
            font-size: 0.65rem;
          }

          .stat-chip-value {
            font-size: 0.92rem;
          }

          .profile-section {
            padding: 20px;
          }

          .section-icon-wrapper {
            width: 38px;
            height: 38px;
            border-radius: 10px;
          }

          .section-title {
            font-size: 1.1rem;
          }

          .section-desc {
            font-size: 0.8rem;
          }

          .section-form-grid.three-col,
          .section-form-grid.two-col {
            grid-template-columns: 1fr;
          }

          .bmi-indicator {
            flex-direction: column;
            gap: 14px;
            align-items: stretch;
          }

          .bmi-result {
            flex-direction: row;
            align-items: center;
            gap: 10px;
          }

          .active-goal-display {
            margin-top: 14px;
          }

          .profile-mobile-save {
            display: block;
            padding-bottom: 10px;
          }
        }

        @media (max-width: 576px) {
          .profile-hero {
            margin: 0;
            padding: 14px 16px;
            border-radius: 14px;
          }

          .profile-hero::after {
            display: none;
          }

          .profile-scroll-area {
            padding-top: 12px;
            gap: 12px;
          }

          .profile-section {
            padding: 16px;
          }

          .section-header {
            gap: 12px;
            margin-bottom: 18px;
          }

          .section-icon-wrapper {
            width: 34px;
            height: 34px;
            border-radius: 8px;
          }

          .section-icon-wrapper svg {
            width: 16px;
            height: 16px;
          }

          .profile-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }

        @media (max-width: 480px) {
          .profile-save-btn .save-btn-text {
            display: none;
          }

          .profile-save-btn {
            padding: 0;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
