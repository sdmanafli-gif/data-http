import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import { navSections } from '../config/nav'
import SupabaseStatus from '../components/SupabaseStatus'
import './Layout.css'

function CalculatorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h8M8 14h4M14 14h2M8 18h2M12 18h2M16 18h2" />
    </svg>
  )
}

export default function Layout({ children }) {
  const { profile, signOut, isAdmin } = useAuth()
  const roleLabel = profile?.role === 'admin' ? 'Admin' : 'Mağaza meneceri'
  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <div className="layout__logo">
          <span className="layout__logo-mark">M</span>
          <span className="layout__logo-text">Mobideal</span>
        </div>
        <nav className="layout__nav">
          {navSections.map((section) => (
            <div key={section.id} className="layout__nav-section">
              <div className="layout__nav-section-title">{section.label}</div>
              <ul className="layout__nav-list">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="layout__sidebar-footer">
          <NavLink
            to="/qiymet-cedveli"
            className={({ isActive }) =>
              `layout__nav-link layout__nav-link--icon ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            <span className="layout__nav-icon"><CalculatorIcon /></span>
            <span>Qiymət cədvəli</span>
          </NavLink>
        </div>
        <div className="layout__user">
          {isAdmin && (
            <>
              <NavLink
                to="/admin/create-user"
                className={({ isActive }) =>
                  `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
                }
              >
                Yeni istifadəçi
              </NavLink>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
                }
              >
                İstifadəçilər
              </NavLink>
            </>
          )}
          <div className="layout__user-info">
            <span className="layout__user-email">{profile?.email ?? '—'}</span>
            <span className="layout__user-role">{roleLabel}</span>
          </div>
          <button type="button" className="layout__logout btn btn--secondary" onClick={() => signOut()}>
            Çıxış
          </button>
        </div>
        <SupabaseStatus />
      </aside>
      <main className="layout__main">
        <div className="layout__content">{children}</div>
      </main>
    </div>
  )
}
