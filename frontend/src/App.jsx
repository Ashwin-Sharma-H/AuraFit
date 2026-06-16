import React, { useState, useEffect } from 'react'
import Auth from './pages/Auth.jsx'
import Navigation from './components/Navigation.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Pantry from './pages/Pantry.jsx'
import MealPlanner from './pages/MealPlanner.jsx'
import MealBundles from './pages/MealBundles.jsx'
import MealCalendar from './pages/MealCalendar.jsx'
import Profile from './pages/Profile.jsx'

export default function App() {
  const [token, setToken] = useState(null)
  const [username, setUsername] = useState('')
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard'
  })
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    // Check local storage for existing login
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('username')
    if (savedToken) {
      setToken(savedToken)
      setUsername(savedUser || 'User')
    }
    setCheckingAuth(false)
  }, [])

  // Persist the active tab selection on change
  useEffect(() => {
    if (token) {
      localStorage.setItem('activeTab', activeTab)
    }
  }, [activeTab, token])

  const handleLoginSuccess = (userToken, userName) => {
    localStorage.setItem('token', userToken)
    localStorage.setItem('username', userName)
    setToken(userToken)
    setUsername(userName)
    setActiveTab('dashboard')
    localStorage.setItem('activeTab', 'dashboard')
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('activeTab')
    setToken(null)
    setUsername('')
    setActiveTab('dashboard')
  };

  if (checkingAuth) {
    return (
      <div className="aurafit-loader-wrapper" style={{ height: '100vh', background: 'var(--bg-dark)' }}>
        <div className="aurafit-loader-container">
          <div className="aurafit-loader-spinner">
            <div className="spinner-inner"></div>
            <div className="spinner-center">⚡</div>
          </div>
          <p className="aurafit-loader-text">Loading AuraFit...</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className={`app-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Navigation (Sidebar / Bottom Navigation) */}
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        username={username}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Main Page Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard token={token} onLogout={handleLogout} />}
        {activeTab === 'pantry' && <Pantry token={token} onLogout={handleLogout} />}
        {activeTab === 'meal-planner' && <MealPlanner token={token} onLogout={handleLogout} />}
        {activeTab === 'meal-bundles' && <MealBundles token={token} onLogout={handleLogout} />}
        {activeTab === 'meal-calendar' && <MealCalendar token={token} onLogout={handleLogout} />}
        {activeTab === 'profile' && <Profile token={token} onLogout={handleLogout} />}
      </main>
    </div>
  )
}
