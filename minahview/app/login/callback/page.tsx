import { Suspense } from "react"

import { CallbackClient } from "@/app/login/callback/callback-client"

export default function LoginCallbackPage() {
  return (
    <Suspense>
      <CallbackClient />
    </Suspense>
  )
}
