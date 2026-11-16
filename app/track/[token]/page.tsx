import TrackClient from "./track-client";
export default async function Track({params}:{params:Promise<{token:string}>}){const {token}=await params;return <TrackClient token={token}/>}
