import { getAuth } from "@/server/auth";

// better-auth's handler, built lazily so `next build` can import this module without the secret.
export const GET = (req: Request) => getAuth().handler(req);
export const POST = (req: Request) => getAuth().handler(req);
