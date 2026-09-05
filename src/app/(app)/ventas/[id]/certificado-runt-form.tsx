"use client";

import { useActionState, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { subirCertificadoRunt } from "./actions";
import { formatCOP } from "@/lib/format";
import { compressImage, formatFileSize } from "@/lib/compress-image";

export function CertificadoRuntForm({ ventaId, saldo }: { ventaId: string; saldo: number }) {
  const [state, formAction, pending] = useActionState(subirCertificadoRunt, {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileSizeInfo, setFileSizeInfo] = useState("");
  const [comprimiendo, setComprimiendo] = useState(false);
  const puedeSubir = saldo <= 0;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName("");
      setFileSizeInfo("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      // PDF u otro: se sube tal cual, no se puede comprimir de forma confiable.
      setFileName(file.name);
      setFileSizeInfo(formatFileSize(file.size));
      return;
    }

    setComprimiendo(true);
    try {
      const original = file.size;
      const comprimido = await compressImage(file);
      const dt = new DataTransfer();
      dt.items.add(comprimido);
      if (fileInputRef.current) fileInputRef.current.files = dt.files;
      setFileName(comprimido.name);
      setFileSizeInfo(
        comprimido.size < original
          ? `${formatFileSize(comprimido.size)} (antes ${formatFileSize(original)})`
          : formatFileSize(comprimido.size),
      );
    } finally {
      setComprimiendo(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="venta_id" value={ventaId} />

      {!puedeSubir ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No se puede subir el certificado: todavía debe {formatCOP(saldo)}.
        </p>
      ) : (
        <>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50">
            <Upload className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">
              {comprimiendo ? "Comprimiendo imagen..." : fileName || "Elegir archivo (PDF, JPG o PNG)"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              disabled={comprimiendo}
              className="sr-only"
              onChange={onFileChange}
            />
          </label>
          {fileSizeInfo ? <p className="text-[11px] text-slate-400">{fileSizeInfo}</p> : null}
          <p className="text-[11px] text-slate-400">
            Las fotos (JPG/PNG) se comprimen automáticamente antes de subir. Los PDF se suben tal cual.
          </p>
        </>
      )}

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending || comprimiendo || !puedeSubir}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
      >
        {pending ? "Subiendo..." : "Subir certificado RUNT"}
      </button>
    </form>
  );
}
