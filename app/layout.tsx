import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'ReplyMind - LinkedIn Post Simulator',
  description: 'Simulate how different LinkedIn audiences react to your post before you publish.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_ZHVtbXkua2V5LmNsZXJrLmNvbSQ';
  
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
