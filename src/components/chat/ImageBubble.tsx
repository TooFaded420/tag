import { Download } from "lucide-react";

interface Props {
  imageUrl: string;
  prompt: string;
  model: string;
}

/**
 * Renders an image generation result in an assistant bubble.
 * Cream theme, rounded-md, max-w-2xl, download button overlay top-right.
 */
export function ImageBubble({ imageUrl, prompt, model }: Props) {
  function handleDownload() {
    const a = document.createElement("a");
    a.href = imageUrl;
    // For data URIs, the download attribute triggers save dialog.
    // For remote URLs (synthetic.new CDN), it opens in new tab if CORS blocks.
    a.download = `tag-image-${Date.now()}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <div className="relative inline-block max-w-2xl w-full rounded-md overflow-hidden border border-border bg-card shadow-sm">
      {/* Download button — overlay top-right */}
      <button
        type="button"
        onClick={handleDownload}
        title="Download image"
        aria-label="Download image"
        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-background/80 backdrop-blur-sm px-2 py-1 text-[11px] text-foreground hover:bg-background transition-colors border border-border/50 shadow-sm"
      >
        <Download className="h-3 w-3" />
        <span className="hidden sm:inline">Download</span>
      </button>

      {/* Generated image */}
      <img
        src={imageUrl}
        alt={prompt}
        className="w-full h-auto block rounded-md"
        loading="lazy"
      />

      {/* Caption: model + truncated prompt */}
      <div className="px-3 py-2 border-t border-border/40 bg-muted/30">
        <p className="text-[10px] font-mono text-muted-foreground/70 truncate">
          <span className="text-muted-foreground font-medium">{model.split("/").pop()}</span>
          {" · "}
          {prompt.length > 80 ? prompt.slice(0, 80) + "…" : prompt}
        </p>
      </div>
    </div>
  );
}
