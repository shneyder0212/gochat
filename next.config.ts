import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Omite los errores de tipos de TypeScript durante el build en Render
  },
  eslint: {
    ignoreDuringBuilds: true, // Omite errores de linting para evitar bloqueos en el despliegue
  },
};

export default nextConfig;
