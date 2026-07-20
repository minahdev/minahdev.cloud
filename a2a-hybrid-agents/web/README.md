# web — Vercel frontend (scaffold only)

Out of `pyproject` scope. A Next.js app that:

1. `POST`s `{ message, agent }` to the AWS orchestrator's `/chat`.
2. Reads the `text/event-stream` response and appends each `data:` chunk until `[DONE]`.

```ts
const res = await fetch(`${ORCH_URL}/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message, agent: "exaone" }),
});
const reader = res.body!.getReader();
// decode chunks, split on "\n\n", strip "data: ", stop at "[DONE]"
```

Env: `ORCH_URL` = the orchestrator's public URL.

`npx create-next-app@latest .` here when you build it out.
