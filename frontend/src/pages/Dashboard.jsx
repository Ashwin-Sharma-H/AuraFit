import React, { useState, useEffect } from 'react'
import { Award, Flame, Dumbbell, Apple, CheckCircle2, Trash2, Sparkles } from 'lucide-react'

export default function Dashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch User and Profile
        const userRes = await fetch('/api/auth/user/', {
          headers: { 'Authorization': `Token ${token}` }
        })
        if (userRes.status === 401) {
          if (onLogout) onLogout()
          return
        }
        const userData = await userRes.json()
        setProfile(userData.profile || {})

        // Fetch Today's Logged Meals
        const d = new Date()
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const mealsRes = await fetch(`/api/meals/?date=${todayStr}`, {
          headers: { 'Authorization': `Token ${token}` }
        })
        if (mealsRes.status === 401) {
          if (onLogout) onLogout()
          return
        }
        const mealsData = await mealsRes.json()
        setMeals(Array.isArray(mealsData) ? mealsData : [])
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token, onLogout])

  // Calculate daily calorie and macro goals dynamically based on weight & fitness goal
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
    
    // Macro ratios
    let pRatio = 0.25, cRatio = 0.50, fRatio = 0.25
    if (diet === 'keto') {
      pRatio = 0.20; cRatio = 0.05; fRatio = 0.75
    } else if (diet === 'high_protein') {
      pRatio = 0.35; cRatio = 0.40; fRatio = 0.25
    } else if (diet === 'vegan' || diet === 'vegetarian') {
      pRatio = 0.20; cRatio = 0.55; fRatio = 0.25
    }

    return {
      calories: Math.round(baseCal),
      protein: Math.round((baseCal * pRatio) / 4),
      carbs: Math.round((baseCal * cRatio) / 4),
      fat: Math.round((baseCal * fRatio) / 9)
    }
  }

  const goals = calculateGoals()

  // Sum up today's logged nutrition (only count meals that are marked prepared/consumed)
  const loggedMacros = Array.isArray(meals) ? meals.reduce(
    (acc, meal) => {
      if (meal.prepared) {
        acc.calories += meal.calories || 0
        acc.protein += meal.protein || 0
        acc.carbs += meal.carbs || 0
        acc.fat += meal.fat || 0
      }
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  ) : { calories: 0, protein: 0, carbs: 0, fat: 0 }

  const togglePrepared = async (mealId, currentStatus) => {
    try {
      const res = await fetch(`/api/meals/${mealId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prepared: !currentStatus })
      })
      if (res.ok) {
        setMeals(meals.map(m => m.id === mealId ? { ...m, prepared: !currentStatus } : m))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteMeal = async (mealId) => {
    try {
      const res = await fetch(`/api/meals/${mealId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${token}`
        }
      })
      if (res.ok) {
        setMeals(meals.filter(m => m.id !== mealId))
      }
    } catch (err) {
      console.error('Failed to delete meal:', err)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>Loading fitness dashboard...</div>
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div className="header-info">
          <h1>Dashboard</h1>
          <p>Your fitness targets and daily status logs.</p>
        </div>
        {profile?.custom_micro_targets && (
          <div className="micro-header-cards">
            {Object.entries(
              (() => {
                try { return JSON.parse(profile.custom_micro_targets); }
                catch(e) { return {}; }
              })()
            ).map(([name, value]) => (
              <div key={name} className="micro-header-card">
                <span className="micro-header-label">{name}</span>
                <span className="micro-header-val">{value}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Fitness Goals Grid */}
      <section className="dashboard-grid">
        <div className="glass-card stat-card primary-theme">
          <div className="stat-icon"><Flame size={24} /></div>
          <div className="stat-content">
            <h3>Daily Calories</h3>
            <p className="stat-value">{loggedMacros.calories} / {goals.calories} kcal</p>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${Math.min((loggedMacros.calories / goals.calories) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card stat-card secondary-theme">
          <div className="stat-icon"><Dumbbell size={24} /></div>
          <div className="stat-content">
            <h3>Protein Goal</h3>
            <p className="stat-value">{Math.round(loggedMacros.protein)}g / {goals.protein}g</p>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill secondary" 
                style={{ width: `${Math.min((loggedMacros.protein / goals.protein) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card stat-card orange-theme">
          <div className="stat-icon"><Apple size={24} /></div>
          <div className="stat-content">
            <h3>Carbs & Fats</h3>
            <p className="stat-value">C: {Math.round(loggedMacros.carbs)}g | F: {Math.round(loggedMacros.fat)}g</p>
            <div className="macros-breakdown-sub">
              <span>Carbs Target: {goals.carbs}g</span>
              <span>Fat Target: {goals.fat}g</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main split sections */}
      <div className="split-view">
        {/* Left column: Today's meal plan */}
        <div className="glass-card main-split-card">
          <h2><Award size={20} /> Today's Scheduled Meals</h2>
          {meals.length === 0 ? (
            <div className="empty-state">
              <p>No meals planned or logged for today.</p>
              <p style={{ fontSize: '0.85rem' }}>Head to the AI Meal Planner to get recommended recipes based on your pantry!</p>
            </div>
          ) : (
            <div className="meals-list">
              {meals.map((meal) => (
                <div key={meal.id} className={`meal-item-card ${meal.prepared ? 'completed' : ''}`}>
                  <div className="meal-item-details">
                    <span className="badge badge-secondary">{meal.meal_type}</span>
                    <h3>{meal.recipe_title}</h3>
                    <p className="meal-macros">
                      {meal.calories} kcal | P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g
                    </p>
                  </div>
                  <div className="meal-item-actions">
                    <button 
                      onClick={() => togglePrepared(meal.id, meal.prepared)}
                      className={`prep-toggle-btn ${meal.prepared ? 'done' : ''}`}
                      title={meal.prepared ? "Mark as Unprepared" : "Mark as Consumed/Prepared"}
                    >
                      <CheckCircle2 size={22} />
                    </button>
                    <button 
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="delete-meal-btn"
                      title="Delete Meal"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Target Profile settings overview */}
        <div className="sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card sidebar-split-card">
            <h2>Profile Overview</h2>
            <div className="profile-detail-item">
              <span className="detail-label">Current Weight:</span>
              <span className="detail-val">{profile?.weight ? `${profile.weight} kg` : 'Not set'}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Height:</span>
              <span className="detail-val">{profile?.height ? `${profile.height} cm` : 'Not set'}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Fitness Goal:</span>
              <span className="detail-val capitalize">{(profile?.fitness_goal || 'maintain_weight').replace(/_/g, ' ')}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Active Diet Plan:</span>
              <span className="detail-val capitalize">{(profile?.diet_plan || 'Balanced').replace(/_/g, ' ')}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Allergies/Restr:</span>
              <span className="detail-val">{profile?.allergies || 'None'}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-page {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          gap: 20px;
        }

        .header-info {
          flex: 1;
        }

        .micro-header-cards {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .micro-header-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 90px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .micro-header-card:hover {
          border-color: rgba(139, 92, 246, 0.3);
          transform: translateY(-2px);
        }

        .micro-header-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }

        .micro-header-val {
          font-size: 0.95rem;
          font-weight: 700;
          color: #fff;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 20px;
          position: relative;
          overflow: hidden;
        }

        .stat-icon {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .primary-theme .stat-icon { background: rgba(139, 92, 246, 0.15); color: var(--primary); }
        .secondary-theme .stat-icon { background: rgba(6, 182, 212, 0.15); color: var(--secondary); }
        .orange-theme .stat-icon { background: rgba(245, 158, 11, 0.15); color: var(--accent-orange); }

        .stat-content {
          flex: 1;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin: 4px 0 8px 0;
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), #a78bfa);
          border-radius: 999px;
          transition: width 0.5s ease-out;
        }

        .progress-bar-fill.secondary {
          background: linear-gradient(90deg, var(--secondary), #22d3ee);
        }

        .macros-breakdown-sub {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .split-view {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
        }

        .main-split-card {
          min-height: 350px;
          max-height: 500px;
          display: flex;
          flex-direction: column;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          text-align: center;
          gap: 8px;
        }

        .meals-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 10px;
          overflow-y: auto;
          flex: 1;
          padding-right: 8px;
        }

        .meal-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          transition: var(--transition-smooth);
        }

        .meal-item-card:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .meal-item-card.completed {
          opacity: 0.65;
        }

        .meal-item-details h3 {
          margin: 6px 0;
          font-size: 1.05rem;
        }

        .meal-macros {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .prep-toggle-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .prep-toggle-btn:hover {
          color: var(--accent-green);
        }

        .prep-toggle-btn.done {
          color: var(--accent-green);
        }

        .meal-item-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .delete-meal-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .delete-meal-btn:hover {
          color: var(--accent-red);
        }

        .sidebar-split-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .profile-detail-item {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .profile-detail-item:last-child {
          border-bottom: none;
        }

        .detail-label {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .detail-val {
          font-weight: 600;
          color: #fff;
        }

        .capitalize {
          text-transform: capitalize;
        }

        @media (max-width: 992px) {
          .dashboard-page {
            gap: 16px;
            height: 100%;
            overflow-y: auto;
            padding-bottom: 20px;
          }
          .page-header h1 {
            font-size: 1.5rem;
          }
          .page-header p {
            font-size: 0.8rem;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .micro-header-cards {
            width: 100%;
            gap: 8px;
          }
          .micro-header-card {
            flex: 1;
            min-width: 70px;
            padding: 6px 10px;
          }
          .dashboard-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .stat-card {
            padding: 16px;
            gap: 14px;
            border-radius: 14px;
          }
          .stat-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
          }
          .stat-icon svg {
            width: 20px;
            height: 20px;
          }
          .stat-value {
            font-size: 1.25rem;
            margin: 2px 0 6px 0;
          }
          .split-view {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .meal-item-card {
            padding: 12px;
            border-radius: 10px;
          }
          .meal-item-details h3 {
            font-size: 0.95rem;
          }
          .meal-macros {
            font-size: 0.78rem;
          }
          .profile-summary-card {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  )
}
