import { useState } from "react";
import { api, ApiError } from "../lib/api-client";
import { useEnvironments } from "../context/environment-context";
import { Header } from "../components/layout/header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Th, Td } from "../components/ui/table";
import { Modal } from "../components/ui/modal";
import { Alert } from "../components/ui/alert";
import { Spinner } from "../components/ui/spinner";

const PROJECT_ID = import.meta.env.VITE_DEFAULT_PROJECT_ID || "";

export function EnvironmentsPage() {
  const { environments, loading, refresh } = useEnvironments();
  const [showCreate, setShowCreate] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !PROJECT_ID) return;
    setError("");
    setCreating(true);
    try {
      const env = await api.createEnvironment(name.trim(), PROJECT_ID);
      setShowApiKey(env.apiKey);
      setName("");
      setShowCreate(false);
      refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyKey = () => {
    if (showApiKey) navigator.clipboard.writeText(showApiKey);
  };

  return (
    <>
      <Header
        title="Environments"
        action={<Button onClick={() => setShowCreate(true)}>New Environment</Button>}
      />
      <div className="p-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <Spinner />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>ID</Th>
                <Th>Created</Th>
              </tr>
            </Thead>
            <tbody className="divide-y divide-gray-200">
              {environments.map((env) => (
                <tr key={env.id}>
                  <Td className="font-medium">{env.name}</Td>
                  <Td className="font-mono text-xs text-gray-500">{env.id}</Td>
                  <Td>{new Date(env.createdAt).toLocaleDateString()}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Environment">
        <div className="space-y-4">
          <Input
            label="Environment Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. staging"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showApiKey} onClose={() => setShowApiKey(null)} title="API Key Created">
        <div className="space-y-4">
          <Alert type="warning">
            Save this API key now. It will not be shown again.
          </Alert>
          <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
            {showApiKey}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={copyKey}>Copy</Button>
            <Button onClick={() => setShowApiKey(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
