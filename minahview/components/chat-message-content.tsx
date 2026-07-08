import { Fragment } from "react"

import { cn } from "@/lib/utils"

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

function isBulletLine(line: string) {
  return /^[-*•]\s+/.test(line.trim())
}

function isNumberedLine(line: string) {
  return /^\d+\.\s+/.test(line.trim())
}

function parseBlocks(text: string) {
  return text.split(/\n{2,}/).filter((b) => b.trim())
}

export function ChatMessageContent({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const blocks = parseBlocks(text.trim())

  if (blocks.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed", className)}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((l) => l.trim())

        if (lines.length > 0 && lines.every(isBulletLine)) {
          return (
            <ul key={blockIndex} className="list-disc space-y-1.5 pl-4 marker:text-primary/80">
              {lines.map((line, i) => (
                <li key={i} className="pl-0.5">
                  {formatInline(line.trim().replace(/^[-*•]\s+/, ""))}
                </li>
              ))}
            </ul>
          )
        }

        if (lines.length > 0 && lines.every(isNumberedLine)) {
          return (
            <ol key={blockIndex} className="list-decimal space-y-1.5 pl-4 marker:text-primary/80">
              {lines.map((line, i) => (
                <li key={i} className="pl-0.5">
                  {formatInline(line.trim().replace(/^\d+\.\s+/, ""))}
                </li>
              ))}
            </ol>
          )
        }

        const headingMatch = block.match(/^#{1,3}\s+(.+)/)
        if (headingMatch && lines.length === 1) {
          return (
            <p key={blockIndex} className="font-semibold text-foreground">
              {formatInline(headingMatch[1])}
            </p>
          )
        }

        return (
          <p key={blockIndex} className="text-foreground/95">
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {formatInline(line)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
