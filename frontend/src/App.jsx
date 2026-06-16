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
  const [activeTab, setActiveTab] = useState('dashboard')
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

  const handleLoginSuccess = (userToken, userName) => {
    localStorage.setItem('token', userToken)
    localStorage.setItem('username', userName)
    setToken(userToken)
    setUsername(userName)
    setActiveTab('dashboard')
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken(null)
    setUsername('')
  };

  if (checkingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading AuraFit...</div>
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
