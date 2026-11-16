import TrackClient from "../../track/[token]/track-client";

export default async function Bokning({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TrackClient token={token} />;
}
