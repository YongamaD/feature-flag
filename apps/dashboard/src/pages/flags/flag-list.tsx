import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { api, ApiError } from "../../lib/api-client";
import { useEnvironments } from "../../context/environment-context";
import type { Flag } from "../../lib/types";
import { Header } from "../../components/layout/header";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Table, Thead, Th, Td } from "../../components/ui/table";
import { Spinner } from "../../components/ui/spinner";
import { EmptyState } from "../../components/ui/empty-state";
import { Alert } from "../../components/ui/alert";

export function FlagListPage() {
  const { selectedEnvironment } = useEnvironments();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchFlags = useCallback(async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.listFlags(selectedEnvironment.id);
      setFlags(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const toggleFlag = async (flag: Flag) => {
    if (!selectedEnvironment) return;
    const latestState = flag.versions[0]?.stateJson;
    if (!latestState) return;
    try {
      await api.updateFlag(flag.key, selectedEnvironment.id, {
        ...latestState,
        enabled: !latestState.enabled,
      });
      fetchFlags();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const archiveFlag = async (flag: Flag) => {
    if (!selectedEnvironment) return;
    try {
      await api.archiveFlag(flag.key, selectedEnvironment.id);
      fetchFlags();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const filtered = flags.filter((f) =>
    f.key.toLowerCase().includes(search.toLowerCase())
  );

  if (!selectedEnvironment) {
    return (
      <>
        <Header title="Flags" />
        <div className="p-6">
          <EmptyState title="No environment selected" description="Select or create an environment first." />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Flags"
        action={<Button onClick={() => navigate("/flags/new")}>New Flag</Button>}
      />
      <div className="p-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Input
          placeholder="Search flags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No flags found"
            description={search ? "Try a different search" : "Create your first feature flag"}
            action={!search && <Button onClick={() => navigate("/flags/new")}>Create Flag</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Key</Th>
                <Th>Status</Th>
                <Th>Variants</Th>
                <Th>Version</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((flag) => {
                const state = flag.versions[0]?.stateJson;
                return (
                  <tr key={flag.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/flags/${flag.key}`)}>
                    <Td>
                      <Link to={`/flags/${flag.key}`} className="font-medium text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {flag.key}
                      </Link>
                    </Td>
                    <Td>
                      {flag.isArchived ? (
                        <Badge color="gray">Archived</Badge>
                      ) : state?.enabled ? (
                        <Badge color="green">Enabled</Badge>
                      ) : (
                        <Badge color="red">Disabled</Badge>
                      )}
                    </Td>
                    <Td>{state?.variants.join(", ") || "-"}</Td>
                    <Td>v{flag.versions[0]?.version || 0}</Td>
                    <Td>{new Date(flag.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => toggleFlag(flag)}>
                          {state?.enabled ? "Disable" : "Enable"}
                        </Button>
                        {!flag.isArchived && (
                          <Button variant="ghost" size="sm" onClick={() => archiveFlag(flag)}>
                            Archive
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
