import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import { navSections } from '../config/nav'
import SupabaseStatus from '../components/SupabaseStatus'
import './Layout.css'

const SIDEBAR_KEY = 'mobideal_sidebar_collapsed'

export default function Layout({ children }) {
  const { profile, signOut, isAdmin, isManager, access } = useAuth()
  const roleLabel = profile?.role === 'admin' ? 'Admin' : 'Menecer'
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch (_) {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch (_) {}
  }, [collapsed])

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => access?.canAccessPath?.(item.path) !== false),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div className={`layout ${collapsed ? 'layout--sidebar-collapsed' : ''}`}>
      <aside className="layout__sidebar" aria-label="Əsas menyu">
        <div className="layout__logo">
          <span className="layout__logo-mark" title="Mobideal">M</span>
          {!collapsed && <span className="layout__logo-text">Mobideal</span>}
          <button
            type="button"
            className="layout__collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Menyunu aç' : 'Menyunu bağla'}
            aria-label={collapsed ? 'Menyunu aç' : 'Menyunu bağla'}
            aria-expanded={!collapsed}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="layout__nav">
          {filteredSections.map((section, sectionIndex) => (
            <div
              key={section.id}
              className={`layout__nav-section${sectionIndex > 0 ? ' layout__nav-section--divided' : ''}`}
            >
              {!collapsed && section.label ? (
                <div className="layout__nav-section-title">{section.label}</div>
              ) : null}
              <ul className="layout__nav-list">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
                      }
                      title={item.label}
                    >
                      {collapsed ? item.label.charAt(0) : item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="layout__user">
          {(isAdmin || isManager) && (
            <NavLink
              to="/admin/invite"
              className={({ isActive }) =>
                `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
              }
              title="Dəvət et"
            >
              {collapsed ? 'D' : 'Dəvət et'}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
              }
              title="İstifadəçilər"
            >
              {collapsed ? 'İ' : 'İstifadəçilər'}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin/kassa"
              className={({ isActive }) =>
                `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
              }
              title="Kassa"
            >
              {collapsed ? 'K' : 'Kassa'}
            </NavLink>
          )}
          <NavLink
            to="/hesab/tehlukesizlik"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
            title="Təhlükəsizlik"
          >
            {collapsed ? 'T' : 'Təhlükəsizlik'}
          </NavLink>
          {!collapsed && (
            <div className="layout__user-info">
              <span className="layout__user-email">{profile?.email ?? '—'}</span>
              <span className="layout__user-role">{roleLabel}</span>
            </div>
          )}
          <button
            type="button"
            className="layout__logout btn btn--secondary"
            onClick={() => signOut()}
            title="Çıxış"
          >
            {collapsed ? '⎋' : 'Çıxış'}
          </button>
        </div>
        {!collapsed && <SupabaseStatus />}
      </aside>

      {/* Floating open button when fully collapsed on small screens is handled by header toggle in logo */}
      <main className="layout__main">
        <div className="layout__content">{children}</div>
      </main>
    </div>
  )
}
