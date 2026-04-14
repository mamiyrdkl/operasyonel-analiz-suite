import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '900']
});

export const metadata: Metadata = {
  title: 'Operasyonel Analiz Suite',
  description: 'Profesyonel Gecikme ve Operasyon Analizi Yönetimi Platformu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" async={false}></script>
      </head>
      <body className={`${inter.variable} antialiased h-screen flex overflow-hidden text-slate-700 bg-slate-50 font-sans`}>
        {children}
      </body>
    </html>
  );
}
