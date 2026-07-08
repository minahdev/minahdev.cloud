// 웹 푸시 Service Worker — 브라우저가 닫혀 있어도 백그라운드로 상주하며 알림을 받는다.

self.addEventListener("push", function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "새 메일", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "새 메일"
  const options = {
    body: data.body || "",
    data: { url: data.url || "/inbox" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/inbox"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
