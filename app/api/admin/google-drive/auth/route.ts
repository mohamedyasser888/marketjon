import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/admin/google-drive/callback";

    console.log("[google-drive-auth] Client ID:", clientId ? "configured" : "missing");
    console.log("[google-drive-auth] Redirect URI:", redirectUri);

    if (!clientId) {
      return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 });
    }

    const scope = encodeURIComponent("https://www.googleapis.com/auth/drive.readonly");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    console.log("[google-drive-auth] Auth URL generated successfully, redirecting...");
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[google-drive-auth] Error:", error);
    return NextResponse.json({ error: "Failed to generate auth URL" }, { status: 500 });
  }
}
