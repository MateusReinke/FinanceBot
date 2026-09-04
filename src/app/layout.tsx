import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

// Inter, self-hosted by next/font at build time — no request ever leaves the
// user's browser for a font. Chosen over the system stack for one concrete
// reason: this app is a wall of numbers, and Inter's lining tabular figures
// line up on the decimal where Segoe's and Roboto's do not.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FinanceBot — Controle financeiro pessoal",
  description: "Controle seus gastos, receitas, orçamentos e conecte suas contas via Open Finance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
