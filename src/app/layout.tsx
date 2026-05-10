import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { Toaster } from 'sonner';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: 'Artdent Klinik Yönetimi',
  description: 'Özel Artdent Klinik - Ağız ve Diş Sağlığı Yönetim Sistemi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={dmSans.className}>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
            <div className="flex h-16 items-center px-6">
              <a className="flex items-center space-x-3" href="/">
                <img
                  src="/logo.png"
                  alt="Artdent Klinik Logo"
                  className="h-10 w-auto object-contain"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-semibold tracking-widest text-[#2b2b2d] uppercase">Özel</span>
                  <span className="text-base font-bold tracking-wider text-[#2b2b2d] uppercase leading-none">Artdent Klinik</span>
                  <span className="text-[9px] text-[#b28c3f] tracking-wide">Ağız ve Diş Sağlığı Polikliniği</span>
                </div>
              </a>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>

        {/* Global Voice Assistant */}
        <VoiceAssistant />

        {/* Toast Notifications */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
