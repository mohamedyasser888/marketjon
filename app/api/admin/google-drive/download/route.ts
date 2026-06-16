import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("google_drive_access_token")?.value;
  const body = await request.json();
  const { fileId } = body;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated with Google Drive" }, { status: 401 });
  }

  if (!fileId) {
    return NextResponse.json({ error: "File ID is required" }, { status: 400 });
  }

  try {
    // Get file metadata to get the download URL
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webContentLink`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!metadataResponse.ok) {
      throw new Error("Failed to fetch file metadata");
    }

    const metadata = await metadataResponse.json();

    // Download the file
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error("Failed to download file");
    }

    const fileBuffer = await downloadResponse.arrayBuffer();
    const fileBlob = new Blob([fileBuffer]);

    return NextResponse.json({
      success: true,
      fileName: metadata.name,
      mimeType: metadata.mimeType,
      fileData: Buffer.from(fileBuffer).toString("base64"),
    });
  } catch (error) {
    console.error("[google-drive-download] Error:", error);
    return NextResponse.json({ error: "Failed to download file from Google Drive" }, { status: 500 });
  }
}
