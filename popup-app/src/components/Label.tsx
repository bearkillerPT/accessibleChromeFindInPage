import React from "react";

export function Label({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="text-xs text-gray-300 min-w-0 break-words">
      {children}
    </label>
  );
}
