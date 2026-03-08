import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'ReplyMind - LinkedIn Post Simulator',
  description: 'Simulate how different LinkedIn audiences react to your post before you publish.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_ZHVtbXkua2V5LmNsZXJrLmNvbSQ';
  
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
