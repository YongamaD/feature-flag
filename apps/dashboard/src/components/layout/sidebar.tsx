import { NavLink } from "react-router";
import { useAuth } from "../../context/auth-context";
import { useEnvironments } from "../../context/environment-context";

const navItems = [
  { to: "/flags", label: "Flags" },
  { to: "/environments", label: "Environments" },
  { to: "/audit", label: "Audit Log" },
];

export function Sidebar() {
  const { isAdmin } = useAuth();
  const { environments, selectedEnvironment, selectEnvironment } = useEnvironments();

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">Feature Flags</h1>
      </div>

      {environments.length > 0 && (
        <div className="p-4 border-b border-gray-700">
          <label className="block text-xs text-gray-400 mb-1">Environment</label>
          <select
            className="w-full bg-gray-800 text-white rounded px-2 py-1.5 text-sm border border-gray-600"
            value={selectedEnvironment?.id || ""}
            onChange={(e) => selectEnvironment(e.target.value)}
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm ${isActive ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/users/register"
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm ${isActive ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`
            }
          >
            Add User
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
