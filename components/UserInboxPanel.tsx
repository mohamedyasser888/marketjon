"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Helper to convert File to base64 using FileReader (fast and native)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.substring(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

// Helper to compress image in browser using canvas
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const result = reader.result as string;
          resolve(result.substring(result.indexOf(",") + 1));
          return;
        }

        // Limit maximum dimension to 1600px
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with 0.7 quality
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedBase64.substring(compressedBase64.indexOf(",") + 1));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

interface Message {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  sender_name: string;
  content: string | null;
  attachments?: string[];
  is_read: boolean;
  created_at: string;
}

export default function UserInboxPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchMessages();
    // Poll for new messages every 2 seconds
    refreshIntervalRef.current = setInterval(fetchMessages, 2000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [userId]);

  useEffect(() => {
    // Mark all unread messages as read when inbox is opened
    if (!userId || messages.length === 0) return;

    const unreadMessageIds = messages
      .filter(msg => !msg.is_read && msg.sender_id === null)
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: unreadMessageIds }),
      }).catch(err => console.error("Error marking messages as read:", err));
    }
  }, [messages, userId]);

  async function fetchMessages() {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data || []);
      // Scroll to bottom after messages are loaded
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if ((!(reply ?? '').trim() && attachments.length === 0) || sending || !userId) return;

    setSending(true);
    try {
      // Upload attachments if any
      const attachmentUrls: string[] = [];
      for (const attachment of attachments) {
        let fileDataBase64 = "";
        let fileType = attachment.type;
        let fileName = attachment.name;

        if (attachment.type.startsWith("image/")) {
          try {
            fileDataBase64 = await compressImage(attachment);
            fileType = "image/jpeg";
            const baseName = attachment.name.substring(0, attachment.name.lastIndexOf("."));
            fileName = `${baseName || "image"}-${Date.now()}.jpg`;
          } catch (err) {
            console.warn("[UserInboxPanel] Image compression failed, falling back to original:", err);
            fileDataBase64 = await fileToBase64(attachment);
          }
        } else {
          fileDataBase64 = await fileToBase64(attachment);
        }

        const fileExt = fileName.split(".").pop();
        const serverFileName = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `message-attachments/${serverFileName}`;

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filePath,
            fileType,
            fileName,
            fileSize: attachment.size,
            fileData: fileDataBase64,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to upload ${attachment.name}`);
        }

        const data = await res.json();
        attachmentUrls.push(data.url);
      }

      const res = await fetch(`/api/messages/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: (reply ?? '').trim() || null,
          attachments: attachmentUrls,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      setReply("");
      setAttachments([]);
      setAttachmentPreviews([]);
      toast("Message sent!", "success");
      await fetchMessages();
    } catch (err) {
      console.error("Error sending message:", err);
      toast("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  }

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setAttachments((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachmentPreviews((prev) => [...prev, file.name]);
      }
    });
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setAttachments((prev) => [...prev, file]);
        setAttachmentPreviews((prev) => [...prev, file.name]);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error starting recording:", err);
      if (err.name === "NotAllowedError") {
        toast("Microphone permission denied. Please allow access in browser settings.", "error");
      } else if (err.name === "NotFoundError") {
        toast("No microphone found. Please connect one and try again.", "error");
      } else {
        toast("Failed to start recording: " + err.message, "error");
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-[600px] bg-zinc-900/50 rounded-xl border border-zinc-800">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <p>No messages yet. Start a conversation with Jonathon Family!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isFromAdmin = msg.sender_id === null;
            return (
              <div
                key={msg.id}
                className={`flex ${isFromAdmin ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    isFromAdmin
                      ? "bg-violet-600/20 border border-violet-500/30 text-zinc-100"
                      : "bg-zinc-700 text-zinc-100"
                  }`}
                >
                  <p className="text-sm font-semibold text-violet-400">{msg.sender_name}</p>
                  {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((url, index) => {
                        const isAudio = url.endsWith(".webm") || url.includes("audio");
                        if (isAudio) {
                          return (
                            <audio
                              key={index}
                              src={url}
                              controls
                              className="w-full max-w-[240px] mt-1 accent-violet-600"
                            />
                          );
                        } else {
                          return (
                            <img
                              key={index}
                              src={url}
                              alt="Attachment"
                              className="max-w-full max-h-48 rounded-lg object-cover mt-1 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(url, "_blank")}
                            />
                          );
                        }
                      })}
                    </div>
                  )}
                  <p className="text-xs text-zinc-500 mt-2">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-zinc-800 p-4 bg-zinc-900/80">
        {attachmentPreviews.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachmentPreviews.map((preview, index) => (
              <div key={index} className="relative group">
                {preview.startsWith("data:") ? (
                  <img
                    src={preview}
                    alt={`Attachment ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 p-1 text-center">
                    {preview}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 rounded-full text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSendReply} className="flex gap-2">
          <label className="cursor-pointer">
            <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
            <input
              type="file"
              accept="image/*,audio/*"
              multiple
              onChange={handleAttachmentChange}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`px-3 py-2 border border-zinc-700 rounded-lg transition-colors ${
              isRecording 
                ? "bg-rose-600 text-white hover:bg-rose-700" 
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            {isRecording ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || (!(reply ?? '').trim() && attachments.length === 0)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
