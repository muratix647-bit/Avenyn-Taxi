import TrackClient from "../../track/[token]/track-client";
import { notFound } from "next/navigation";

export default async function ShortTracking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let fullToken = token;
  if (/^[A-Za-z0-9_-]{22}$/.test(token)) {
    try {
      const bytes = atob(token.replace(/-/g, "+").replace(/_/g, "/") + "==");
      if (bytes.length !== 16) notFound();
      const hex = Array.from(bytes, char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
      fullToken = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    } catch { notFound(); }
  } else if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  return <TrackClient token={fullToken} />;
}
