"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Collection, Product } from "@/lib/types/profile";
import CollectionAvailabilityDot from "@/components/CollectionAvailabilityDot";
import ProductCard from "./ProductCard";

export default function CollectionsClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const productsPerPage = 12;
  const [userId, setUserId] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    console.log("[collections] Loading from database…");
    const { data, error: fetchError } = await supabase
      .from("collections")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[collections] fetch error:", fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const parsed = (data ?? []).map((col: any) => {
      let images: string[] = [];
      if (Array.isArray(col.images)) images = col.images;
      else if (typeof col.images === "string") {
        try {
          images = JSON.parse(col.images);
        } catch {
          images = [];
        }
      }
      return { ...col, images } as Collection;
    });

    console.log("[collections] Loaded", parsed.length, "collections");
    setCollections(parsed);
    setError(null);
    setLoading(false);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[collections] products fetch error:", fetchError.message);
      return;
    }

    setProducts(data || []);
  }, []);

  const loadUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  }, []);

  const navigateToFolder = (folderId: string | null, folderName: string) => {
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
  };

  useEffect(() => {
    loadCollections();
    loadProducts();
    loadUserId();

    const channel = supabase
      .channel("collections-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections" },
        (payload: any) => {
          console.log("[collections] realtime collections:", payload.eventType);
          loadCollections();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload: any) => {
          console.log("[collections] realtime products:", payload.eventType);
          loadProducts();
        }
      )
      .subscribe();

    const poll = setInterval(() => {
      loadCollections();
      loadProducts();
    }, 15000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [loadCollections, loadProducts, loadUserId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-2 border-zinc-800 border-t-[#3886c8] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center text-rose-300 text-sm">
        Could not load collections: {error}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center rounded-2xl border border-dashed border-zinc-800 py-20">
        <p className="text-zinc-400 font-medium">No collections yet</p>
        <p className="text-sm text-zinc-600 mt-2">
          Admin uploads appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => navigateToFolder(null, "")}
          className={`px-2 py-1 rounded ${currentFolderId === null ? "bg-[#3886c8] text-white" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          Home
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

      {/* Folders in Current Location */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {collections.filter(c => c.parent_id === currentFolderId).map((col) => (
          <div
            key={col.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateToFolder(col.id, col.name);
            }}
            className="cursor-pointer group"
          >
            <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-xl overflow-hidden hover:border-[#3886c8]/50 transition-all duration-300">
              {col.image_url && (
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={col.image_url}
                    alt={col.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-[#3886c8] transition-colors">
                      {col.name}
                    </h3>
                    {col.description && (
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{col.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <CollectionAvailabilityDot status={col.availability_status || 'normal'} />
                      <span className="text-[10px] text-zinc-600">
                        {collections.filter(c => c.parent_id === col.id).length} subfolders
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {collections.filter(c => c.parent_id === currentFolderId).length === 0 && (
          <p className="col-span-full text-xs text-zinc-500 text-center py-8">
            {currentFolderId ? "No subfolders in this folder" : "No collections yet"}
          </p>
        )}
      </div>

      {/* Products in Current Folder */}
      {currentFolderId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.filter(p => p.collection_id === currentFolderId)
            .slice((productsPage - 1) * productsPerPage, productsPage * productsPerPage)
            .map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              userId={userId || ""}
            />
          ))}
          {products.filter(p => p.collection_id === currentFolderId).length === 0 && (
            <p className="col-span-full text-xs text-zinc-500 text-center py-8">
              No products in this folder
            </p>
          )}
        </div>
      )}

      {/* Pagination for Products */}
      {currentFolderId && products.filter(p => p.collection_id === currentFolderId).length > productsPerPage && (
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-zinc-800">
          <button
            onClick={() => setProductsPage(p => Math.max(1, p - 1))}
            disabled={productsPage === 1}
            className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {productsPage} of {Math.ceil(products.filter(p => p.collection_id === currentFolderId).length / productsPerPage)}
          </span>
          <button
            onClick={() => setProductsPage(p => Math.min(Math.ceil(products.filter(p => p.collection_id === currentFolderId).length / productsPerPage), p + 1))}
            disabled={productsPage === Math.ceil(products.filter(p => p.collection_id === currentFolderId).length / productsPerPage)}
            className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
