/**
 * Comprime una imagen en el navegador antes de subirla — una foto de
 * celular puede pesar 5-10 MB, y para un documento escaneado no hace
 * falta esa resolución. Reescala al lado más largo y reexporta como JPEG
 * a calidad media, que en la práctica corta el peso 80-95% sin perder
 * legibilidad. Los PDF no pasan por acá — comprimirlos de verdad requiere
 * herramientas que no corren de forma confiable en el navegador.
 */
export async function compressImage(
  file: File,
  { maxDimension = 1800, quality = 0.75 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
