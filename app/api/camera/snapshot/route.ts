export const runtime = "edge";

const MAX_BYTES = 8 * 1024 * 1024;
const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal", "metadata.internal"]);

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".internal")) return true;
  return false;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string };
  const raw = body.url?.trim() ?? "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return Response.json({ error: "抓拍地址无效" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "仅支持 http/https 摄像头抓拍地址" }, { status: 400 });
  }
  if (isBlockedHost(parsed.hostname)) {
    return Response.json({ error: "不允许访问该主机" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "image/*,*/*;q=0.8" },
    });
    if (!response.ok) {
      return Response.json({ error: `摄像头返回 ${response.status}` }, { status: 502 });
    }
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (mime && !mime.startsWith("image/") && mime !== "application/octet-stream") {
      return Response.json({ error: "摄像头未返回图片" }, { status: 502 });
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength === 0) return Response.json({ error: "抓拍为空" }, { status: 502 });
    if (buffer.byteLength > MAX_BYTES) return Response.json({ error: "抓拍图片过大" }, { status: 413 });
    const dataUrl = `data:${mime.startsWith("image/") ? mime : "image/jpeg"};base64,${bytesToBase64(buffer)}`;
    return Response.json({ dataUrl });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "摄像头抓拍超时" : "无法连接摄像头";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
