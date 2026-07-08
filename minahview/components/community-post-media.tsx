"use client"

import { resolveCommunityMediaUrl, type CommunityMediaItem } from "@/lib/pace-community-storage"
import { cn } from "@/lib/utils"

type Props = {
  media: CommunityMediaItem[]
  className?: string
}

export function CommunityPostMedia({ media, className }: Props) {
  if (!media.length) return null

  return (
    <div
      className={cn(
        "mt-3 grid gap-2",
        media.length === 1 ? "grid-cols-1" : "grid-cols-2",
        className,
      )}
    >
      {media.map((item, i) => {
        const src = resolveCommunityMediaUrl(item.url)
        if (item.type === "video") {
          return (
            <video
              key={`${item.url}-${i}`}
              src={src}
              controls
              playsInline
              className="max-h-72 w-full rounded-lg border border-border/60 bg-black object-contain"
            />
          )
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${item.url}-${i}`}
            src={src}
            alt=""
            className="max-h-72 w-full rounded-lg border border-border/60 object-cover"
          />
        )
      })}
    </div>
  )
}
