// Vice City Hub — Agent API v12 · entry point
// Public base: https://<project>.supabase.co/functions/v1/agent-api
// Request pipeline: app.ts · route table: router.ts · wiring of the real helpers: main.ts
import spec from "./openapi.json" with { type: "json" };
import { createHandler } from "./main.ts";

Deno.serve(createHandler(spec));
