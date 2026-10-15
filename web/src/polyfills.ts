// Sommige Solana-bibliotheken verwachten Buffer als globale variabele, zoals in Node.
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;
