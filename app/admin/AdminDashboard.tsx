"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useToast } from "@/components/Toast";
import AdminImage from "@/components/AdminImage";
import CollectionDownloadButtons from "@/components/CollectionDownloadButtons";
import CollectionAvailabilityPicker from "@/components/CollectionAvailabilityPicker";
import type { CollectionAvailability } from "@/lib/collection-availability";
import type { Collection, Product, Ticket } from "@/lib/types/profile";
import { filterImageFiles, isImageFile } from "@/lib/image-files";
import {
  MAGICAL_PRICE_HINT,
  parseMagicalPrice,
  formatPriceDisplay,
} from "@/lib/magical-price";
import PriceDisplay from "@/components/PriceDisplay";
import AdminTicketsPanel from "./AdminTicketsPanel";
import UserListSidebar from "@/components/UserListSidebar";
import AdminInboxPanel from "@/components/AdminInboxPanel";
import AdminHistoryPanel from "@/components/AdminHistoryPanel";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
}

// FolderItem component for displaying folder hierarchy
function FolderItem({ collection, allCollections, level }: { collection: Collection; allCollections: Collection[]; level: number }) {
  const children = allCollections.filter(c => c.parent_id === collection.id);
  const paddingLeft = level * 20;

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-900/50 transition-colors"
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
      >
        {level > 0 && (
          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        <svg className="w-5 h-5 text-[#3886c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="text-xs font-medium text-zinc-200">{collection.name}</span>
        {children.length > 0 && (
          <span className="text-[10px] text-zinc-500">({children.length} subfolder{children.length > 1 ? 's' : ''})</span>
        )}
      </div>
      {children.map(child => (
        <FolderItem key={child.id} collection={child} allCollections={allCollections} level={level + 1} />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"collections" | "products" | "tickets" | "inbox" | "folders" | "history" | "nested" | "pricing" | "washing">("collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ticketCount, setTicketCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserSidebar, setShowUserSidebar] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  // Collections form state
  const [colName, setColName] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [colFile, setColFile] = useState<File | null>(null);
  const [colPreview, setColPreview] = useState("");
  const [colGalleryFiles, setColGalleryFiles] = useState<File[]>([]);
  const [colGalleryPreviews, setColGalleryPreviews] = useState<string[]>([]);
  const [colUploadProgress, setColUploadProgress] = useState<string | null>(null);
  const [colDefaultPrice, setColDefaultPrice] = useState("k");

  const [manageColId, setManageColId] = useState("");
  const [manageBulkPrice, setManageBulkPrice] = useState("");
  const [manageFolderFiles, setManageFolderFiles] = useState<File[]>([]);
  const [manageFolderPreviews, setManageFolderPreviews] = useState<string[]>([]);

  // Folders form state
  const [folderName, setFolderName] = useState("");
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const productsPerPage = 12;
  const [uploadingFolder, setUploadingFolder] = useState(false);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<any[]>([]);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<any[]>([]);
  const [selectedGoogleDriveFolder, setSelectedGoogleDriveFolder] = useState<string | null>(null);
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState<any | null>(null);
  const [googleDriveBreadcrumbs, setGoogleDriveBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loadingGoogleDrive, setLoadingGoogleDrive] = useState(false);
  const [uploadingFromGoogleDrive, setUploadingFromGoogleDrive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [targetFolderName] = useState("متجر آل جوناثان للملابس السحرية");
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [folderPreview, setFolderPreview] = useState<any | null>(null);
  const [showFolderPreview, setShowFolderPreview] = useState(false);
  const [collectionHistory, setCollectionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedCollectionNodes, setExpandedCollectionNodes] = useState<Set<string>>(new Set());
  const [nestedRootCollection, setNestedRootCollection] = useState("");
  const [nestedSubCollection, setNestedSubCollection] = useState("");
  const [historyFilterDate, setHistoryFilterDate] = useState("");
  const [historyFilterAction, setHistoryFilterAction] = useState("");
  
  
  // Washing tab state
  const [washingBuyerName, setWashingBuyerName] = useState("");
  const [washingSellerName, setWashingSellerName] = useState("");
  const [washingPrice, setWashingPrice] = useState("");
  const [washingPieces, setWashingPieces] = useState("");
  const [washingImages, setWashingImages] = useState<File[]>([]);
  const [washingImagePreviews, setWashingImagePreviews] = useState<string[]>([]);
  const [savingWashingEntry, setSavingWashingEntry] = useState(false);
  const [buyerNames, setBuyerNames] = useState<string[]>([]);
  const [sellerNames, setSellerNames] = useState<string[]>(["cronix", "ella", "elena", "levi", "danny", "silver", "selena", "lucan", "evander", "amelia", "fluer"]);

  // Products form state
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodColId, setProdColId] = useState("");
  const [prodFile, setProdFile] = useState<File | null>(null);
  const [prodPreview, setProdPreview] = useState("");

  useEffect(() => {
    fetchData();
    checkGoogleDriveConnection();
    fetchCollectionHistory();
    fetchBuyerNames();
    
    // Check if Google Drive connection was successful from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_drive') === 'connected') {
      setGoogleDriveConnected(true);
      fetchGoogleDriveFiles(null);
      // Clean up URL
      window.history.replaceState({}, '', '/admin');
    }
  }, []);

  useEffect(() => {
    async function refreshTicketCount() {
      try {
        const res = await fetch("/api/admin/tickets", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setTicketCount(data.filter((t: Ticket) => t.status !== "deleted").length);
        }
      } catch (err) {
        console.error("[refreshTicketCount] Error:", err);
      }
    }

    async function refreshUnreadMessageCount() {
      try {
        const res = await fetch("/api/messages", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          const unreadCount = data.filter((msg: any) => !msg.is_read && msg.sender_id !== null).length;
          setUnreadMessageCount(unreadCount);
        }
      } catch (err) {
        console.error("[refreshUnreadMessageCount] Error:", err);
      }
    }

    refreshTicketCount();
    refreshUnreadMessageCount();
    const ticketInterval = setInterval(refreshTicketCount, 4000);
    const messageInterval = setInterval(refreshUnreadMessageCount, 4000);
    return () => {
      clearInterval(ticketInterval);
      clearInterval(messageInterval);
    };
  }, []);

  async function fetchData() {
    setFetchLoading(true);
    try {
      const [colRes, prodRes, tickRes] = await Promise.all([
        fetch("/api/admin/collections"),
        fetch("/api/admin/products"),
        fetch("/api/admin/tickets", { cache: "no-store" }),
      ]);

      if (colRes.ok) setCollections(await colRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (tickRes.ok) {
        const allTickets = await tickRes.json();
        setTicketCount(
          Array.isArray(allTickets)
            ? allTickets.filter((t: Ticket) => t.status !== "deleted").length
            : 0
        );
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
      toast("Error loading admin records", "error");
    } finally {
      setFetchLoading(false);
    }
  }

  // Handle image upload helper
  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "File upload failed");
    }

    const data = await res.json();
    return data.url;
  }

  function pickFolderImages(
    fileList: FileList | null,
    onPicked: (files: File[]) => void
  ) {
    const all = Array.from(fileList || []);
    const images = filterImageFiles(all);
    if (images.length > 0) {
      toast(`Loaded ${images.length} image(s) (PNG, JPG, WebP, etc.)`, "success");
    } else if (all.length > 0) {
      toast(
        `Found ${all.length} file(s) but no images. Use .png, .jpg, .webp, etc.`,
        "error"
      );
    }
    onPicked(images);
  }

  function loadFilePreviews(files: File[], setter: (urls: string[]) => void) {
    if (files.length === 0) {
      setter([]);
      return;
    }
    const previews: string[] = [];
    let loaded = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        loaded++;
        if (loaded === files.length) setter([...previews]);
      };
      reader.readAsDataURL(file);
    });
  }

  // Submit Collection
  async function handleColSubmit(e: FormEvent) {
    e.preventDefault();
    if (!colName.trim()) return;
    setLoading(true);
    setColUploadProgress("Initiating collection upload...");

    try {
      let imageUrl = "";
      if (colFile) {
        setColUploadProgress("Uploading main thumbnail image...");
        imageUrl = await uploadImage(colFile);
      }

      // Upload gallery images in sequence
      const galleryUrls: string[] = [];
      if (colGalleryFiles.length > 0) {
        for (let i = 0; i < colGalleryFiles.length; i++) {
          setColUploadProgress(`Uploading gallery image ${i + 1} of ${colGalleryFiles.length}...`);
          const url = await uploadImage(colGalleryFiles[i]);
          galleryUrls.push(url);
        }
      }

      setColUploadProgress("Creating collection in database...");

      const parsedPrice = parseMagicalPrice(colDefaultPrice);
      if (!parsedPrice.valid) {
        throw new Error(parsedPrice.error);
      }

      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: colName.trim(),
          description: colDesc.trim(),
          image_url: imageUrl || galleryUrls[0] || null,
          images: galleryUrls,
          image_names: colGalleryFiles.map((f) => f.name),
          default_price: parsedPrice.storage,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create collection");
      }

      const result = await res.json();
      toast(
        galleryUrls.length > 0
          ? `Collection created with ${galleryUrls.length} picture(s) as products.`
          : "Empty collection created (no pictures inside).",
        "success"
      );
      setColName("");
      setColDesc("");
      setColFile(null);
      setColPreview("");
      setColGalleryFiles([]);
      setColGalleryPreviews([]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to create collection", "error");
    } finally {
      setLoading(false);
      setColUploadProgress(null);
    }
  }

  // Submit Folder
  async function handleFolderSubmit(e: FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName.trim(),
          description: "",
          image_url: null,
          images: [],
          image_names: [],
          default_price: "k",
          parent_id: currentFolderId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create folder");
      }

      const result = await res.json();
      toast("Folder created successfully", "success");
      setFolderName("");
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to create folder", "error");
    } finally {
      setLoading(false);
    }
  }

  function navigateToFolder(folderId: string | null, folderName: string) {
    if (folderId === null) {
      setCurrentFolderId(null);
      setFolderBreadcrumbs([]);
      setProductsPage(1);
    } else {
      const newBreadcrumbs = [...folderBreadcrumbs];
      const existingIndex = newBreadcrumbs.findIndex(b => b.id === folderId);
      if (existingIndex >= 0) {
        setFolderBreadcrumbs(newBreadcrumbs.slice(0, existingIndex + 1));
      } else {
        setFolderBreadcrumbs([...newBreadcrumbs, { id: folderId, name: folderName }]);
      }
      setCurrentFolderId(folderId);
      setProductsPage(1);
    }
  }

  async function handleFolderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFolder(true);
    try {
      // Build folder structure from webkitRelativePath
      const folderStructure = new Map<string, { files: File[], subfolders: Set<string> }>();
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = (file as any).webkitRelativePath || file.name;
        const pathParts = path.split('/');
        
        console.log(`[handleFolderUpload] Processing file: ${path}, parts:`, pathParts);
        
        // Process each path segment to build folder hierarchy
        let currentPath = '';
        for (let j = 0; j < pathParts.length - 1; j++) {
          const folderName = pathParts[j];
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
          
          if (!folderStructure.has(currentPath)) {
            folderStructure.set(currentPath, { files: [], subfolders: new Set() });
            console.log(`[handleFolderUpload] Created folder: ${currentPath}`);
          }
          
          // Add to parent's subfolders
          if (j > 0) {
            const parentPath = pathParts.slice(0, j).join('/');
            if (folderStructure.has(parentPath)) {
              folderStructure.get(parentPath)!.subfolders.add(currentPath);
            }
          }
        }
        
        // Add file to its folder
        const folderPath = pathParts.slice(0, -1).join('/');
        if (folderStructure.has(folderPath)) {
          folderStructure.get(folderPath)!.files.push(file);
          console.log(`[handleFolderUpload] Added file to folder: ${folderPath}`);
        } else {
          console.warn(`[handleFolderUpload] Folder not found for file: ${folderPath}`);
        }
      }

      console.log("[handleFolderUpload] Final folder structure:", Array.from(folderStructure.keys()));
      console.log("[handleFolderUpload] Folder details:", Array.from(folderStructure.entries()).map(([k, v]) => ({ path: k, fileCount: v.files.length, subfolderCount: v.subfolders.size })));

      // Create collections for each folder and upload images
      for (const [folderPath, folderData] of folderStructure.entries()) {
        const folderName = folderPath.split('/').pop() || folderPath;
        
        // Create collection
        const createRes = await fetch("/api/admin/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: folderName,
            description: `Folder: ${folderPath}`,
            image_url: null,
            images: [],
            image_names: [],
            parent_id: currentFolderId,
          }),
        });

        if (!createRes.ok) {
          console.error(`Failed to create collection for folder: ${folderPath}`);
          continue;
        }

        const collection = await createRes.json();
        const collectionId = collection.id;

        // Upload images to this collection
        const imageFiles = folderData.files.filter(f => f.type.startsWith('image/'));
        
        for (const file of imageFiles) {
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await fetch('/api/admin/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            console.error(`Failed to upload image: ${file.name}`);
            continue;
          }

          const uploadData = await uploadRes.json();
          const imageUrl = uploadData.url;

          // Create product from the uploaded image
          const productName = file.name.split('.')[0] || file.name;
          const productRes = await fetch("/api/admin/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: productName,
              description: `From folder: ${folderPath}`,
              price: 1000,
              collection_id: collectionId,
              image_url: imageUrl,
            }),
          });

          if (!productRes.ok) {
            console.error(`Failed to create product for: ${file.name}`);
          }
        }
      }

      toast(`Uploaded ${folderStructure.size} folders with all subfolders and images`, "success");
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to upload folder", "error");
    } finally {
      setUploadingFolder(false);
      e.target.value = ''; // Reset input
    }
  }

  async function checkGoogleDriveConnection() {
    try {
      const res = await fetch("/api/admin/google-drive/files");
      const isConnected = res.ok;
      console.log("[checkGoogleDriveConnection] Connected:", isConnected);
      setGoogleDriveConnected(isConnected);
      if (isConnected) {
        fetchGoogleDriveFiles(null);
      }
    } catch {
      console.log("[checkGoogleDriveConnection] Connection check failed");
      setGoogleDriveConnected(false);
    }
  }

  async function connectGoogleDrive() {
    try {
      console.log("[connectGoogleDrive] Starting connection...");
      // Direct redirect to Google OAuth
      window.location.href = "/api/admin/google-drive/auth";
    } catch (err: any) {
      console.error("[connectGoogleDrive] Error:", err);
      toast(err.message || "Failed to connect to Google Drive", "error");
    }
  }

  async function fetchGoogleDriveFiles(folderId: string | null = null) {
    setLoadingGoogleDrive(true);
    try {
      console.log("[fetchGoogleDriveFiles] Fetching files for folder:", folderId || "root");
      const res = await fetch(`/api/admin/google-drive/files?folderId=${folderId || "root"}`);
      console.log("[fetchGoogleDriveFiles] Response status:", res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("[fetchGoogleDriveFiles] Error:", errorData);
        throw new Error(errorData.error || "Failed to fetch Google Drive files");
      }
      
      const data = await res.json();
      console.log("[fetchGoogleDriveFiles] Files received:", data.folders?.length || 0, "folders,", data.files?.length || 0, "files");
      
      setGoogleDriveFolders(data.folders || []);
      setGoogleDriveFiles(data.files || []);
      setSelectedGoogleDriveFolder(folderId);
      setSelectedFolderForUpload(null); // Reset selected folder when navigating
      
      // Update breadcrumbs
      if (folderId === null) {
        setGoogleDriveBreadcrumbs([]);
      } else {
        // Find folder name from current folders
        const folder = googleDriveFolders.find(f => f.id === folderId);
        if (folder) {
          setGoogleDriveBreadcrumbs([...googleDriveBreadcrumbs, { id: folder.id, name: folder.name }]);
        }
      }
    } catch (err: any) {
      console.error("[fetchGoogleDriveFiles] Error:", err);
      toast(err.message || "Failed to fetch Google Drive files", "error");
    } finally {
      setLoadingGoogleDrive(false);
    }
  }

  async function searchTargetFolder() {
    setLoadingGoogleDrive(true);
    try {
      console.log("[searchTargetFolder] Searching for folder:", targetFolderName);
      const res = await fetch(`/api/admin/google-drive/files?searchName=${encodeURIComponent(targetFolderName)}`);
      console.log("[searchTargetFolder] Response status:", res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("[searchTargetFolder] Error:", errorData);
        throw new Error(errorData.error || "Failed to search Google Drive");
      }
      
      const data = await res.json();
      console.log("[searchTargetFolder] Found:", data.folders?.length || 0, "folders");
      
      if (data.folders && data.folders.length > 0) {
        const targetFolder = data.folders[0];
        setSelectedFolderForUpload(targetFolder);
        toast(`Found folder: ${targetFolder.name}`, "success");
        // Fetch contents of the target folder
        await fetchGoogleDriveFiles(targetFolder.id);
      } else {
        toast(`Folder "${targetFolderName}" not found in your Google Drive`, "error");
      }
    } catch (err: any) {
      console.error("[searchTargetFolder] Error:", err);
      toast(err.message || "Failed to search Google Drive", "error");
    } finally {
      setLoadingGoogleDrive(false);
    }
  }

  function toggleFolderExpand(folderId: string) {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }

  // Recursive function to fetch folder structure from Google Drive
  async function fetchGoogleDriveFolderStructure(folderId: string): Promise<any> {
    const res = await fetch(`/api/admin/google-drive/files?folderId=${folderId}`);
    if (!res.ok) throw new Error("Failed to fetch folder");
    const data = await res.json();
    
    const folders = data.files.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
    const images = data.files.filter((f: any) => f.mimeType?.startsWith('image/'));
    
    console.log(`[fetchGoogleDriveFolderStructure] Folder ${folderId}: ${folders.length} folders, ${images.length} images`);
    
    // Recursively fetch subfolders with their images
    const subfolders = await Promise.all(
      folders.map(async (folder: any) => {
        const subfolderStructure = await fetchGoogleDriveFolderStructure(folder.id);
        return {
          ...folder,
          subfolders: subfolderStructure.folders,
          images: subfolderStructure.images
        };
      })
    );
    
    return {
      folders: subfolders,
      images: images
    };
  }

  // Count total images in folder structure
  function countTotalImages(structure: any): number {
    let count = structure.images?.length || 0;
    if (structure.folders) {
      for (const folder of structure.folders) {
        count += countTotalImages(folder);
      }
    }
    return count;
  }

  async function handleGoogleDriveUpload() {
    const targetFolderId = selectedFolderForUpload ? selectedFolderForUpload.id : selectedGoogleDriveFolder;
    const targetFolderName = selectedFolderForUpload ? selectedFolderForUpload.name : (selectedGoogleDriveFolder ? "Google Drive Folder" : "Google Drive Upload");
    
    try {
      // Fetch folder structure recursively for preview
      const structure = await fetchGoogleDriveFolderStructure(targetFolderId || "root");
      const totalImages = countTotalImages(structure);
      
      if (totalImages === 0) {
        toast("No image files found in folder or subfolders", "info");
        return;
      }

      // Show preview
      setFolderPreview({ structure, targetFolderName, totalImages, targetFolderId });
      setShowFolderPreview(true);
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to fetch folder structure", "error");
    }
  }

  async function confirmGoogleDriveUpload() {
    if (!folderPreview) return;
    
    setUploadingFromGoogleDrive(true);
    setUploadStartTime(Date.now());
    setEstimatedTimeRemaining(null);
    setShowFolderPreview(false);
    
    try {
      const { structure, targetFolderName, totalImages } = folderPreview;

      setUploadProgress({ current: 0, total: totalImages });

      // Create root collection
      const createRes = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: targetFolderName,
          description: "Uploaded from Google Drive",
          image_url: null,
          images: [],
          image_names: [],
          parent_id: currentFolderId,
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create collection for folder");
      }

      const rootCollection = await createRes.json();
      let uploadedCount = 0;
      const batchSize = 5;

      // Recursive function to upload folder structure
      async function uploadFolder(folderStructure: any, parentId: string, path: string) {
        // Upload images in current folder
        if (folderStructure.images && folderStructure.images.length > 0) {
          const collectionName = path || targetFolderName;
          
          // Create sub-collection if this is a subfolder
          let collectionId = rootCollection.id;
          if (path !== targetFolderName) {
            const subRes = await fetch("/api/admin/collections", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: collectionName,
                description: `Subfolder: ${path}`,
                image_url: null,
                images: [],
                image_names: [],
                parent_id: parentId,
              }),
            });

            if (subRes.ok) {
              const subCollection = await subRes.json();
              collectionId = subCollection.id;
            }
          }

          // Upload images in batches
          for (let i = 0; i < folderStructure.images.length; i += batchSize) {
            const batch = folderStructure.images.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (file: any) => {
              try {
                const downloadRes = await fetch("/api/admin/google-drive/download", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fileId: file.id }),
                });

                if (!downloadRes.ok) {
                  console.error(`Failed to download file: ${file.name}`);
                  return;
                }

                const downloadData = await downloadRes.json();
                
                // Convert base64 to blob
                const byteCharacters = atob(downloadData.fileData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let j = 0; j < byteCharacters.length; j++) {
                  byteNumbers[j] = byteCharacters.charCodeAt(j);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: downloadData.mimeType });
                const fileObj = new File([blob], downloadData.fileName, { type: downloadData.mimeType });

                const formData = new FormData();
                formData.append('file', fileObj);

                const uploadRes = await fetch('/api/admin/upload', {
                  method: 'POST',
                  body: formData,
                });

                if (!uploadRes.ok) {
                  console.error(`Failed to upload image: ${downloadData.fileName}`);
                  return;
                }

                const uploadData = await uploadRes.json();
                const imageUrl = uploadData.url;

                // Create product from the uploaded image
                const productName = downloadData.fileName.split('.')[0] || downloadData.fileName;
                const productRes = await fetch("/api/admin/products", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: productName,
                    description: `Uploaded from Google Drive: ${path}`,
                    price: 1000,
                    collection_id: collectionId,
                    image_url: imageUrl,
                  }),
                });

                if (!productRes.ok) {
                  const errorData = await productRes.json();
                  console.error(`Failed to create product for: ${downloadData.fileName}`, errorData);
                }
                
                uploadedCount++;
                setUploadProgress({ current: uploadedCount, total: totalImages });
                
                // Calculate estimated time remaining
                if (uploadStartTime) {
                  const elapsed = Date.now() - uploadStartTime;
                  const avgTimePerFile = elapsed / uploadedCount;
                  const remaining = totalImages - uploadedCount;
                  const estimatedMs = avgTimePerFile * remaining;
                  setEstimatedTimeRemaining(estimatedMs);
                }
              } catch (err) {
                console.error(`Failed to process file: ${file.name}`, err);
              }
            }));
          }
        }
        
        // Recursively upload subfolders
        if (folderStructure.folders && folderStructure.folders.length > 0) {
          for (const folder of folderStructure.folders) {
            const subPath = path ? `${path}/${folder.name}` : folder.name;
            await uploadFolder(folder, rootCollection.id, subPath);
          }
        }
      }

      await uploadFolder(structure, rootCollection.id, targetFolderName);

      toast(`Uploaded ${uploadedCount} images from "${targetFolderName}" and all subfolders`, "success");
      fetchData();
      setSelectedFolderForUpload(null);
      setFolderPreview(null);
      setUploadProgress({ current: 0, total: 0 });
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to upload from Google Drive", "error");
    } finally {
      setUploadingFromGoogleDrive(false);
      setUploadStartTime(null);
      setEstimatedTimeRemaining(null);
    }
  }

  // Recursive component to render folder structure
  function FolderStructurePreview({ structure, path = "", level = 0 }: { structure: any, path?: string, level?: number }) {
    const hasImages = structure.images && structure.images.length > 0;
    const hasSubfolders = structure.folders && structure.folders.length > 0;
    
    return (
      <div className="ml-4">
        {path && (
          <div className="flex items-center gap-2 py-1 text-xs text-zinc-300">
            <span className="text-zinc-500">📁</span>
            <span className="font-medium">{path}</span>
            {hasImages && <span className="text-zinc-500">({structure.images.length} images)</span>}
          </div>
        )}
        
        {hasImages && (
          <div className="ml-4 py-1 text-xs text-zinc-400">
            Images: {structure.images.map((img: any) => img.name).join(", ")}
          </div>
        )}
        
        {hasSubfolders && structure.folders.map((folder: any, index: number) => (
          <FolderStructurePreview
            key={index}
            structure={folder}
            path={path ? `${path}/${folder.name}` : folder.name}
            level={level + 1}
          />
        ))}
      </div>
    );
  }

  async function handleApplyPriceToAll() {
    if (!manageColId) {
      toast("Select a collection folder first", "info");
      return;
    }
    console.log("[handleApplyPriceToAll] Collection ID:", manageColId);
    console.log("[handleApplyPriceToAll] Bulk price:", manageBulkPrice);
    console.log("[handleApplyPriceToAll] Default price:", colDefaultPrice);

    const priceParsed = parseMagicalPrice(manageBulkPrice || colDefaultPrice);
    if (!priceParsed.valid) {
      console.log("[handleApplyPriceToAll] Invalid price:", priceParsed.error);
      toast(priceParsed.error, "error");
      return;
    }
    console.log("[handleApplyPriceToAll] Parsed price storage:", priceParsed.storage);
    console.log("[handleApplyPriceToAll] Parsed price numeric:", priceParsed.numeric);

    setLoading(true);
    try {
      // Find all subcollections recursively
      const allCollectionIds = [manageColId];
      const findSubcollections = async (parentId: string) => {
        const subcollections = collections.filter(c => c.parent_id === parentId);
        for (const sub of subcollections) {
          allCollectionIds.push(sub.id);
          await findSubcollections(sub.id);
        }
      };
      await findSubcollections(manageColId);

      console.log("[handleApplyPriceToAll] Updating prices for collections:", allCollectionIds);

      // Update prices for all collections in the hierarchy
      let totalUpdated = 0;
      for (const collectionId of allCollectionIds) {
        const res = await fetch("/api/admin/products/bulk-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection_id: collectionId,
            price: priceParsed.numeric,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          totalUpdated += data.updated || 0;
        }
      }

      console.log("[handleApplyPriceToAll] Total updated:", totalUpdated);
      toast(
        `Price ${formatPriceDisplay(priceParsed.storage)} applied to ${totalUpdated} item(s) across ${allCollectionIds.length} collection(s).`,
        "success"
      );
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed";
      console.error("[handleApplyPriceToAll] Error:", err);
      console.error("[handleApplyPriceToAll] Error message:", message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFilesToFolder() {
    if (!manageColId) {
      toast("Select a collection folder first", "info");
      return;
    }
    if (manageFolderFiles.length === 0) {
      toast("Choose a folder or image files to add", "info");
      return;
    }
    setLoading(true);
    setColUploadProgress("Adding files to folder...");
    try {
      const urls: string[] = [];
      for (let i = 0; i < manageFolderFiles.length; i++) {
        setColUploadProgress(`Uploading ${i + 1} / ${manageFolderFiles.length}...`);
        urls.push(await uploadImage(manageFolderFiles[i]));
      }
      const parsedPrice = parseMagicalPrice(manageBulkPrice || colDefaultPrice);
      if (!parsedPrice.valid) {
        throw new Error(parsedPrice.error);
      }

      const res = await fetch(`/api/admin/collections/${manageColId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: urls,
          image_names: manageFolderFiles.map((f) => f.name),
          default_price: parsedPrice.storage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update folder");

      toast(
        `Added ${urls.length} file(s). ${data.products_created} new product(s) created.`,
        "success"
      );
      setManageFolderFiles([]);
      setManageFolderPreviews([]);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed";
      toast(message, "error");
    } finally {
      setLoading(false);
      setColUploadProgress(null);
    }
  }

  async function handleSetAvailability(
    collectionId: string,
    status: CollectionAvailability
  ) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability_status: status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId ? { ...c, availability_status: status } : c
        )
      );
      toast("Store status updated", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update status", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishCollection(collectionId: string, collectionName: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast(`"${collectionName}" is live for users`, "success");
      fetchData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Publish failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCollection(collectionId: string, collectionName: string) {
    if (
      !confirm(
        `Delete folder "${collectionName}" and all its pictures and products? This cannot be undone.`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collections/${collectionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (manageColId === collectionId) {
        setManageColId("");
        setManageFolderFiles([]);
        setManageFolderPreviews([]);
      }
      toast(`Deleted folder "${collectionName}"`, "info");
      fetchData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAllCollections() {
    if (!confirm("Delete ALL collections and their products? This cannot be undone.")) return;
    setLoading(true);
    try {
      const deletePromises = collections.map((col) =>
        fetch(`/api/admin/collections/${col.id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);

      toast(`Deleted ${collections.length} collections`, "success");
      fetchData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete all", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadCollection(collectionId: string, collectionName: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collections/${collectionId}/download`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to download collection");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${collectionName}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Log to history
      await fetch("/api/admin/collection-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          action: "download",
          details: { collection_name: collectionName },
        }),
      });

      toast(`Downloaded "${collectionName}"`, "success");
      fetchCollectionHistory();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to download", "error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCollectionHistory() {
    try {
      const res = await fetch("/api/admin/collection-history");
      if (res.ok) {
        const data = await res.json();
        setCollectionHistory(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch collection history:", err);
    }
  }

  async function handleDeleteHistory() {
    if (!confirm("Delete all collection history? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/collection-history", { method: "DELETE" });
      if (res.ok) {
        toast("Collection history deleted", "success");
        setCollectionHistory([]);
      }
    } catch (err) {
      toast("Failed to delete history", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadHistory() {
    setLoading(true);
    try {
      const historyToDownload = filterHistory();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast("Failed to open print window", "error");
        setLoading(false);
        return;
      }
      
      printWindow.document.write(generateHistoryPDF(historyToDownload));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      toast("History ready for PDF download", "success");
    } catch (err) {
      toast("Failed to download history", "error");
    } finally {
      setLoading(false);
    }
  }

  function generateHistoryPDF(history: any[]) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Collection History</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          @media print {
            body { padding: 0; }
            h1 { page-break-before: auto; }
          }
        </style>
      </head>
      <body>
        <h1>Collection History</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Collection Name</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td>${h.created_at ? new Date(h.created_at).toLocaleString() : ''}</td>
                <td>${h.action || ''}</td>
                <td>${h.details?.collection_name || ''}</td>
                <td>${JSON.stringify(h.details || {})}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    return htmlContent;
  }

  function filterHistory() {
    return collectionHistory.filter(h => {
      if (historyFilterDate) {
        const historyDate = h.created_at?.split('T')[0];
        if (historyDate !== historyFilterDate) return false;
      }
      if (historyFilterAction) {
        if (h.action !== historyFilterAction) return false;
      }
      return true;
    });
  }

  async function handleSetNestedFolder() {
    if (!nestedRootCollection || !nestedSubCollection) {
      toast("Select both root and subfolder collections", "info");
      return;
    }
    if (nestedRootCollection === nestedSubCollection) {
      toast("Root and subfolder cannot be the same collection", "error");
      return;
    }
    setLoading(true);
    try {
      const rootCol = collections.find(c => c.id === nestedRootCollection);
      const subCol = collections.find(c => c.id === nestedSubCollection);
      
      console.log("[handleSetNestedFolder] Setting parent_id:", nestedRootCollection, "for collection:", nestedSubCollection);
      console.log("[handleSetNestedFolder] Root:", rootCol?.name, "Sub:", subCol?.name);
      
      const res = await fetch(`/api/admin/collections/${nestedSubCollection}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: nestedRootCollection }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set nested folder");
      }
      const result = await res.json();
      console.log("[handleSetNestedFolder] API response:", result);
      
      toast(`Set "${subCol?.name}" as subfolder of "${rootCol?.name}"`, "success");
      await fetchData(); // Wait for data to refresh
      setNestedRootCollection("");
      setNestedSubCollection("");
    } catch (err: unknown) {
      console.error("[handleSetNestedFolder] Error:", err);
      toast(err instanceof Error ? err.message : "Failed to set nested folder", "error");
    } finally {
      setLoading(false);
    }
  }

  // Build tree structure from collections
  function buildCollectionTree(collections: any[]) {
    const collectionMap = new Map<string, any>();
    const rootCollections: any[] = [];

    console.log("[buildCollectionTree] Input collections:", collections.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id })));

    // First pass: create map
    collections.forEach(col => {
      collectionMap.set(col.id, { ...col, children: [] });
    });

    // Second pass: build tree
    collections.forEach(col => {
      const node = collectionMap.get(col.id);
      if (!node) return;

      if (col.parent_id && collectionMap.has(col.parent_id)) {
        const parent = collectionMap.get(col.parent_id);
        parent.children.push(node);
        console.log(`[buildCollectionTree] Added ${col.name} as child of ${parent.name}`);
      } else {
        rootCollections.push(node);
        console.log(`[buildCollectionTree] Added ${col.name} as root`);
      }
    });

    console.log("[buildCollectionTree] Root collections:", rootCollections.map(c => c.name));
    return rootCollections;
  }

  // Recursive component to render collection tree
  function CollectionTreeNode({ node, level = 0 }: { node: any, level?: number }) {
    const isExpanded = expandedCollectionNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    console.log(`[CollectionTreeNode] Rendering ${node.name}, children: ${hasChildren ? node.children.length : 0}, expanded: ${isExpanded}`);

    return (
      <div className="ml-4">
        <div className="flex items-center gap-2 py-2 border-b border-zinc-800/50">
          {hasChildren && (
            <button
              onClick={() => {
                setExpandedCollectionNodes(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(node.id)) {
                    newSet.delete(node.id);
                  } else {
                    newSet.add(node.id);
                  }
                  return newSet;
                });
              }}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          {!hasChildren && <span className="w-4" />}
          <span className="text-zinc-500">📁</span>
          <span className="text-xs text-zinc-200 font-medium flex-1">{node.name}</span>
          <span className="text-[10px] text-zinc-500">{node.images?.length || 0} images</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => setManageColId(node.id)}
            className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-zinc-900"
          >
            Manage
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDownloadCollection(node.id, node.name)}
            className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300"
          >
            Download
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDeleteCollection(node.id, node.name)}
            className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-300"
          >
            Delete
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child: any) => (
              <CollectionTreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  async function handleRemoveFolderImage(imageUrl: string) {
    if (!manageColId) return;
    if (!confirm("Remove this picture from the folder and delete its product?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collections/${manageColId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove_image_urls: [imageUrl] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      toast("Picture removed", "info");
      fetchData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct(productId: string, productName: string) {
    if (!confirm(`Delete product "${productName}" and its image?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast(`Deleted "${productName}"`, "info");
      fetchData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncFolderProducts() {
    if (!manageColId) {
      toast("Select a collection folder first", "info");
      return;
    }
    setLoading(true);
    try {
      console.log("[handleSyncFolderProducts] Starting sync for collection:", manageColId);
      console.log("[handleSyncFolderProducts] Bulk price:", manageBulkPrice);
      console.log("[handleSyncFolderProducts] Default price:", colDefaultPrice);

      const parsedPrice = parseMagicalPrice(manageBulkPrice || colDefaultPrice);
      if (!parsedPrice.valid) {
        throw new Error(parsedPrice.error);
      }
      console.log("[handleSyncFolderProducts] Parsed price:", parsedPrice.storage);

      const res = await fetch(`/api/admin/collections/${manageColId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_only: true,
          default_price: parsedPrice.storage,
        }),
      });

      console.log("[handleSyncFolderProducts] Response status:", res.status);
      console.log("[handleSyncFolderProducts] Response ok:", res.ok);

      const data = await res.json();
      console.log("[handleSyncFolderProducts] Response data:", data);

      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast(
        `Synced folder: ${data.images?.length ?? 0} picture(s), ${data.products_created} new product(s). New products will use price: ${parsedPrice.storage}.`,
        "success"
      );
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed";
      console.error("[handleSyncFolderProducts] Error:", err);
      console.error("[handleSyncFolderProducts] Error message:", message);
      console.error("[handleSyncFolderProducts] Error stack:", err instanceof Error ? err.stack : "No stack");
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  const managedCollection = collections.find((c) => c.id === manageColId);
  const managedImages =
    managedCollection?.images && Array.isArray(managedCollection.images)
      ? managedCollection.images
      : [];
  const managedProductCount = products.filter(
    (p) => p.collection_id === manageColId
  ).length;

  // Submit Product
  async function handleProdSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prodName.trim() || !prodColId || !prodFile) {
      toast("Please fill all required product fields", "info");
      return;
    }
    setLoading(true);

    try {
      const imageUrl = await uploadImage(prodFile);

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prodName.trim(),
          description: prodDesc.trim(),
          image_url: imageUrl,
          price: prodPrice,
          collection_id: prodColId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create product");
      }

      toast("Product added successfully!", "success");
      setProdName("");
      setProdDesc("");
      setProdPrice("");
      setProdColId("");
      setProdFile(null);
      setProdPreview("");
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to create product", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  async function fetchBuyerNames() {
    try {
      const res = await fetch("/api/admin/tickets", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        const uniqueBuyerNames = Array.from(new Set(data.map((t: any) => t.username).filter(Boolean)));
        setBuyerNames(uniqueBuyerNames);
      }
    } catch (err) {
      console.error("[fetchBuyerNames] Error:", err);
    }
  }

  async function handleSaveWashingEntry() {
    // Validate that at least buyer and seller are selected, and either content fields or images exist
    if (!washingBuyerName.trim() || !washingSellerName.trim()) {
      toast("Please select both buyer and seller", "error");
      return;
    }

    if (!washingPrice.trim() && !washingPieces.trim() && washingImages.length === 0) {
      toast("Please enter price and pieces, or upload images", "error");
      return;
    }

    setSavingWashingEntry(true);
    try {
      // Upload images if any
      const imageUrls: string[] = [];
      for (const image of washingImages) {
        const fileExt = image.name.split(".").pop();
        const fileName = `washing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `washing-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("message-attachments")
          .upload(filePath, image, { upsert: false });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage
          .from("message-attachments")
          .getPublicUrl(filePath);

        imageUrls.push(data.publicUrl);
      }

      const res = await fetch("/api/admin/washing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: washingBuyerName.trim(),
          seller_name: washingSellerName.trim(),
          price: washingPrice.trim() || "0",
          pieces: washingPieces.trim() ? parseInt(washingPieces.trim()) : 0,
          images: imageUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save washing entry");
      toast("Washing entry saved successfully!", "success");
      setWashingBuyerName("");
      setWashingSellerName("");
      setWashingPrice("");
      setWashingPieces("");
      setWashingImages([]);
      setWashingImagePreviews([]);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save washing entry";
      console.error("[handleSaveWashingEntry] Error:", err);
      toast(msg, "error");
    } finally {
      setSavingWashingEntry(false);
    }
  }

  return (
    <div className="space-y-8 py-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold text-[#3886c8] border border-[#3886c8]/20 bg-[#0a1a2a]/10 tracking-widest uppercase">
            Control Center
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight mt-3">
            Admin Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure catalog sections, upload items, and monitor customer order tickets.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="self-start sm:self-center px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
        >
          Sign out Admin
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-zinc-900 p-0.5 max-w-2xl bg-zinc-950/60 rounded-xl border border-zinc-900">
        {(["collections", "products", "tickets", "inbox", "folders", "history", "nested", "washing"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold capitalize rounded-lg transition-colors relative ${
              activeTab === tab
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "nested" ? "Nested Folders" : tab}
            {tab === "inbox" && unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {fetchLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <div className="w-8 h-8 border-2 border-zinc-800 border-t-[#3886c8] rounded-full animate-spin" />
          <span className="text-sm">Fetching catalog...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tab Content Left Pane (Form/Details) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* COLLECTIONS TAB CONTENT */}
            {activeTab === "collections" && (
              <div className="space-y-6">
                {/* Delete All Collections Button */}
                {collections.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllCollections}
                    disabled={loading}
                    className="w-full rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/30 px-4 py-2.5 text-xs font-bold text-rose-300 transition-colors disabled:opacity-50"
                  >
                    Delete All Collections ({collections.length})
                  </button>
                )}

                {/* History Button */}
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={loading}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {showHistory ? "Hide" : "Show"} Collection History ({collectionHistory.length})
                </button>

                {/* History Panel */}
                {showHistory && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-300">Collection History</h4>
                      </div>
                      {/* Filters */}
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={historyFilterDate}
                          onChange={(e) => setHistoryFilterDate(e.target.value)}
                          className="text-[10px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-700"
                        />
                        <select
                          value={historyFilterAction}
                          onChange={(e) => setHistoryFilterAction(e.target.value)}
                          className="text-[10px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-700"
                        >
                          <option value="">All Actions</option>
                          <option value="create">Create</option>
                          <option value="update">Update</option>
                          <option value="delete">Delete</option>
                          <option value="upload">Upload</option>
                          <option value="download">Download</option>
                        </select>
                      </div>
                      {filterHistory().length === 0 ? (
                        <p className="text-[10px] text-zinc-500">No history yet</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {filterHistory().map((item) => (
                            <div key={item.id} className="text-[10px] text-zinc-400 border-b border-zinc-800 pb-2">
                              <span className="font-medium text-zinc-300">{item.action}</span>
                              <span className="text-zinc-600 ml-2">
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                              {item.details && (
                                <div className="text-zinc-500 mt-1">
                                  {JSON.stringify(item.details)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Form to Create Collection */}
                <form onSubmit={handleColSubmit} className="glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2">
                    Upload collection folder
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Upload a folder of pictures (or leave empty). Each image becomes a
                    product named from the file.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Name</label>
                      <input
                        type="text"
                        value={colName}
                        onChange={(e) => setColName(e.target.value)}
                        placeholder="e.g. Autumn Wear"
                        required
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">
                        Default price per picture
                      </label>
                      <input
                        type="text"
                        value={colDefaultPrice}
                        onChange={(e) => setColDefaultPrice(e.target.value)}
                        placeholder="8g, 5s, 20k, or 25"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
                      />
                      <p className="text-[10px] text-zinc-600">{MAGICAL_PRICE_HINT}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">
                        Cover image (optional)
                      </label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) {
                            setColFile(null);
                            setColPreview("");
                            return;
                          }
                          if (!isImageFile(file)) {
                            toast(`"${file.name}" is not a supported image`, "error");
                            e.target.value = "";
                            return;
                          }
                          setColFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () =>
                            setColPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                        className="text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Description</label>
                    <textarea
                      value={colDesc}
                      onChange={(e) => setColDesc(e.target.value)}
                      placeholder="Brief details about the collection catalog..."
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">
                      Folder pictures (optional — leave empty for empty folder)
                    </label>
                    <input
                      type="file"
                      multiple
                      // No accept= here — accept + folder picker breaks PNG on Windows/Edge
                      // @ts-expect-error webkitdirectory for folder pick
                      webkitdirectory=""
                      directory=""
                      onChange={(e) => {
                        pickFolderImages(e.target.files, (files) => {
                          setColGalleryFiles(files);
                          loadFilePreviews(files, setColGalleryPreviews);
                        });
                        e.target.value = "";
                      }}
                      className="text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                    />
                    <p className="text-[10px] text-zinc-600">
                      JPG, PNG, WebP, GIF, BMP, TIFF, SVG, AVIF, HEIC, and more. Names
                      like <code className="text-zinc-400">blue-jacket.jpg</code> become
                      product titles.
                    </p>
                  </div>

                  {colGalleryPreviews.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Gallery Previews ({colGalleryPreviews.length} selected)</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {colGalleryPreviews.map((preview, idx) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-850 group">
                            <AdminImage
                              src={preview}
                              alt={colGalleryFiles[idx]?.name || `Gallery ${idx}`}
                              fallbackLabel={colGalleryFiles[idx]?.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-zinc-300 truncate px-1 py-0.5">
                              {colGalleryFiles[idx]?.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...colGalleryFiles];
                                newFiles.splice(idx, 1);
                                setColGalleryFiles(newFiles);
                                const newPreviews = [...colGalleryPreviews];
                                newPreviews.splice(idx, 1);
                                setColGalleryPreviews(newPreviews);
                              }}
                              className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-rose-400 transition-opacity"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {colPreview && (
                    <div className="relative rounded-xl overflow-hidden max-h-36 border border-zinc-850">
                      <AdminImage
                        src={colPreview}
                        alt="Collection cover preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {colUploadProgress && (
                    <div className="rounded-xl border border-[#3886c8]/20 bg-[#0a1a2a]/20 px-4 py-3 text-xs text-[#5a9ce8] backdrop-blur-sm animate-pulse flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-[#3886c8]/30 border-t-[#5a9ce8] rounded-full animate-spin" />
                      <span>{colUploadProgress}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-[#3886c8] to-[#3886c8] hover:from-[#2a6cb8] hover:to-[#2a6cb8] px-5 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-[#3886c8]/10 active:scale-98 disabled:opacity-50"
                  >
                    {loading ? (colUploadProgress ? "Uploading..." : "Processing...") : "Upload folder"}
                  </button>
                </form>

                {/* Manage existing folder: price + add files */}
                <div className="glass-card rounded-2xl p-6 space-y-4 border border-[#3886c8]/10">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#3886c8] border-b border-zinc-850 pb-2">
                    Manage folder contents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">
                        Choose collection
                      </label>
                      <select
                        value={manageColId}
                        onChange={(e) => setManageColId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100"
                      >
                        <option value="">Select folder…</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">
                        Price for all pictures
                      </label>
                      <input
                        type="text"
                        value={manageBulkPrice}
                        onChange={(e) => setManageBulkPrice(e.target.value)}
                        placeholder={colDefaultPrice}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100"
                      />
                    </div>
                  </div>

                  {manageColId && (
                    <p className="text-xs text-zinc-500">
                      Inside folder: <strong className="text-zinc-300">{managedImages.length}</strong>{" "}
                      picture(s) · <strong className="text-zinc-300">{managedProductCount}</strong>{" "}
                      product(s) in database
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading || !manageColId}
                      onClick={handleApplyPriceToAll}
                      className="rounded-xl bg-[#3886c8] hover:bg-[#2a6cb8] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Apply this price to all pictures in folder
                    </button>
                    <button
                      type="button"
                      disabled={loading || !manageColId}
                      onClick={handleSyncFolderProducts}
                      className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-bold text-zinc-200 disabled:opacity-50"
                    >
                      Re-read folder → create missing products
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">
                      Add more files to this folder
                    </label>
                    <input
                      type="file"
                      multiple
                      // @ts-expect-error folder picker
                      webkitdirectory=""
                      directory=""
                      onChange={(e) => {
                        pickFolderImages(e.target.files, (files) => {
                          setManageFolderFiles(files);
                          loadFilePreviews(files, setManageFolderPreviews);
                        });
                        e.target.value = "";
                      }}
                      className="text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 cursor-pointer"
                    />
                  </div>

                  {/* Upload Folder from Drive - Quick Upload */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Quick Upload Folder from Computer</label>
                      <p className="text-[10px] text-zinc-500">
                        Select a folder to automatically create collections for subfolders and upload all images.
                      </p>
                      <input
                        type="file"
                        // @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers
                        webkitdirectory=""
                        // @ts-ignore - directory is not in TypeScript types but works in browsers
                        directory=""
                        multiple
                        onChange={handleFolderUpload}
                        disabled={uploadingFolder}
                        className="text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                      />
                      {uploadingFolder && (
                        <p className="text-[10px] text-[#3886c8]">Uploading folder... Please wait.</p>
                      )}
                    </div>
                  </div>

                  {/* Google Drive Quick Upload */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Quick Upload from Google Drive</label>
                      <p className="text-[10px] text-zinc-500">
                        Import folders and images directly from your Google Drive.
                      </p>
                      {!googleDriveConnected ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            connectGoogleDrive();
                          }}
                          className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                          </svg>
                          Connect Google Drive
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleGoogleDriveUpload();
                          }}
                          disabled={uploadingFromGoogleDrive}
                          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {uploadingFromGoogleDrive ? "Uploading from Google Drive..." : "Upload All Files from Root"}
                        </button>
                      )}
                    </div>
                  </div>

                  {manageFolderPreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {manageFolderPreviews.map((p, i) => (
                        <AdminImage
                          key={i}
                          src={p}
                          alt={manageFolderFiles[i]?.name || `New file ${i + 1}`}
                          fallbackLabel={manageFolderFiles[i]?.name}
                          className="aspect-square rounded-lg object-cover border border-zinc-800 w-full h-full"
                        />
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={loading || !manageColId || manageFolderFiles.length === 0}
                    onClick={handleAddFilesToFolder}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-200 disabled:opacity-50"
                  >
                    Upload files into selected folder
                  </button>

                  {manageColId && managedImages.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-900">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">
                        Pictures in folder — tap × to remove
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {managedImages.map((url) => (
                          <div
                            key={url}
                            className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800 group"
                          >
                            <AdminImage
                              src={url}
                              alt="Folder item"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleRemoveFolderImage(url)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 border border-rose-500/50 text-rose-300 text-xs font-bold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Collections List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Existing Collections</h4>
                  <p className="text-[10px] text-zinc-600 leading-relaxed rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 align-middle mr-1" />
                    Green — normal prices.
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 align-middle mx-1 ml-2" />
                    Yellow — leaving in a few days.
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 align-middle mx-1 ml-2" />
                    Red — collection left; extra fees may apply.
                  </p>
                  {collections.length === 0 ? (
                    <p className="text-xs text-zinc-600">No collections configured yet.</p>
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      {(() => {
                        const tree = buildCollectionTree(collections);
                        console.log("[Collections Tab] Tree nodes:", tree.map(n => ({ name: n.name, children: n.children?.length || 0 })));
                        return tree.map((node) => (
                          <CollectionTreeNode key={node.id} node={node} />
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRODUCTS TAB CONTENT */}
            {activeTab === "products" && (
              <div className="space-y-6">
                {/* Form to Create Product */}
                <form onSubmit={handleProdSubmit} className="glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2">
                    Add New Product
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Product Name *</label>
                      <input
                        type="text"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        placeholder="e.g. Premium Leather Jacket"
                        required
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Price *</label>
                      <input
                        type="text"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        placeholder="8g, 5s, 20k"
                        required
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Collection *</label>
                      <select
                        value={prodColId}
                        onChange={(e) => setProdColId(e.target.value)}
                        required
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-400 outline-none focus:border-[#3886c8]/50"
                      >
                        <option value="">Select Collection</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id} className="text-zinc-100 bg-zinc-950">
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Product Image *</label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) {
                            setProdFile(null);
                            setProdPreview("");
                            return;
                          }
                          if (!isImageFile(file)) {
                            toast(`"${file.name}" is not a supported image`, "error");
                            e.target.value = "";
                            return;
                          }
                          setProdFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () =>
                            setProdPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                        required
                        className="text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Description</label>
                    <textarea
                      value={prodDesc}
                      onChange={(e) => setProdDesc(e.target.value)}
                      placeholder="Brief details about product specifications..."
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50 resize-none"
                    />
                  </div>

                  {prodPreview && (
                    <div className="relative rounded-xl overflow-hidden max-h-36">
                      <AdminImage
                        src={prodPreview}
                        alt="Product preview"
                        className="w-full h-full object-cover max-h-36"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-[#3886c8] to-[#3886c8] hover:from-[#2a6cb8] hover:to-[#2a6cb8] px-5 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-[#3886c8]/10 active:scale-98 disabled:opacity-50"
                  >
                    {loading ? "Adding Product..." : "Create Product"}
                  </button>
                </form>

                {/* Products List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Existing Products</h4>
                  {products.length === 0 ? (
                    <p className="text-xs text-zinc-600">No products uploaded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {products.map((prod) => {
                        const parentColName = collections.find((c) => c.id === prod.collection_id)?.name || "Store";
                        return (
                          <div
                            key={prod.id}
                            className="flex gap-3 p-3 rounded-xl border border-zinc-900 bg-zinc-950/20 items-center"
                          >
                            <div className="w-14 h-14 bg-zinc-950 rounded-lg overflow-hidden shrink-0 border border-zinc-900">
                              {prod.image_url && (
                                <AdminImage
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-white truncate">{prod.name}</h5>
                              <div className="flex gap-2 items-center mt-0.5 flex-wrap">
                                <span className="text-[10px] text-zinc-500">
                                  <PriceDisplay price={prod.price} />
                                </span>
                                <span className="text-[9px] bg-zinc-900 text-[#3886c8] px-1.5 py-0.5 rounded border border-zinc-800">
                                  {parentColName}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-950/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-300"
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TICKETS TAB CONTENT */}
            {activeTab === "tickets" && (
              <AdminTicketsPanel onCountChange={setTicketCount} />
            )}

            {/* INBOX TAB CONTENT */}
            {activeTab === "inbox" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    User Messaging
                  </h3>
                  <button
                    onClick={() => setShowUserSidebar(!showUserSidebar)}
                    className="px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                  >
                    {showUserSidebar ? "Hide Users" : "Show Users"}
                  </button>
                </div>
                <div className="flex gap-4">
                  {showUserSidebar && (
                    <div className="w-80">
                      <UserListSidebar
                        onSelectUser={setSelectedUser}
                        selectedUserId={selectedUser?.id}
                        isOpen={showUserSidebar}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <AdminInboxPanel selectedUser={selectedUser} />
                  </div>
                </div>
              </div>
            )}

            {/* FOLDERS TAB CONTENT */}
            {activeTab === "folders" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  Manage Folders
                </h3>

                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => navigateToFolder(null, "")}
                    className={`px-2 py-1 rounded ${currentFolderId === null ? "bg-[#3886c8] text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                  >
                    Root
                  </button>
                  {folderBreadcrumbs.map((crumb, index) => (
                    <div key={crumb.id} className="flex items-center gap-2">
                      <span className="text-zinc-600">/</span>
                      <button
                        onClick={() => navigateToFolder(crumb.id, crumb.name)}
                        className={`px-2 py-1 rounded ${index === folderBreadcrumbs.length - 1 ? "bg-[#3886c8] text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                      >
                        {crumb.name}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Upload Folder from Drive */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Upload Folder from Computer</label>
                    <p className="text-[10px] text-zinc-500">
                      Select a folder from your computer. All subfolders and images will be uploaded automatically.
                    </p>
                    <input
                      type="file"
                      // @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers
                      webkitdirectory=""
                      // @ts-ignore - directory is not in TypeScript types but works in browsers
                      directory=""
                      multiple
                      onChange={handleFolderUpload}
                      disabled={uploadingFolder}
                      className="text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                    />
                    {uploadingFolder && (
                      <p className="text-[10px] text-[#3886c8]">Uploading folder... Please wait.</p>
                    )}
                  </div>
                </div>

                {/* Google Drive Upload */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Upload from Google Drive</label>
                    <p className="text-[10px] text-zinc-500">
                      Import folders and images directly from your Google Drive.
                    </p>
                    
                    {!googleDriveConnected ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          connectGoogleDrive();
                        }}
                        className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                        </svg>
                        Choose Google Account
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-400">● Connected to Google Drive</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setGoogleDriveConnected(false);
                              setGoogleDriveFiles([]);
                              setGoogleDriveFolders([]);
                              setSelectedGoogleDriveFolder(null);
                            }}
                            className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                          >
                            Switch Account
                          </button>
                        </div>

                        {/* Google Drive File Browser */}
                        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 space-y-2">
                          {/* Search Target Folder Button */}
                          <button
                            type="button"
                            onClick={searchTargetFolder}
                            disabled={loadingGoogleDrive}
                            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {loadingGoogleDrive ? "Searching..." : `Find "${targetFolderName}"`}
                          </button>

                          {/* Breadcrumb Navigation */}
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => fetchGoogleDriveFiles(null)}
                              className="text-zinc-400 hover:text-zinc-200"
                            >
                              My Drive
                            </button>
                            {selectedGoogleDriveFolder && (
                              <span className="text-zinc-600">/</span>
                            )}
                          </div>

                          {/* Loading Indicator */}
                          {loadingGoogleDrive && (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              <span className="ml-2 text-[10px] text-zinc-400">Loading...</span>
                            </div>
                          )}

                          {!loadingGoogleDrive && (
                            <>
                              {/* Folders */}
                              {googleDriveFolders.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase">Folders</p>
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {googleDriveFolders.map((folder) => (
                                      <div
                                        key={folder.id}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors group"
                                      >
                                        <div
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            fetchGoogleDriveFiles(folder.id);
                                          }}
                                          className="flex items-center gap-2 flex-1 cursor-pointer"
                                        >
                                          <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                          </svg>
                                          <span className="text-xs text-zinc-200 group-hover:text-white">{folder.name}</span>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedFolderForUpload(folder);
                                          }}
                                          className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded cursor-pointer"
                                        >
                                          Select
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Files */}
                              {googleDriveFiles.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase">Files ({googleDriveFiles.length})</p>
                                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                    {googleDriveFiles.map((file) => (
                                      <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50">
                                        <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-[10px] text-zinc-400 truncate">{file.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {googleDriveFolders.length === 0 && googleDriveFiles.length === 0 && (
                                <p className="text-[10px] text-zinc-500 text-center py-4">
                                  No files or folders in this location
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Selected Folder Info */}
                        {selectedFolderForUpload && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-blue-900/30 border border-blue-500/30">
                            <span className="text-[10px] text-blue-300">Selected: {selectedFolderForUpload.name}</span>
                            <button
                              onClick={() => setSelectedFolderForUpload(null)}
                              className="text-[10px] text-zinc-400 hover:text-zinc-200"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {/* Upload Button */}
                        <button
                          type="button"
                          onClick={handleGoogleDriveUpload}
                          disabled={uploadingFromGoogleDrive || !selectedFolderForUpload}
                          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {uploadingFromGoogleDrive ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...` : selectedFolderForUpload ? `Upload from "${selectedFolderForUpload.name}"` : "Select a folder to upload"}
                        </button>

                        {/* Progress Bar */}
                        {uploadingFromGoogleDrive && uploadProgress.total > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-400">
                              <span>Progress</span>
                              <span>{uploadProgress.current}/{uploadProgress.total}</span>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                              />
                            </div>
                            {estimatedTimeRemaining && (
                              <div className="text-[10px] text-zinc-500 text-center">
                                ~{Math.round(estimatedTimeRemaining / 1000)}s remaining
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Folder Preview Modal */}
                {showFolderPreview && folderPreview && (
                  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-2xl w-full max-h-[80vh] overflow-hidden">
                      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-zinc-200">Folder Structure Preview</h3>
                        <button
                          onClick={() => {
                            setShowFolderPreview(false);
                            setFolderPreview(null);
                          }}
                          className="text-zinc-400 hover:text-zinc-200"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto max-h-[60vh]">
                        <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
                          <p className="text-xs text-zinc-300 font-medium">{folderPreview.targetFolderName}</p>
                          <p className="text-[10px] text-zinc-500">Total images: {folderPreview.totalImages}</p>
                        </div>
                        <FolderStructurePreview structure={folderPreview.structure} />
                      </div>
                      <div className="p-4 border-t border-zinc-800 flex gap-3">
                        <button
                          onClick={() => {
                            setShowFolderPreview(false);
                            setFolderPreview(null);
                          }}
                          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-xs font-bold text-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmGoogleDriveUpload}
                          className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors"
                        >
                          Upload {folderPreview.totalImages} images
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Folder Form */}
                <form onSubmit={handleFolderSubmit} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Folder Name *</label>
                    <input
                      type="text"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="e.g., Summer Collection"
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#3886c8] hover:bg-[#1a4a8a] disabled:bg-zinc-800 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-bold text-white transition-colors"
                  >
                    {loading ? "Creating..." : "Create Folder"}
                  </button>
                </form>

                {/* Current Folder Contents */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3">
                    {currentFolderId ? "Subfolders" : "Root Folders"}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {collections.filter(c => c.parent_id === currentFolderId).map((col) => (
                      <div
                        key={col.id}
                        onClick={() => navigateToFolder(col.id, col.name)}
                        className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-[#3886c8]/50 hover:bg-zinc-900/60 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-8 h-8 text-[#3886c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <div>
                            <p className="text-xs font-medium text-zinc-200">{col.name}</p>
                            <p className="text-[10px] text-zinc-500">
                              {collections.filter(c => c.parent_id === col.id).length} subfolders
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {collections.filter(c => c.parent_id === currentFolderId).length === 0 && currentFolderId && (
                      <p className="col-span-full text-xs text-zinc-500 text-center py-8">
                        No subfolders in this folder
                      </p>
                    )}
                    {collections.filter(c => c.parent_id === currentFolderId).length === 0 && !currentFolderId && (
                      <p className="col-span-full text-xs text-zinc-500 text-center py-8">
                        No root folders created yet
                      </p>
                    )}
                  </div>
                </div>

                {/* Products in Current Folder */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3">
                    Products in this folder
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.filter(p => p.collection_id === currentFolderId)
                      .slice((productsPage - 1) * productsPerPage, productsPage * productsPerPage)
                      .map((prod) => (
                      <div
                        key={prod.id}
                        className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40"
                      >
                        {prod.image_url && (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            loading="lazy"
                            className="w-full h-24 object-cover rounded-lg mb-2"
                          />
                        )}
                        <p className="text-xs font-medium text-zinc-200 truncate">{prod.name}</p>
                        <p className="text-[10px] text-zinc-500">{prod.price}</p>
                      </div>
                    ))}
                    {products.filter(p => p.collection_id === currentFolderId).length === 0 && (
                      <p className="col-span-full text-xs text-zinc-500 text-center py-8">
                        No products in this folder
                      </p>
                    )}
                  </div>
                  {/* Pagination */}
                  {products.filter(p => p.collection_id === currentFolderId).length > productsPerPage && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
                      <button
                        onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                        disabled={productsPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-zinc-500">
                        Page {productsPage} of {Math.ceil(products.filter(p => p.collection_id === currentFolderId).length / productsPerPage)}
                      </span>
                      <button
                        onClick={() => setProductsPage(p => Math.min(Math.ceil(products.filter(p => p.collection_id === currentFolderId).length / productsPerPage), p + 1))}
                        disabled={productsPage === Math.ceil(products.filter(p => p.collection_id === currentFolderId).length / productsPerPage)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY TAB CONTENT */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  Ticket History
                </h3>
                <AdminHistoryPanel />
              </div>
            )}

            {/* NESTED FOLDERS TAB CONTENT */}
            {activeTab === "nested" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  Nested Folders
                </h3>
                <p className="text-xs text-zinc-500">
                  Set parent-child relationships between collections. Choose a root collection and a subfolder to nest it under the root.
                </p>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Root Collection (Parent)</label>
                    <select
                      value={nestedRootCollection}
                      onChange={(e) => setNestedRootCollection(e.target.value)}
                      className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                    >
                      <option value="">Select root collection...</option>
                      {collections.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase">Subfolder Collection (Child)</label>
                    <select
                      value={nestedSubCollection}
                      onChange={(e) => setNestedSubCollection(e.target.value)}
                      className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                    >
                      <option value="">Select subfolder collection...</option>
                      {collections.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleSetNestedFolder}
                    disabled={loading || !nestedRootCollection || !nestedSubCollection}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Set Nested Folder
                  </button>
                </div>

                {/* Current Hierarchy Display */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Current Hierarchy</h4>
                  {collections.filter(c => c.parent_id).length === 0 ? (
                    <p className="text-xs text-zinc-600">No nested folders configured yet.</p>
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                      {buildCollectionTree(collections).map((node) => (
                        <CollectionTreeNode key={node.id} node={node} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WASHING TAB CONTENT */}
            {activeTab === "washing" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    Washing Entry
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Create a washing entry that will be added to the ticket history.
                  </p>
                  
                  <div className="space-y-4">
                    {/* Buyer Dropdown */}
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Buyer Name</label>
                      <select
                        value={washingBuyerName}
                        onChange={(e) => setWashingBuyerName(e.target.value)}
                        className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 max-h-32 overflow-y-auto"
                      >
                        <option value="">Select a buyer...</option>
                        {buyerNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Seller Dropdown */}
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Seller Name</label>
                      <select
                        value={washingSellerName}
                        onChange={(e) => setWashingSellerName(e.target.value)}
                        className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 max-h-32 overflow-y-auto"
                      >
                        <option value="">Select a seller...</option>
                        {sellerNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Price (Optional)</label>
                      <input
                        type="text"
                        value={washingPrice}
                        onChange={(e) => setWashingPrice(e.target.value)}
                        placeholder="Enter price..."
                        className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Number of Pieces (Optional)</label>
                      <input
                        type="number"
                        value={washingPieces}
                        onChange={(e) => setWashingPieces(e.target.value)}
                        placeholder="Enter number of pieces..."
                        min="0"
                        className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                      />
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase">Upload Images (Optional)</label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (!files) return;

                          const newFiles = Array.from(files);
                          setWashingImages((prev) => [...prev, ...newFiles]);

                          newFiles.forEach((file) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setWashingImagePreviews((prev) => [...prev, reader.result as string]);
                            };
                            reader.readAsDataURL(file);
                          });
                        }}
                        className="w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                      />
                    </div>

                    {/* Image Previews */}
                    {washingImagePreviews.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950/30">
                        {washingImagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${idx}`}
                              className="w-full h-24 object-cover rounded-lg border border-zinc-700"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setWashingImages((prev) => prev.filter((_, i) => i !== idx));
                                setWashingImagePreviews((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWashingEntry}
                    disabled={savingWashingEntry}
                    className="w-full rounded-xl bg-gradient-to-r from-[#3886c8] to-[#3886c8] hover:from-[#2a6cb8] hover:to-[#2a6cb8] py-3 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingWashingEntry ? "Saving..." : "Save Washing Entry"}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Pane (Summary Dashboard) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-xl p-6 space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2">
                System Overview
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-bold uppercase">Collections</span>
                  <span className="text-lg font-black text-white">{collections.length}</span>
                </div>
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-bold uppercase">Products</span>
                  <span className="text-lg font-black text-white">{products.length}</span>
                </div>
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-bold uppercase">Tickets</span>
                  <span className="text-lg font-black text-white">{ticketCount}</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/collections"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center rounded-xl bg-zinc-800/80 hover:bg-zinc-800 py-3 text-xs font-bold text-zinc-300 border border-zinc-800 transition-colors inline-block"
                >
                  View user Collections tab &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
