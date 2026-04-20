import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import AuthCard from './components/AuthCard'
import Dashboard from './components/Dashboard'
import RoleTabs from './components/RoleTabs'
import { ROLES } from './data/roles'
import { useAppContext } from './context/AppContext'

function App() {
  const { message, sessions, register, login, logout } = useAppContext()
  const navigate = useNavigate()

  const handleLogin = (role, form) => {
    const result = login(role, form)
    if (result.ok) {
      navigate(`/dashboard/${role}`)
    }
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage
            message={message}
            sessions={sessions}
            onRegister={register}
            onLogin={handleLogin}
            hasAnySession={Object.values(sessions).some(Boolean)}
          />
        }
      />
      <Route
        path="/dashboard/:role"
        element={
          <DashboardPage
            message={message}
            sessions={sessions}
            onLogout={() => {
              logout()
              navigate('/login')
            }}
          />
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function AppLayout({ message, activeRole, onRoleChange, showRoleTabs = true, children }) {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">MAHALLELI PLATFORMU</p>
        <h1>Rol Bazlı Yardım Ağı</h1>
        <p>
          Bağışçı, ihtiyaç sahibi, esnaf ve belediye için giriş akışları, özel paneller ve QR ile teslim
          simülasyonu.
        </p>
        {message && <p className="system-message">{message}</p>}
      </section>

      {showRoleTabs && <RoleTabs activeRole={activeRole} onChange={onRoleChange} />}
      {children}
    </main>
  )
}

function LoginPage({ message, sessions, onRegister, onLogin, hasAnySession }) {
  const [selectedRole, setSelectedRole] = useState(ROLES[0].id)
  const activeSessionRole = ROLES.find((role) => sessions[role.id])?.id

  if (hasAnySession && activeSessionRole) {
    return <Navigate to={`/dashboard/${activeSessionRole}`} replace />
  }

  return (
    <AppLayout message={message} activeRole={selectedRole} onRoleChange={setSelectedRole} showRoleTabs>
      <div className="layout-grid login-only">
        <AuthCard role={selectedRole} onRegister={onRegister} onLogin={onLogin} />
      </div>
      {hasAnySession && (
        <p className="route-hint">Giriş yapılmış roller için doğrudan `/dashboard/rol` adresine gidebilirsin.</p>
      )}
    </AppLayout>
  )
}

function DashboardPage({ message, sessions, onLogout }) {
  const navigate = useNavigate()
  const { role } = useParams()
  const isValidRole = ROLES.some((item) => item.id === role)
  const selectedRole = isValidRole ? role : 'donor'
  const user = sessions[selectedRole]

  if (!isValidRole) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <AppLayout message={message} activeRole={selectedRole} onRoleChange={() => {}} showRoleTabs={false}>
      <div className="layout-grid">
        <section className="card">
          <div className="card-head">
            <p className="eyebrow">Oturum</p>
            <h2>{user.name}</h2>
          </div>
          <p className="muted">Aktif rol: {ROLES.find((item) => item.id === selectedRole)?.label}</p>
          <button type="button" className="danger top-gap" onClick={onLogout}>
            Çıkış Yap
          </button>
        </section>
        <Dashboard role={selectedRole} user={user} />
      </div>
    </AppLayout>
  )
}

export default App
