"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { TicketHistory } from "@/lib/types/profile";
import TicketItemRow from "@/components/TicketItemRow";
import { sumMagicalPriceLines } from "@/lib/magical-price";

export default function AdminHistoryPanel() {
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const { toast } = useToast();

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ticket-history", {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("[admin-history] API error:", err);
        throw new Error(err.error || JSON.stringify(err) || "Failed to load history");
      }
      const data = await res.json();
      setHistory(data || []);
    } catch (err: any) {
      console.error("[admin-history] Full error:", err);
      const errorMessage = err.message || JSON.stringify(err) || "Failed to load history";
      toast(errorMessage, "error");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-zinc-800 border-t-[#3886c8] rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500 py-16">
        No completed tickets in history yet.
      </p>
    );
  }

  const filteredHistory = history.filter(entry => {
    const matchesUsername = entry.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = dateFilter ? new Date(entry.completed_at).toLocaleDateString() === new Date(dateFilter).toLocaleDateString() : true;
    const matchesMonth = monthFilter ? new Date(entry.completed_at).toISOString().slice(0, 7) === monthFilter : true;
    return matchesUsername && matchesDate && matchesMonth;
  });

  const handleDownloadHistory = async () => {
    setLoading(true);
    try {
      const historyToDownload = monthFilter ? filteredHistory : history;
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast("Failed to open print window", "error");
        setLoading(false);
        return;
      }
      
      const html = `<!DOCTYPE html><html><head><title>Ticket History</title><style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .item-row { border-bottom: 1px solid #eee; padding: 8px 0; }
        .item-row:last-child { border-bottom: none; }
        .item-image { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; }
        .item-details { display: inline-block; vertical-align: middle; }
        @media print { body { padding: 0; } h1 { page-break-before: auto; } }
        </style></head><body>
        <h1>Ticket History</h1><p>Generated: ${new Date().toLocaleString()}</p>
        ${monthFilter ? `<p>Month: ${monthFilter}</p>` : ''}
        <table><thead><tr><th>Date</th><th>Username</th><th>Assigned By</th><th>Items</th><th>Total</th></tr></thead><tbody>
        ${historyToDownload.map(h => `
          <tr>
            <td>${h.completed_at ? new Date(h.completed_at).toLocaleString() : ''}</td>
            <td>${h.username || ''}</td>
            <td>${h.assigned_by || ''}</td>
            <td>
              ${h.items.map((item: any) => `
                <div class="item-row">
                  ${item.image_url ? `<img src="${item.image_url}" class="item-image" alt="${item.name || 'Item'}" />` : ''}
                  <div class="item-details">
                    <strong>${item.name || 'Unnamed Item'}</strong><br/>
                    <small>${item.price_label || item.price}</small>
                  </div>
                </div>
              `).join('')}
            </td>
            <td>${(() => {
              const cartPriceLines = h.items.map((i: any) => ({
                price: i.price_label ?? i.price,
                quantity: i.quantity,
              }));
              const cartTotal = sumMagicalPriceLines(cartPriceLines);
              return cartTotal.display;
            })()}</td>
          </tr>`).join('')}
        </tbody></table></body></html>`;
      
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      toast("History ready for PDF download", "success");
    } catch (err) {
      toast("Failed to download history", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistory = async () => {
    if (!confirm("Delete all ticket history? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ticket-history", { method: "DELETE" });
      if (res.ok) {
        toast("Ticket history deleted", "success");
        setHistory([]);
      }
    } catch (err) {
      toast("Failed to delete history", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Delete this ticket history entry? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ticket-history/${entryId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Ticket entry deleted", "success");
        setHistory(history.filter(h => h.id !== entryId));
      }
    } catch (err) {
      toast("Failed to delete entry", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDownloadHistory}
          disabled={loading}
          className="flex-1 rounded-lg border border-blue-500/50 bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50"
        >
          Download PDF
        </button>
        <button
          onClick={handleDeleteHistory}
          disabled={loading}
          className="flex-1 rounded-lg border border-rose-500/50 bg-rose-600 hover:bg-rose-500 px-3 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50"
        >
          Delete All
        </button>
      </div>
      {/* Filters */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by buyer..."
          className="flex-1 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#3886c8]/50"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
        />
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 outline-none focus:border-[#3886c8]/50"
          placeholder="Select month..."
        />
      </div>

      <div className="max-h-[min(70vh,640px)] overflow-y-auto pr-2 space-y-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-3">
        {filteredHistory.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-16">
            {searchQuery ? "No history entries match your search." : "No completed tickets in history yet."}
          </p>
        ) : (
          filteredHistory.map((entry) => (
            <div
              key={entry.id}
              className="p-5 rounded-2xl border border-zinc-850 bg-zinc-900/40 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-white">
                  {entry.username}
                  <span className="text-zinc-500 font-normal ml-2">
                    · {entry.total_items} items
                  </span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">
                    {new Date(entry.completed_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    disabled={loading}
                    className="text-[10px] text-rose-400 hover:text-rose-300 underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {entry.assigned_by && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">
                    Assigned to:
                  </span>
                  <span className="text-xs text-emerald-400">{entry.assigned_by}</span>
                </div>
              )}

              <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-900">
                {entry.items.map((item, idx) => (
                  <TicketItemRow key={idx} item={item} imageSize="lg" />
                ))}
              </div>

              {/* Total calculation */}
              {(() => {
                const cartPriceLines = entry.items.map((item: any) => ({
                  price: item.price_label ?? item.price,
                  quantity: item.quantity,
                }));
                const cartTotal = sumMagicalPriceLines(cartPriceLines);
                return (
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-900">
                    <span className="text-sm font-semibold text-zinc-400">Total</span>
                    <span className="text-lg font-bold text-[#3886c8]">{cartTotal.display}</span>
                  </div>
                );
              })()}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
