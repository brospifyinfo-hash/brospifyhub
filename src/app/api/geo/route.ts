import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    if (ip === "unknown" || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) {
      return NextResponse.json({
        ip: ip,
        city: "Lokal",
        country: "Entwicklung",
      });
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,country,query`, {
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      return NextResponse.json({
        ip: ip,
        city: "Unbekannt",
        country: "Unbekannt",
      });
    }

    const data = await response.json();

    if (data.status === "success") {
      return NextResponse.json({
        ip: data.query || ip,
        city: data.city || "Unbekannt",
        country: data.country || "Unbekannt",
      });
    }

    return NextResponse.json({
      ip: ip,
      city: "Unbekannt",
      country: "Unbekannt",
    });
  } catch (error) {
    console.error("Geo lookup error:", error);
    return NextResponse.json({
      ip: "unknown",
      city: "Unbekannt",
      country: "Unbekannt",
    });
  }
}
