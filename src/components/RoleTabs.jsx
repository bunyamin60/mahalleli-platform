import { ROLES } from '../data/roles'

function RoleTabs({ activeRole, onChange }) {
  return (
    <div className="role-tabs">
      {ROLES.map((role) => (
        <button
          key={role.id}
          type="button"
          className={`role-tab ${activeRole === role.id ? 'active' : ''}`}
          onClick={() => onChange(role.id)}
        >
          <span className={`role-dot bg-gradient ${role.accent}`} />
          {role.label}
        </button>
      ))}
    </div>
  )
}

export default RoleTabs
