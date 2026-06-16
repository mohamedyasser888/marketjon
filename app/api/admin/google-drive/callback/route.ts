import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log("[google-drive-callback] Callback received");
  
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  console.log("[google-drive-callback] Code present:", !!code);
  console.log("[google-drive-callback] Error present:", !!error);

  if (error) {
    console.error("[google-drive-callback] OAuth error:", error);
    return NextResponse.redirect(new URL("/admin?google_drive_error=" + error, request.url));
  }

  if (!code) {
    console.error("[google-drive-callback] No authorization code provided");
    return NextResponse.redirect(new URL("/admin?google_drive_error=no_code", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/admin/google-drive/callback";

  console.log("[google-drive-callback] Client ID configured:", !!clientId);
  console.log("[google-drive-callback] Client Secret configured:", !!clientSecret);
  console.log("[google-drive-callback] Redirect URI:", redirectUri);

  if (!clientId || !clientSecret) {
    console.error("[google-drive-callback] Google credentials not configured");
    return NextResponse.redirect(new URL("/admin?google_drive_error=no_credentials", request.url));
  }

  try {
    console.log("[google-drive-callback] Exchanging code for tokens...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    console.log("[google-drive-callback] Token response status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[google-drive-callback] Token error:", errorText);
      return NextResponse.redirect(new URL("/admin?google_drive_error=token_exchange_failed", request.url));
    }

    const tokenData = await tokenResponse.json();
    console.log("[google-drive-callback] Token exchange successful");
    
    // Return the access token and redirect to admin
    const response = NextResponse.redirect(new URL("/admin?google_drive=connected", request.url));
    response.cookies.set("google_drive_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600, // 1 hour
    });

    if (tokenData.refresh_token) {
      response.cookies.set("google_drive_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2592000, // 30 days
      });
    }

    console.log("[google-drive-callback] Redirecting to admin with success");
    return response;
  } catch (error) {
    console.error("[google-drive-callback] Error:", error);
    return NextResponse.redirect(new URL("/admin?google_drive_error=unknown_error", request.url));
  }
}
