import React from "react";

export function Section({
  title,
  children,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`border border-slate-700 rounded p-2 h-full w-full ${
        disabled ? "opacity-60" : ""
      }`}
      aria-labelledby={`${title}-legend`}
    >
      <legend
        id={`${title}-legend`}
        className="px-1 text-sm font-semibold text-gray-200"
      >
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-2 items-start min-w-0 sm:[grid-template-columns:max-content_1fr] sm:gap-x-3 sm:gap-y-2 sm:items-center">
        {children}
      </div>
    </fieldset>
  );
}
