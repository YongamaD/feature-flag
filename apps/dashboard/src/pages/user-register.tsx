import { useState, type FormEvent } from "react";
import { useAuth } from "../context/auth-context";
import { api, ApiError } from "../lib/api-client";
import { Header } from "../components/layout/header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Alert } from "../components/ui/alert";

export function UserRegisterPage() {
  const { isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return (
      <>
        <Header title="Add User" />
        <div className="p-6">
          <Alert>Access denied. Admin role required.</Alert>
        </div>
      </>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const user = await api.register(email, password, role);
      setSuccess(`User ${user.email} created with role: ${user.role}`);
      setEmail("");
      setPassword("");
      setRole("editor");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Add User" />
      <div className="p-6 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Select
            label="Role"
            options={[
              { value: "editor", label: "Editor" },
              { value: "admin", label: "Admin" },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create User"}
          </Button>
        </form>
      </div>
    </>
  );
}
