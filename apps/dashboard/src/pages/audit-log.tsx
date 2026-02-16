import { useState, useEffect, useCallback, Fragment } from "react";
import { api, ApiError } from "../lib/api-client";
import { useEnvironments } from "../context/environment-context";
import type { AuditLogEntry } from "../lib/types";
import { Header } from "../components/layout/header";
import { Badge } from "../components/ui/badge";
import { Table, Thead, Th, Td } from "../components/ui/table";
import { Pagination } from "../components/ui/pagination";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { Alert } from "../components/ui/alert";

const actionColors: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  CREATE: "green",
  UPDATE: "blue",
  PUBLISH: "blue",
  ROLLBACK: "yellow",
  ARCHIVE: "gray",
  UNARCHIVE: "gray",
};

export function AuditLogPage() {
  const { selectedEnvironment } = useEnvironments();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.getAuditLog(selectedEnvironment.id, page, 50);
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!selectedEnvironment) {
    return (
      <>
        <Header title="Audit Log" />
        <div className="p-6">
          <EmptyState title="No environment selected" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Audit Log" />
      <div className="p-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit logs" description="Actions will appear here as changes are made." />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Flag</Th>
                  <Th>Details</Th>
                </tr>
              </Thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-gray-50">
                      <Td>{new Date(log.createdAt).toLocaleString()}</Td>
                      <Td>{log.actor}</Td>
                      <Td>
                        <Badge color={actionColors[log.action] || "gray"}>
                          {log.action}
                        </Badge>
                      </Td>
                      <Td className="font-mono text-xs">{log.entityKey}</Td>
                      <Td>
                        {log.diffJson != null && (
                          <button
                            className="text-indigo-600 text-xs hover:underline"
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          >
                            {expandedId === log.id ? "Hide" : "Show"}
                          </button>
                        )}
                      </Td>
                    </tr>
                    {expandedId === log.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-2 bg-gray-50">
                          <pre className="text-xs overflow-auto max-h-64">
                            {JSON.stringify(log.diffJson, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
