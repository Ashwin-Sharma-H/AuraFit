import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function CustomSelect({ id, options, value, onChange, placeholder = 'Select option' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const [menuStyle, setMenuStyle] = useState({})
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const selectedOption = options.find((opt) => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on scroll/resize
  useEffect(() => {
    if (!isOpen) return
    const handleClose = () => setIsOpen(false)
    window.addEventListener('resize', handleClose)
    // Close when any scrollable parent scrolls
    const scrollParents = []
    let el = triggerRef.current?.parentElement
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        el.addEventListener('scroll', handleClose)
        scrollParents.push(el)
      }
      el = el.parentElement
    }
    return () => {
      window.removeEventListener('resize', handleClose)
      scrollParents.forEach(p => p.removeEventListener('scroll', handleClose))
    }
  }, [isOpen])

  // Calculate fixed position when opening
  const handleToggle = useCallback(() => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = Math.min(options.length * 48 + 16, 256)
      const spaceBelow = window.innerHeight - rect.bottom
      const shouldFlipUp = spaceBelow < dropdownHeight + 16

      setFlipUp(shouldFlipUp)
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        ...(shouldFlipUp
          ? { bottom: window.innerHeight - rect.top + 8, top: 'auto' }
          : { top: rect.bottom + 8, bottom: 'auto' }
        ),
      })
    }
    setIsOpen(!isOpen)
  }, [isOpen, options.length])

  const handleSelect = (val) => {
    onChange(val)
    setIsOpen(false)
  }

  const menu = isOpen && createPortal(
    <ul
      ref={menuRef}
      className={`custom-select-options-portal ${flipUp ? 'flip-up' : 'flip-down'}`}
      style={menuStyle}
    >
      {options.map((opt) => (
        <li
          key={opt.value}
          className={`custom-select-item ${value === opt.value ? 'selected' : ''}`}
          onClick={() => handleSelect(opt.value)}
        >
          {opt.label}
        </li>
      ))}
    </ul>,
    document.body
  )

  return (
    <div className="custom-select-container" ref={dropdownRef}>
      <button 
        id={id}
        type="button"
        ref={triggerRef}
        className={`custom-select-trigger ${isOpen ? 'active' : ''}`} 
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={18} className={`chevron-icon ${isOpen ? 'rotate' : ''}`} />
      </button>

      {menu}

      <style>{`
        .custom-select-container {
          position: relative;
          width: 100%;
          font-family: var(--font-family);
        }

        .custom-select-trigger {
          width: 100%;
          padding: 14px 18px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          font-family: inherit;
          font-size: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: var(--transition-smooth);
          user-select: none;
          text-align: left;
        }

        .custom-select-trigger:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .custom-select-trigger:focus,
        .custom-select-trigger.active {
          outline: none;
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 4px var(--primary-glow);
        }

        .chevron-icon {
          color: var(--text-muted);
          transition: var(--transition-smooth);
        }

        .chevron-icon.rotate {
          transform: rotate(180deg);
          color: #fff;
        }

        /* Portal-rendered dropdown menu */
        .custom-select-options-portal {
          z-index: 99999;
          padding: 8px;
          list-style: none;
          max-height: 240px;
          overflow-y: auto;
          background: rgba(20, 22, 32, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          border-radius: 14px;
          font-family: var(--font-family);
          margin: 0;
          box-sizing: border-box;
        }

        .custom-select-options-portal.flip-down {
          animation: portalSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .custom-select-options-portal.flip-up {
          animation: portalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .custom-select-item {
          padding: 12px 16px;
          border-radius: 10px;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.95rem;
          transition: background 0.15s ease, color 0.15s ease;
          user-select: none;
        }

        .custom-select-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .custom-select-item.selected {
          background: var(--primary-gradient);
          color: #fff;
          font-weight: 600;
        }

        @keyframes portalSlideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes portalSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 576px) {
          .custom-select-trigger {
            padding: 12px 14px;
            font-size: 0.9rem;
            border-radius: 10px;
          }
          .custom-select-options-portal {
            border-radius: 10px;
          }
        }
      `}</style>
    </div>
  )
}
