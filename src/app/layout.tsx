import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Lead Qualifier",
  description: "AI lead intake and qualification",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: "44rem",
          margin: "2rem auto",
          padding: "0 1rem",
          lineHeight: 1.5,
        }}
      >
        <nav style={{ display: "flex", gap: "1.2rem", marginBottom: "1.5rem", borderBottom: "1px solid #eee", paddingBottom: "0.6rem" }}>
          <a href="/">Intake form</a>
          <a href="/leads">Leads</a>
          <a href="/queue">Approval queue</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
