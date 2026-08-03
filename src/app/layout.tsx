import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceBot — Controle financeiro pessoal",
  description:
    "Controle seus gastos, receitas, orçamentos e conecte suas contas via Open Finance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
