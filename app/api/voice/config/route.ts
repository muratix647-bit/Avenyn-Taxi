import { voiceReady } from "@/lib/voice-server";
export async function GET(){return Response.json({enabled:voiceReady(),mode:"foreground"},{headers:{"Cache-Control":"no-store"}});}
