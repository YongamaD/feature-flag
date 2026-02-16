import { Routes, Route, Navigate } from "react-router";
import { ProtectedRoute } from "./components/protected-route";
import { AppShell } from "./components/layout/app-shell";
import { LoginPage } from "./pages/login";
import { FlagListPage } from "./pages/flags/flag-list";
import { FlagCreatePage } from "./pages/flags/flag-create";
import { FlagDetailPage } from "./pages/flags/flag-detail";
import { EnvironmentsPage } from "./pages/environments";
import { AuditLogPage } from "./pages/audit-log";
import { UserRegisterPage } from "./pages/user-register";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/flags" replace />} />
        <Route path="flags" element={<FlagListPage />} />
        <Route path="flags/new" element={<FlagCreatePage />} />
        <Route path="flags/:key" element={<FlagDetailPage />} />
        <Route path="environments" element={<EnvironmentsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="users/register" element={<UserRegisterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/flags" replace />} />
    </Routes>
  );
}
