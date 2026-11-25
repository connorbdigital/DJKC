/** The Vercel function: a POST prices a basket, a GET reports the bridge. */
import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
