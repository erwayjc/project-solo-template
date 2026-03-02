"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

interface VideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
}

type EmbedInfo =
  | { type: "youtube"; embedUrl: string }
  | { type: "vimeo"; embedUrl: string }
  | { type: "native" };

function getEmbedInfo(url: string): EmbedInfo {
  // YouTube: supports youtube.com/watch?v=, youtu.be/, youtube.com/embed/
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  // Vimeo: supports vimeo.com/<id> and player.vimeo.com/video/<id>
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/,
  );
  if (vimeoMatch) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  return { type: "native" };
}

export function VideoPlayer({ url, title, className }: VideoPlayerProps) {
  const embed = useMemo(() => getEmbedInfo(url), [url]);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
        {embed.type === "youtube" || embed.type === "vimeo" ? (
          <iframe
            src={embed.embedUrl}
            title={title || "Video player"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <video
            src={url}
            title={title || "Video player"}
            controls
            playsInline
            className="absolute inset-0 h-full w-full"
          >
            <track kind="captions" />
          </video>
        )}
      </div>
    </div>
  );
}
