import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GoChat - Web",
  description: "Aplicación de mensajería instantánea y llamadas estilo WhatsApp",
  icons: {
    icon: "/icon.svg", // Asegúrate de tener tu icono de WhatsApp aquí
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <main className="h-screen w-screen overflow-hidden bg-background">
          {children}
        </main>
      </body>
    </html>
  );
}
