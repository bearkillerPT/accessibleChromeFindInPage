import React from "react";

export function ColorInput({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (val: string) => void;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      type="color"
      className="border border-slate-700 rounded px-2 py-1 bg-slate-900 w-full min-w-0"
      aria-describedby={describedBy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
