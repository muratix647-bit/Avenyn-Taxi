import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radera konto",
  robots: { index: false, follow: false, nocache: true },
};

export default function DeleteAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
