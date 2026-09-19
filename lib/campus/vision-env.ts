export function loadServerVision() {
  const fromProcess = (name: string) => {
    const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
    return value?.trim() || "";
  };
  const baseUrl = (fromProcess("VISION_API_BASE") || "https://api.deepseek.com").replace(/\/+$/, "");
  const apiKey = fromProcess("VISION_API_KEY");
  const model = fromProcess("VISION_MODEL") || "deepseek-flash";
  return {
    baseUrl,
    apiKey,
    model,
    configured: Boolean(apiKey),
  };
}
