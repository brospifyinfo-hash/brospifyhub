export function generateDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";

  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width + "x" + screen.height,
    screen.colorDepth?.toString() || "",
    navigator.hardwareConcurrency?.toString() || "",
    navigator.maxTouchPoints?.toString() || "0",
  ];

  const fingerprint = components.join("|");
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

export function getDeviceName(): string {
  if (typeof window === "undefined") return "Unknown Device";

  const ua = navigator.userAgent;
  
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    if (/Mobile/.test(ua)) return "Android Phone";
    return "Android Tablet";
  }
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Mac OS/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux PC";
  
  return "Unknown Device";
}

export function getBrowserName(): string {
  if (typeof window === "undefined") return "Unknown";

  const ua = navigator.userAgent;
  
  if (/Chrome/.test(ua) && !/Edge/.test(ua)) return "Chrome";
  if (/Firefox/.test(ua)) return "Firefox";
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";
  if (/Edge/.test(ua)) return "Edge";
  if (/Opera/.test(ua) || /OPR/.test(ua)) return "Opera";
  
  return "Unknown Browser";
}
