import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    name: "pulse-action-api",
    status: "ok",
    message: "Pulse backend is ready for session and split-payment routes.",
  }),
);

serve(
  {
    fetch: app.fetch,
    port: 3002,
  },
  (info) => {
    console.log(`Pulse Action API running on http://localhost:${info.port}`);
  },
);

