import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El default (1MB) se queda corto para subir el certificado RUNT
    // escaneado (PDF/foto) desde /ventas/[id] — ver subirCertificadoRunt.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
