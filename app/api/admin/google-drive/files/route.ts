import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log("[google-drive-files] Fetching files...");
  
  const accessToken = request.cookies.get("google_drive_access_token")?.value;
  console.log("[google-drive-files] Access token present:", !!accessToken);

  if (!accessToken) {
    console.error("[google-drive-files] No access token found");
    return NextResponse.json({ error: "Not authenticated with Google Drive" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const folderId = searchParams.get("folderId") || "root";
  const searchName = searchParams.get("searchName");
  console.log("[google-drive-files] Folder ID:", folderId, "Search name:", searchName);

  try {
    let query;
    if (searchName) {
      // Search for folder by name (including shared folders)
      query = `name='${searchName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    } else {
      // List files in the folder
      query = `'${folderId}' in parents and trashed=false`;
    }

    console.log("[google-drive-files] Calling Google Drive API...");
    const filesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=*`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("[google-drive-files] API response status:", filesResponse.status);

    if (!filesResponse.ok) {
      const errorText = await filesResponse.text();
      console.error("[google-drive-files] API error:", errorText);
      
      // Try to refresh token if expired
      if (filesResponse.status === 401) {
        const refreshToken = request.cookies.get("google_drive_refresh_token")?.value;
        console.log("[google-drive-files] Refresh token present:", !!refreshToken);
        if (refreshToken) {
          return NextResponse.json({ error: "Token expired, need to re-authenticate" }, { status: 401 });
        }
      }
      
      throw new Error("Failed to fetch files from Google Drive");
    }

    const filesData = await filesResponse.json();
    console.log("[google-drive-files] Files fetched successfully:", filesData.files?.length || 0);
    
    // Separate folders and files
    const folders = filesData.files.filter((file: any) => file.mimeType === "application/vnd.google-apps.folder");
    const files = filesData.files.filter((file: any) => file.mimeType !== "application/vnd.google-apps.folder");

    console.log("[google-drive-files] Folders:", folders.length, "Files:", files.length);

    return NextResponse.json({
      folders,
      files,
    });
  } catch (error) {
    console.error("[google-drive-files] Error:", error);
    return NextResponse.json({ error: "Failed to fetch files from Google Drive" }, { status: 500 });
  }
}
