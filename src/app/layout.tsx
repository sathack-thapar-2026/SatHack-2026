import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["italic", "normal"],
});

export const metadata: Metadata = {
  title: "Permile — Payments Made Effortless | Verified Milestones & Safe Payouts",
  description:
    "Permile: Work completed. Progress verified. Payments made with confidence. Payments Made Effortless for freelancers and clients.",
  icons: {
    icon: "/permile-icon.png",
    apple: "/permile-icon.png",
  },
  keywords: [
    "Permile",
    "Milestone Payments",
    "Freelance Payment Protection",
    "AI Project Verification",
    "Freelancer Escrow",
    "Secure Settlements",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('permile-theme') || localStorage.getItem('payzorr-theme') || localStorage.getItem('milestoneos-theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${jakartaSans.variable} ${jetbrainsMono.variable} ${newsreader.variable} font-sans min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] antialiased selection:bg-cyan-500/20 selection:text-cyan-700 dark:selection:text-cyan-300 transition-colors duration-500`}
      >
        {children}
      </body>
    </html>
  );
}
