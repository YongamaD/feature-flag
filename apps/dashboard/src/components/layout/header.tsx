import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/button";

interface HeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function Header({ title, action }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-4">
        {action}
        <span className="text-sm text-gray-500">{user?.sub}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
