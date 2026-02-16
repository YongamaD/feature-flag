import { useState } from "react";
import type { FlagState } from "../lib/types";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Button } from "./ui/button";
import { RuleEditor } from "./rule-editor";
import { RolloutEditor } from "./rollout-editor";

interface FlagStateEditorProps {
  state: FlagState;
  onChange: (state: FlagState) => void;
}

export function FlagStateEditor({ state, onChange }: FlagStateEditorProps) {
  const [newVariant, setNewVariant] = useState("");

  const addVariant = () => {
    const v = newVariant.trim();
    if (v && !state.variants.includes(v)) {
      onChange({ ...state, variants: [...state.variants, v] });
      setNewVariant("");
    }
  };

  const removeVariant = (v: string) => {
    const variants = state.variants.filter((x) => x !== v);
    const updates: Partial<FlagState> = { variants };
    if (state.defaultVariant === v && variants.length > 0) {
      updates.defaultVariant = variants[0];
    }
    onChange({ ...state, ...updates });
  };

  const addRule = () => {
    onChange({
      ...state,
      rules: [
        ...state.rules,
        {
          id: `rule-${Date.now()}`,
          conditions: [{ attr: "", op: "EQ", value: "" }],
          result: { enabled: true, variant: state.variants[0] || "" },
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(e) => onChange({ ...state, enabled: e.target.checked })}
          className="h-4 w-4"
        />
        Flag Enabled
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Variants</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {state.variants.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
              {v}
              {state.variants.length > 1 && (
                <button className="text-gray-400 hover:text-red-600" onClick={() => removeVariant(v)}>x</button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add variant"
            value={newVariant}
            onChange={(e) => setNewVariant(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVariant())}
            className="max-w-xs"
          />
          <Button variant="secondary" size="sm" onClick={addVariant}>Add</Button>
        </div>
      </div>

      <Select
        label="Default Variant"
        options={state.variants.map((v) => ({ value: v, label: v }))}
        value={state.defaultVariant}
        onChange={(e) => onChange({ ...state, defaultVariant: e.target.value })}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Rules</label>
          <Button variant="secondary" size="sm" onClick={addRule}>Add Rule</Button>
        </div>
        <div className="space-y-3">
          {state.rules.map((rule, i) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              variants={state.variants}
              onChange={(updated) => {
                const rules = [...state.rules];
                rules[i] = updated;
                onChange({ ...state, rules });
              }}
              onRemove={() => onChange({ ...state, rules: state.rules.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </div>

      <RolloutEditor
        rollout={state.rollout}
        onChange={(rollout) => onChange({ ...state, rollout })}
      />
    </div>
  );
}
