"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/Toast";

type MarketClientProps = {
  userId: string;
  username: string;
};

export default function MarketClient({ userId, username }: MarketClientProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 3 && images.length === 0) {
      toast("Please describe what you are looking for or add images (at least 3 characters or 1 image).", "info");
      return;
    }

    setLoading(true);
    try {
      // Upload images if any
      const imageUrls: string[] = [];
      for (const image of images) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `market-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("market-uploads")
          .upload(filePath, image, { upsert: false });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage
          .from("market-uploads")
          .getPublicUrl(filePath);

        imageUrls.push(data.publicUrl);
      }

      const { error } = await supabase.from("tickets").insert({
        user_id: userId,
        username: username || "User",
        items: [
          {
            kind: "market",
            name: "Market request",
            quantity: 1,
            price: 0,
            price_label: "0",
            collection_name: "Market",
            request_text: text,
            images: imageUrls,
          },
        ],
        total_items: 1,
        status: "pending",
      });

      if (error) throw new Error(error.message);

      toast("Your request was sent to Jonathon!", "success");
      setMessage("");
      setImages([]);
      setImagePreviews([]);
      router.push("/tickets");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit request";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setImages((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8 sm:py-12 flex flex-col">
      <header className="text-center space-y-4 mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3886c8]">
          Market
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-snug px-2">
          Looking for something unique?
        </h1>
        <p className="text-base sm:text-lg text-zinc-300 font-medium leading-relaxed px-1">
          Jonathon is your way to get it.
        </p>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
          Tell us what you want below. Your message becomes a ticket for our team —
          just like an order from the cart.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 sm:p-6 shadow-xl shadow-black/20"
      >
        <label
          htmlFor="market-request"
          className="text-[11px] font-bold uppercase tracking-wider text-zinc-400"
        >
          Your request
        </label>
        <textarea
          id="market-request"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe what you are looking for…"
          rows={6}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#3886c8]/50 focus:ring-1 focus:ring-[#3886c8]/20 min-h-[140px]"
        />
        <p className="text-[11px] text-zinc-600 text-center">
          {message.trim().length} characters
        </p>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Add images (optional)
          </label>
          <label className="cursor-pointer">
            <div className="w-full rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-4 text-center transition hover:border-zinc-700">
              <p className="text-sm font-medium text-zinc-400">Click to upload images</p>
              <p className="text-xs text-zinc-600 mt-1">PNG, JPG, GIF up to 5MB each</p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>

        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border border-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (message.trim().length < 3 && images.length === 0)}
          className="w-full rounded-xl bg-gradient-to-r from-[#3886c8] to-[#3886c8] hover:from-[#2a6cb8] hover:to-[#2a6cb8] py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Submit to Jonathon"
          )}
        </button>
      </form>
    </main>
  );
}
