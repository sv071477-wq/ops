import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise Operations & Faculty Utilization Platform",
  description: "Unified 3-Workflow Operations Hub for Batch Lifecycle, Scheduling, and Faculty Utilization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
