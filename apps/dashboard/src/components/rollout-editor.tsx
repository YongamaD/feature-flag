import type { RolloutConfig } from "../lib/types";
import { Input } from "./ui/input";

interface RolloutEditorProps {
  rollout: RolloutConfig | null;
  onChange: (rollout: RolloutConfig | null) => void;
}

export function RolloutEditor({ rollout, onChange }: RolloutEditorProps) {
  const enabled = rollout !== null;

  const toggle = () => {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ type: "PERCENT", percentage: 50, stickinessKey: "userId" });
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={enabled} onChange={toggle} />
        Percentage Rollout
      </label>
      {rollout && (
        <div className="flex gap-4 items-end ml-6">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              Percentage: {rollout.percentage}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={rollout.percentage}
              onChange={(e) => onChange({ ...rollout, percentage: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <Input
              label="Stickiness Key"
              value={rollout.stickinessKey}
              onChange={(e) => onChange({ ...rollout, stickinessKey: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
