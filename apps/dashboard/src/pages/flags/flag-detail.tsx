import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { api, ApiError } from "../../lib/api-client";
import { useEnvironments } from "../../context/environment-context";
import type { Flag, FlagState } from "../../lib/types";
import { Header } from "../../components/layout/header";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, Thead, Th, Td } from "../../components/ui/table";
import { Spinner } from "../../components/ui/spinner";
import { Alert } from "../../components/ui/alert";
import { FlagStateEditor } from "../../components/flag-state-editor";

export function FlagDetailPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { selectedEnvironment } = useEnvironments();
  const [flag, setFlag] = useState<Flag | null>(null);
  const [draft, setDraft] = useState<FlagState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchFlag = useCallback(async () => {
    if (!key || !selectedEnvironment) return;
    setLoading(true);
    try {
      const data = await api.getFlag(key, selectedEnvironment.id);
      setFlag(data);
      if (data.versions[0]) {
        setDraft(data.versions[0].stateJson);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [key, selectedEnvironment]);

  useEffect(() => {
    fetchFlag();
  }, [fetchFlag]);

  const saveDraft = async () => {
    if (!key || !selectedEnvironment || !draft) return;
    setError("");
    setSuccess("");
    try {
      await api.updateFlag(key, selectedEnvironment.id, draft);
      setSuccess("Draft saved");
      fetchFlag();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const publish = async () => {
    if (!key || !selectedEnvironment) return;
    setError("");
    setSuccess("");
    try {
      const res = await api.publishFlag(key, selectedEnvironment.id);
      setSuccess(`Published as v${res.version}`);
      fetchFlag();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const rollback = async (version: number) => {
    if (!key || !selectedEnvironment) return;
    setError("");
    setSuccess("");
    try {
      const res = await api.rollbackFlag(key, version, selectedEnvironment.id);
      setSuccess(`Rolled back to v${res.rolledBackToVersion} (new v${res.newVersion})`);
      fetchFlag();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const toggleArchive = async () => {
    if (!key || !selectedEnvironment || !flag) return;
    setError("");
    try {
      if (flag.isArchived) {
        await api.unarchiveFlag(key, selectedEnvironment.id);
      } else {
        await api.archiveFlag(key, selectedEnvironment.id);
      }
      fetchFlag();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading) return <><Header title="Flag" /><Spinner /></>;

  if (!flag) {
    return (
      <>
        <Header title="Flag Not Found" />
        <div className="p-6">
          <Alert>Flag not found</Alert>
          <Button variant="secondary" className="mt-4" onClick={() => navigate("/flags")}>Back to Flags</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={flag.key}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={toggleArchive}>
              {flag.isArchived ? "Unarchive" : "Archive"}
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-6 max-w-4xl">
        {error && <Alert>{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <div className="flex gap-2">
          {flag.isArchived && <Badge color="gray">Archived</Badge>}
          <Badge color={draft?.enabled ? "green" : "red"}>
            {draft?.enabled ? "Enabled" : "Disabled"}
          </Badge>
          {flag.description && (
            <span className="text-sm text-gray-500">{flag.description}</span>
          )}
        </div>

        {draft && (
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Draft Configuration</h3>
            <FlagStateEditor state={draft} onChange={setDraft} />
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <Button onClick={saveDraft}>Save Draft</Button>
              <Button variant="secondary" onClick={publish}>Publish</Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Version History</h3>
          <Table>
            <Thead>
              <tr>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Created By</Th>
                <Th>Date</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <tbody className="divide-y divide-gray-200">
              {flag.versions.map((v) => (
                <tr key={v.id}>
                  <Td>v{v.version}</Td>
                  <Td>
                    <Badge color={v.stateJson.enabled ? "green" : "red"}>
                      {v.stateJson.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </Td>
                  <Td>{v.createdBy}</Td>
                  <Td>{new Date(v.createdAt).toLocaleString()}</Td>
                  <Td>
                    {v.version !== flag.versions[0]?.version && (
                      <Button variant="ghost" size="sm" onClick={() => rollback(v.version)}>
                        Rollback
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </>
  );
}
