import { loadServerVision } from "@/lib/campus/vision-env";

export const runtime = "edge";

export function GET() {
  const vision = loadServerVision();
  return Response.json({ configured: vision.configured });
}
