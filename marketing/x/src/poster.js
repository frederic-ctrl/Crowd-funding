// Plaatst posts op X via de officiële API (POST /2/tweets, OAuth 1.0a user context).
import { approvalHash } from "./text.js";

export function createXClient(env = process.env) {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = env;
  const missing = Object.entries({ X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`X-sleutels ontbreken: ${missing.join(", ")}. Zet ze als GitHub-secrets.`);
  }
  let clientPromise;
  const client = () => {
    clientPromise ??= import("twitter-api-v2").then(
      ({ TwitterApi }) =>
        new TwitterApi({
          appKey: X_API_KEY,
          appSecret: X_API_SECRET,
          accessToken: X_ACCESS_TOKEN,
          accessSecret: X_ACCESS_SECRET,
        }),
    );
    return clientPromise;
  };
  return {
    async post(text) {
      const api = await client();
      const { data } = await api.v2.tweet(text);
      return { id: data.id };
    },
  };
}

/**
 * Plaatst de geselecteerde posts. Zonder `enabled` is het een droogtest: er gaat niets naar X.
 * @returns {{ geplaatst: object[], fouten: { id: string, bericht: string }[] }}
 */
export async function publish({ toPost, state, client, enabled, now, log = console.log }) {
  const geplaatst = [];
  const fouten = [];
  for (const item of toPost) {
    if (!enabled) {
      log(`[droogtest] zou nu posten: ${item.id}\n${item.tekst}\n`);
      continue;
    }
    try {
      const { id } = await client.post(item.tekst);
      const record = {
        id: item.id,
        hash: approvalHash(item.tekst),
        tweetId: id,
        url: `https://x.com/i/web/status/${id}`,
        geplaatstOp: now.toISOString(),
        kostUsd: item.kostUsd,
      };
      state.posts.push(record);
      geplaatst.push(record);
      log(`geplaatst: ${item.id} -> ${record.url}`);
    } catch (err) {
      const detail = err?.data?.detail || err?.data?.title || err?.message || String(err);
      fouten.push({ id: item.id, bericht: detail });
      log(`FOUT bij ${item.id}: ${detail}`);
    }
  }
  return { geplaatst, fouten };
}
