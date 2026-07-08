import Link from "next/link"
import { Activity } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-6">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary/20 rounded-md flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Pace</span>
        </Link>

        <p className="text-sm text-muted-foreground">
          © 2026 Pace. Healthcare application.
        </p>

        <div className="flex items-center gap-6">
          <Link href="/settings/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            개인정보처리방침
          </Link>
          <Link href="/settings/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            이용약관
          </Link>
        </div>
      </div>
    </footer>
  )
}
