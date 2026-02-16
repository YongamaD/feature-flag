import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, ApiError } from "../../lib/api-client";
import { useEnvironments } from "../../context/environment-context";
import type { FlagState } from "../../lib/types";
import { Header } from "../../components/layout/header";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/input";
import { Alert } from "../../components/ui/alert";
import { FlagStateEditor } from "../../components/flag-state-editor";

const DEFAULT_STATE: FlagState = {
  enabled: false,
  defaultVariant: "off",
  variants: ["on", "off"],
  rules: [],
  rollout: null,
};

export function FlagCreatePage() {
  const navigate = useNavigate();
  const { selectedEnvironment } = useEnvironments();
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<FlagState>(DEFAULT_STATE);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const keyValid = /^[a-z0-9-]+$/.test(key);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedEnvironment || !keyValid) return;
    setError("");
    setSaving(true);
    try {
      await api.createFlag({
        key,
        description,
        environmentId: selectedEnvironment.id,
        initialState: state,
      });
      navigate(`/flags/${key}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Create Flag" />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert>{error}</Alert>}
          <Input
            label="Flag Key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="my-feature-flag"
            error={key && !keyValid ? "Lowercase alphanumeric and hyphens only" : undefined}
            required
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this flag control?"
          />
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Initial State</h3>
            <FlagStateEditor state={state} onChange={setState} />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={saving || !key || !keyValid}>
              {saving ? "Creating..." : "Create Flag"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/flags")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
