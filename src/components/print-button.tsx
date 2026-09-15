"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/lib/ui";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`print:hidden ${buttonClass("primary")}`}
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
