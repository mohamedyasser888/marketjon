import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, fileType, fileName, fileSize, fileData } = body;

    if (!filePath || !fileType || !fileData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine bucket based on file type
    let bucket = "message-attachments";
    if (fileType.startsWith("image/")) {
      bucket = "jonathon-images";
    }

    // Decode base64 to buffer
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = Buffer.from(bytes);

    const supabase = createAdminClient();

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[api/upload] Storage upload failed:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicData.publicUrl });
  } catch (error: any) {
    console.error("[api/upload] POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
