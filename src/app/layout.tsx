import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'ViveCUU · Chihuahua en vivo',
  description: 'Tráfico, camiones, semáforos, topes, zonas escolares, accidentes y reportes de Chihuahua en un solo mapa en vivo.',
  applicationName: 'ViveCUU',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ViveCUU', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
  openGraph: {
    title: 'ViveCUU · Chihuahua en vivo',
    description: 'Tu ciudad en vivo: rutas, semáforos, camiones, reportes y emergencias.',
    locale: 'es_MX',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#7C5CFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable}>
      <head>
        {/* display=block evita que se vea el nombre del ícono antes de cargar la fuente */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" />
      </head>
      <body className="bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
