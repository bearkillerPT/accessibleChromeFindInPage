import React from "react";

export function NumberInput({
  id,
  value,
  min,
  step,
  onChange,
  describedBy,
}: {
  id: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (val: number) => void;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      className="border border-slate-700 rounded px-2 py-1 text-sm bg-slate-900 text-gray-200 w-full min-w-0"
      min={min}
      step={step}
      aria-describedby={describedBy}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
