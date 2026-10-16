export class ApiError extends Error {
  messages: string[];
  status: number;
  constructor(status: number, message: string, messages?: string[]) {
    super(message);
    this.status = status;
    this.messages = messages ?? [message];
  }
}

// De taal van de site gaat mee met elke aanvraag, zodat meldingen in de juiste taal terugkomen.
let lang: "en" | "nl" = "en";
export function setApiLang(l: "en" | "nl") {
  lang = l;
}

async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(body === undefined ? `${path}?lang=${lang}` : path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, lang }) });
  } catch {
    throw new ApiError(0, lang === "nl" ? "Geen verbinding met de server. Controleer je internet." : "Can’t reach the server. Check your connection.");
  }
  const data = (await res.json().catch(() => ({}))) as { fout?: string; fouten?: string[] } & T;
  if (!res.ok) throw new ApiError(res.status, data.fout ?? (lang === "nl" ? "Er ging iets mis." : "Something went wrong."), data.fouten);
  return data;
}

export type GenesisEvent = {
  kind: "aankoop" | "steun" | "terugbetaling" | "opname";
  productId: "pass" | "agency" | "steun" | null;
  number: number | null;
  name: string;
  wallet: string;
  mint: string | null;
  amountMicro: number;
  signature: string;
  time: number | null;
  slot: number;
  teruggegeven?: boolean;
};

export type GenesisState = {
  netwerk: string;
  kasMicro: number;
  producten: Record<"pass" | "agency", { verkocht: number; teruggegeven: number; hoogsteNummer: number }>;
  steun: { aantal: number; totaalMicro: number; wallets: number };
  opgehaaldMicro: number;
  terugbetaaldMicro: number;
  opgenomenMicro: number;
  verwachteKasMicro: number;
  muur: GenesisEvent[];
  gebeurtenissen: GenesisEvent[];
  bijgewerkt: string;
};

export function fetchGenesis() {
  return request<GenesisState>("/api/genesis");
}

export type Prepared = { transaction: string; lastValidBlockHeight: number };
export type PreparedPass = Prepared & { productId: "pass" | "agency"; number: number; label: string; priceMicro: number; mint: string };
export type PreparedSupport = Prepared & { productId: "steun"; amountMicro: number; newBadge: boolean };

export function preparePass(wallet: string, product: "pass" | "agency", naam: string) {
  return request<PreparedPass>("/api/koop", { wallet, product, naam });
}

export function prepareSupport(wallet: string, bedrag: string, naam: string) {
  return request<PreparedSupport>("/api/koop", { wallet, product: "steun", bedrag, naam });
}

export function prepareRefund(wallet: string, product: string, nummer: number) {
  return request<Prepared & { amountMicro: number }>("/api/terugbetaling", { wallet, product, nummer });
}

export function activatePass(wallet: string, product: string, nummer: number, bericht: string, handtekening: string) {
  return request<{ code: string; productId: string; number: number; websites: number }>("/api/activeer", { wallet, product, nummer, bericht, handtekening });
}

export function requestTestEuro(wallet: string) {
  return request<{ signature: string; amountMicro: number; balanceMicro: number }>("/api/testgeld", { wallet });
}

export function joinWaitlist(email: string, language: "en" | "nl") {
  return request<{ ok: boolean }>("/api/waitlist", { email, consent: true, lang: language });
}
