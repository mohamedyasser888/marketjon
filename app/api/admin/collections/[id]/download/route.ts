import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import JSZip from "jszip";

type RouteContext = { params: Promise<{ id: string }> };

// Recursive function to fetch collection and all subcollections
async function fetchCollectionTree(supabase: any, collectionId: string, path: string = ""): Promise<any> {
  const { data: collection, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", collectionId)
    .single();

  if (error || !collection) {
    return null;
  }

  // Fetch subcollections
  const { data: subcollections } = await supabase
    .from("collections")
    .select("*")
    .eq("parent_id", collectionId);

  const children = subcollections || [];

  // Recursively fetch children
  const processedChildren = await Promise.all(
    children.map(async (child: any) => {
      const childPath = path ? `${path}/${child.name}` : child.name;
      return await fetchCollectionTree(supabase, child.id, childPath);
    })
  );

  return {
    ...collection,
    path: path || collection.name,
    children: processedChildren.filter(c => c !== null),
  };
}

// Recursive function to add collection images to zip
async function addCollectionToZip(zip: any, collection: any, basePath: string = "") {
  const currentPath = basePath ? `${basePath}/${collection.name}` : collection.name;
  const images = Array.isArray(collection.images) ? collection.images : [];

  // Add images from this collection
  for (let i = 0; i < images.length; i++) {
    try {
      const imageUrl = images[i];
      const imageRes = await fetch(imageUrl);
      const imageBlob = await imageRes.blob();
      
      // Generate filename
      const extension = imageUrl.split('.').pop() || 'jpg';
      const filename = `image_${i + 1}.${extension}`;
      const zipPath = `${currentPath}/${filename}`;
      
      zip.file(zipPath, imageBlob);
    } catch (err) {
      console.error(`Failed to download image ${i} from ${collection.name}:`, err);
    }
  }

  // Recursively add subcollections
  for (const child of collection.children) {
    await addCollectionToZip(zip, child, currentPath);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = createAdminClient();

    // Fetch collection tree recursively
    const collectionTree = await fetchCollectionTree(supabase, id);

    if (!collectionTree) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Create zip file
    const zip = new JSZip();
    
    // Add all collections and their images to zip
    await addCollectionToZip(zip, collectionTree);

    // Generate zip
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${collectionTree.name}.zip"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/collections/[id]/download] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
