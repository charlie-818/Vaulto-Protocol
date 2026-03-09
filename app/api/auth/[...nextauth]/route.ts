import { handlers } from "@/lib/auth";
// Import prisma to ensure it's initialized and registered in globalThis
// before auth callbacks run
import "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
