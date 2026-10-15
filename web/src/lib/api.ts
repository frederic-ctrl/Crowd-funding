export class ApiError extends Error {
  messages: string[];
  status: number;
  constructor(status: number, message: string, messages?: string[]) {
    super(message);
    this.status = status;
    this.messages = messages ?? [message];
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Geen verbinding met de server. Controleer je internet.");
  }
  const data = (await res.json().catch(() => ({}))) as { fout?: string; fouten?: string[] } & T;
  if (!res.ok) throw new ApiError(res.status, data.fout ?? "Er ging iets mis.", data.fouten);
  return data;
}

export type PurchaseResponse = { transaction: string; tokens: number; cost: number; roundId: string; lastValidBlockHeight: number };

export function preparePurchase(wallet: string, bedrag: string, ronde: string) {
  return post<PurchaseResponse>("/api/koop", { wallet, bedrag, ronde });
}

export function requestTestEuro(wallet: string) {
  return post<{ signature: string; amountMicro: number; balanceMicro: number }>("/api/testgeld", { wallet });
}

export function joinWaitlist(email: string) {
  return post<{ ok: boolean }>("/api/waitlist", { email, consent: true, lang: "nl" });
}
