import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: '首页', end: true },
  { to: '/work', label: '作品', end: false },
  { to: '/review', label: '选片', end: false },
  { to: '/compare', label: '比较', end: false },
  { to: '/about', label: '关于', end: false },
  { to: '/contact', label: '联系', end: false },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <Link to="/" className="brand" onClick={() => setOpen(false)}>
        光影志
      </Link>
      <button
        type="button"
        className="menu"
        aria-label="菜单"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav className={`site-nav${open ? ' nav-open' : ''}`} aria-label="主导航">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
