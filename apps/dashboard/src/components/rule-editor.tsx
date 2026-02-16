import type { Rule, ConditionOperator } from "../lib/types";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Button } from "./ui/button";

const operators: { value: ConditionOperator; label: string }[] = [
  { value: "EQ", label: "equals" },
  { value: "NEQ", label: "not equals" },
  { value: "IN", label: "in" },
  { value: "NOT_IN", label: "not in" },
  { value: "GT", label: "greater than" },
  { value: "LT", label: "less than" },
  { value: "CONTAINS", label: "contains" },
];

interface RuleEditorProps {
  rule: Rule;
  variants: string[];
  onChange: (rule: Rule) => void;
  onRemove: () => void;
}

export function RuleEditor({ rule, variants, onChange, onRemove }: RuleEditorProps) {
  const updateCondition = (index: number, field: string, value: unknown) => {
    const conditions = [...rule.conditions];
    conditions[index] = { ...conditions[index], [field]: value };
    onChange({ ...rule, conditions });
  };

  const addCondition = () => {
    onChange({
      ...rule,
      conditions: [...rule.conditions, { attr: "", op: "EQ", value: "" }],
    });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...rule,
      conditions: rule.conditions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Rule: {rule.id}</span>
        <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-500">Conditions</label>
        {rule.conditions.map((cond, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              placeholder="attr"
              value={cond.attr}
              onChange={(e) => updateCondition(i, "attr", e.target.value)}
              className="flex-1"
            />
            <Select
              options={operators}
              value={cond.op}
              onChange={(e) => updateCondition(i, "op", e.target.value)}
              className="w-36"
            />
            <Input
              placeholder="value"
              value={String(cond.value ?? "")}
              onChange={(e) => updateCondition(i, "value", e.target.value)}
              className="flex-1"
            />
            <Button variant="ghost" size="sm" onClick={() => removeCondition(i)}>x</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addCondition}>
          Add Condition
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <label className="text-xs text-gray-500">Result:</label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={rule.result.enabled}
            onChange={(e) => onChange({ ...rule, result: { ...rule.result, enabled: e.target.checked } })}
          />
          Enabled
        </label>
        <Select
          options={variants.map((v) => ({ value: v, label: v }))}
          value={rule.result.variant}
          onChange={(e) => onChange({ ...rule, result: { ...rule.result, variant: e.target.value } })}
          className="w-36"
        />
      </div>
    </div>
  );
}
