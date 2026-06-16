import React from 'react'
import { LayoutDashboard, ShoppingBag, Utensils, User, LogOut, ChevronLeft, ChevronRight, Layers, CalendarRange } from 'lucide-react'

export default function Navigation({ activeTab, setActiveTab, onLogout, username, isCollapsed, setIsCollapsed }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pantry', label: 'My Pantry', icon: ShoppingBag },
    { id: 'meal-planner', label: 'AI Meal Planner', icon: Utensils },
    { id: 'meal-bundles', label: 'Day Bundles', icon: Layers },
    { id: 'meal-calendar', label: 'Meal Calendar', icon: CalendarRange },
    { id: 'profile', label: 'Profile Settings', icon: User },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`desktop-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo-area">
            <img 
              src="/icons/aurafit.png" 
              className="brand-icon" 
              style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} 
              alt="AuraFit" 
              onError={(e) => {
                // Fallback to emoji if image is not loaded yet
                e.target.style.display = 'none';
                const emoji = document.createElement('span');
                emoji.className = 'brand-icon';
                emoji.innerText = '💪';
                e.target.parentNode.insertBefore(emoji, e.target);
              }}
            />
            {!isCollapsed && <h2>AuraFit</h2>}
          </div>
          <button 
            className="collapse-toggle-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
        
        <div className="user-brief">
          {!isCollapsed ? (
            <>
              <p className="user-welcome">Welcome back,</p>
              <p className="user-name">{username || 'User'}</p>
            </>
          ) : (
            <div className="user-avatar-mini">
              {(username || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-button ${activeTab === item.id ? 'active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <IconComponent size={20} className="nav-icon" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button 
            onClick={onLogout} 
            className="logout-button"
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={20} className="nav-icon" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const IconComponent = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mobile-nav-button ${activeTab === item.id ? 'active' : ''}`}
            >
              <IconComponent size={24} />
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          )}
        )}
      </nav>

      {/* Navigation styling injected dynamically */}
      <style>{`
        /* Desktop Sidebar Styles */
        .desktop-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          background: rgba(15, 17, 26, 0.95);
          border-right: 1px solid var(--bg-card-border);
          display: flex;
          flex-direction: column;
          padding: 24px;
          z-index: 100;
          backdrop-filter: blur(20px);
          transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
        }

        .desktop-sidebar.collapsed {
          width: 88px;
          padding: 24px 14px;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          height: 32px;
        }

        .brand-logo-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo-area h2 {
          font-size: 1.55rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
          line-height: 1;
          letter-spacing: -0.02em;
          display: block;
        }

        .brand-icon {
          font-size: 1.8rem;
          line-height: 1;
        }

        .collapse-toggle-btn {
          position: absolute;
          top: 27px;
          right: -13px;
          background: #111219;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: var(--text-muted);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 150;
        }

        .collapse-toggle-btn:hover {
          background: var(--primary);
          border-color: var(--primary);
          color: #fff;
          box-shadow: 0 0 12px var(--primary-glow);
          transform: scale(1.1);
        }

        .desktop-sidebar.collapsed .sidebar-brand {
          flex-direction: column;
          gap: 16px;
          height: auto;
          margin-bottom: 24px;
        }

        .user-brief {
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          transition: all 0.3s ease;
        }

        .desktop-sidebar.collapsed .user-brief {
          padding: 12px;
          align-items: center;
          justify-content: center;
        }

        .user-welcome {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .user-name {
          font-weight: 700;
          font-size: 1.1rem;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .user-avatar-mini {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--primary-gradient);
          color: #fff;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-radius: 12px;
          cursor: pointer;
          font-family: var(--font-family);
          font-weight: 500;
          font-size: 0.95rem;
          text-align: left;
          transition: all 0.2s ease;
          white-space: nowrap;
          overflow: hidden;
        }

        .nav-icon {
          flex-shrink: 0;
        }

        .desktop-sidebar.collapsed .nav-button {
          padding: 14px;
          justify-content: center;
        }

        .desktop-sidebar.collapsed .nav-button span {
          display: none;
        }

        .nav-button:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          transform: translateX(4px);
        }

        .nav-button.active {
          background: linear-gradient(135deg, var(--primary), #7c3aed);
          color: #fff;
          box-shadow: 0 4px 15px var(--primary-glow);
        }

        .sidebar-footer {
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 16px;
        }

        .logout-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          width: 100%;
          background: transparent;
          border: none;
          color: var(--accent-red);
          border-radius: 12px;
          cursor: pointer;
          font-family: var(--font-family);
          font-weight: 500;
          font-size: 0.95rem;
          text-align: left;
          transition: all 0.2s ease;
          white-space: nowrap;
          overflow: hidden;
        }

        .desktop-sidebar.collapsed .logout-button {
          padding: 14px;
          justify-content: center;
        }

        .logout-button:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Mobile Bottom Nav Styles */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 70px;
          background: rgba(10, 11, 16, 0.94);
          backdrop-filter: blur(15px);
          border-top: 1px solid var(--bg-card-border);
          grid-template-columns: repeat(6, minmax(0, 1fr));
          z-index: 100;
        }

        .mobile-nav-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-smooth);
          min-width: 0;
          padding: 0 4px;
        }

        .mobile-nav-button.active {
          color: var(--primary);
        }

        .mobile-nav-label {
          font-size: 0.65rem;
          font-family: var(--font-family);
          margin-top: 4px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: center;
        }

        /* Responsive Layouts */
        @media (max-width: 992px) {
          .desktop-sidebar {
            display: none;
          }
          .mobile-bottom-nav {
            display: grid;
          }
        }
      `}</style>
    </>
  )
}
