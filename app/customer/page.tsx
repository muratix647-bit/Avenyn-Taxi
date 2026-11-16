import CustomerAppEntry from "@/components/customer-app-entry";
import type { Metadata } from "next";
import CustomerPortal from "./customer-portal";
import InstallApp from "@/components/install-app";

export const metadata: Metadata = {
  title: "Mina resor | Avenyn Taxi",
  description: "Logga in med e-post och se dina bokningar, din taxi och ditt flyg live.",
  manifest: "/customer.webmanifest",
  robots: { index: false, follow: false, nocache: true },
};

export default function CustomerPage() {
  return <CustomerAppEntry><CustomerPortal/><InstallApp kind="customer"/></CustomerAppEntry>;
}
