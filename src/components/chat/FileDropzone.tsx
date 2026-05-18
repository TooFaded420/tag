import { useRef, useState } from "react";
import { Crown, Paperclip, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FILE_INGEST_URL = `${SUPABASE_URL}/functions/v1/tag-file-ingest`;

const MAX_FILE_BYTES_TEXT = 5 * 1024 * 1024; // 5 MB — text files
const MAX_FILE_BYTES_PDF = 10 * 1024 * 1024; // 10 MB — PDFs
const MAX_FILE_BYTES_IMAGE = 5 * 1024 * 1024; // 5 MB — images

// Accepted image MIME types for vision input
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Accepted mime types (must match edge function)
const ACCEPTED_MIMES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "text/csv",
  "text/xml",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/pdf",
];

// File extensions that map to text content even when browser reports generic mime
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "mdx", "markdown", "json", "jsonl", "yaml", "yml",
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift", "cpp", "c", "h",
  "cs", "php", "sh", "bash", "zsh", "fish", "ps1",
  "html", "htm", "css", "scss", "sass", "less",
  "xml", "svg", "toml", "ini", "env", "conf", "cfg",
  "csv", "tsv", "sql", "graphql", "gql",
  "dockerfile", "makefile", "gemfile", "rakefile",
  "pdf",
]);

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function resolvedMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = getExtension(file.name);
  if (ext === "md" || ext === "mdx" || ext === "markdown") return "text/markdown";
  if (ext === "json" || ext === "jsonl") return "application/json";
  if (ext === "ts" || ext === "tsx") return "application/typescript";
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "application/javascript";
  if (ext === "pdf") return "application/pdf";
  return "text/plain";
}

function isImageFile(file: File): boolean {
  const mime = file.type.split(";")[0].trim().toLowerCase();
  return IMAGE_MIMES.has(mime);
}

function isAcceptedFile(file: File): boolean {
  if (isImageFile(file)) return true;
  const ext = getExtension(file.name);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (ACCEPTED_MIMES.includes(mime)) return true;
  return false;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      const base64 = result.split(",")[1];
      if (!base64) reject(new Error("Failed to encode file"));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; filename: string; progress: number }
  | { status: "success"; filename: string; chunks: number; pages?: number; isImage?: boolean }
  | { status: "error"; message: string };

export interface PendingImage {
  dataUrl: string;
  mimeType: string;
  name: string;
}

interface FileDropzoneProps {
  jwt: string | null;
  tier: "free" | "pro";
  onIngested: (summary: string) => void;
  /** Called when the user drops/picks an image (PNG/JPG/WebP, max 5 MB). Pro only. */
  onImageAttached?: (img: PendingImage) => void;
}

export function FileDropzone({ jwt, tier, onIngested, onImageAttached }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);

  async function processFile(file: File) {
    // Free/anon gate
    if (tier !== "pro") {
      setUploadState({
        status: "error",
        message: "File upload is a Pro feature. Upgrade for $7/mo to use it.",
      });
      return;
    }

    if (!jwt) {
      setUploadState({ status: "error", message: "Sign in to upload files." });
      return;
    }

    // ── Image branch: base64-encode and pass back via callback ───────────────
    if (isImageFile(file)) {
      if (file.size > MAX_FILE_BYTES_IMAGE) {
        setUploadState({
          status: "error",
          message: `Image too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 5 MB.`,
        });
        return;
      }
      setUploadState({ status: "uploading", filename: file.name, progress: 50 });
      try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const mimeType = file.type.split(";")[0].trim() || "image/png";
        onImageAttached?.({ dataUrl, mimeType, name: file.name });
        setUploadState({ status: "success", filename: file.name, chunks: 0, isImage: true });
        setTimeout(() => setUploadState({ status: "idle" }), 4000);
      } catch {
        setUploadState({ status: "error", message: "Failed to read image. Please try again." });
      }
      return;
    }

    // Client-side validation (text / PDF path unchanged)
    if (!isAcceptedFile(file)) {
      setUploadState({
        status: "error",
        message: `Unsupported file type: ${file.name}. Accepted: PDF, text, markdown, JSON, code files.`,
      });
      return;
    }

    const isPdf = resolvedMime(file) === "application/pdf";
    const maxBytes = isPdf ? MAX_FILE_BYTES_PDF : MAX_FILE_BYTES_TEXT;
    const maxLabel = isPdf ? "10 MB" : "5 MB";
    if (file.size > maxBytes) {
      setUploadState({
        status: "error",
        message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${maxLabel}.`,
      });
      return;
    }

    setUploadState({ status: "uploading", filename: file.name, progress: 10 });

    let content_base64: string;
    try {
      content_base64 = await toBase64(file);
    } catch {
      setUploadState({ status: "error", message: "Failed to read file. Please try again." });
      return;
    }

    setUploadState({ status: "uploading", filename: file.name, progress: 40 });

    const mime_type = resolvedMime(file);

    let res: Response;
    try {
      res = await fetch(FILE_INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ filename: file.name, mime_type, content_base64 }),
      });
    } catch {
      setUploadState({ status: "error", message: "Network error. Please check your connection." });
      return;
    }

    setUploadState({ status: "uploading", filename: file.name, progress: 90 });

    let data: { filename?: string; chunks_stored?: number; pages_processed?: number; summary?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg =
        res.status === 413
          ? (data.error ?? "File too large.")
          : res.status === 415
          ? (data.error ?? "Unsupported file type.")
          : res.status === 401
          ? "Authentication error. Please sign in again."
          : res.status === 503
          ? "Service temporarily unavailable. Try again shortly."
          : (data.error ?? `Upload failed (${res.status}).`);
      setUploadState({ status: "error", message: msg });
      return;
    }

    const chunks = data.chunks_stored ?? 0;
    const pages = data.pages_processed;
    const summary = data.summary ?? `Stored ${chunks} chunk${chunks !== 1 ? "s" : ""} from ${file.name}.`;

    setUploadState({ status: "success", filename: file.name, chunks, pages });
    onIngested(summary);

    // Auto-clear success after 8 s
    setTimeout(() => setUploadState({ status: "idle" }), 8000);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleClick() {
    if (tier !== "pro") {
      setUploadState({
        status: "error",
        message: "File upload is a Pro feature. Upgrade for $7/mo to use it.",
      });
      return;
    }
    inputRef.current?.click();
  }

  function dismiss() {
    setUploadState({ status: "idle" });
  }

  const isUploading = uploadState.status === "uploading";

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={[...TEXT_EXTENSIONS].map((e) => `.${e}`).join(",") + ",image/png,image/jpeg,image/webp"}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={isUploading}
      />

      {/* Drop zone overlay — only active when dragging */}
      {dragOver && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <p className="text-xs font-medium text-primary">Drop file here</p>
        </div>
      )}

      {/* Paperclip trigger button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={tier !== "pro" ? "Pro feature — upload files to chat" : "Upload file — PDF, markdown, code, or text (max 10 MB for PDF, 5 MB for text)"}
        aria-label="Upload file"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-muted",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          dragOver && "text-primary bg-primary/10",
        )}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : tier !== "pro" ? (
          <span className="relative">
            <Paperclip className="h-4 w-4" />
            <Crown className="absolute -top-1 -right-1 h-2.5 w-2.5 text-primary" />
          </span>
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </button>

      {/* Status banner — shows above the input row */}
      {uploadState.status !== "idle" && (
        <div
          className={cn(
            "absolute bottom-full left-0 mb-2 flex w-72 max-w-[90vw] items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm",
            uploadState.status === "success" &&
              "border-green-500/30 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300",
            uploadState.status === "error" &&
              "border-destructive/30 bg-destructive/10 text-destructive",
            uploadState.status === "uploading" &&
              "border-border bg-card text-muted-foreground",
          )}
        >
          <div className="mt-0.5 shrink-0">
            {uploadState.status === "success" && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            )}
            {uploadState.status === "error" && (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            {uploadState.status === "uploading" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
          </div>
          <p className="flex-1 leading-relaxed">
            {uploadState.status === "uploading" &&
              `Uploading ${uploadState.filename}… ${uploadState.progress}%`}
            {uploadState.status === "success" &&
              (uploadState.isImage
                ? `${uploadState.filename} attached — ask your question below.`
                : `${uploadState.filename} — ${uploadState.chunks} chunk${uploadState.chunks !== 1 ? "s" : ""}${uploadState.pages !== undefined ? ` across ${uploadState.pages} page${uploadState.pages !== 1 ? "s" : ""}` : ""} stored in memory.`)}
            {uploadState.status === "error" && uploadState.message}
          </p>
          {(uploadState.status === "success" || uploadState.status === "error") && (
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
