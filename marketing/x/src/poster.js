// Plaatst posts op X via de officiële API (POST /2/tweets, OAuth 1.0a user context), met een
// afbeelding als de post er een heeft (POST /2/media/upload), en leest de resultaten van eigen posts.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { approvalHash } from "./text.js";
import { imageType } from "./calendar.js";

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
    async post(text, { afbeelding } = {}) {
      const api = await client();
      if (!afbeelding) {
        const { data } = await api.v2.tweet(text);
        return { id: data.id };
      }
      const mediaId = await api.v2.uploadMedia(readFileSync(afbeelding), { media_type: imageType(afbeelding), media_category: "tweet_image" });
      const { data } = await api.v2.tweet({ text, media: { media_ids: [mediaId] } });
      return { id: data.id };
    },
    /** Resultaten van eigen posts: weergaven, reacties, en (tot 30 dagen) klikken op de link en het profiel. */
    async metrics(ids) {
      const api = await client();
      const read = (fields) => api.v2.tweets(ids, { "tweet.fields": fields });
      let res;
      try {
        res = await read(["public_metrics", "non_public_metrics"]);
      } catch {
        res = await read(["public_metrics"]);
      }
      return (res.data ?? []).map((t) => ({
        tweetId: t.id,
        weergaven: t.public_metrics?.impression_count ?? null,
        likes: t.public_metrics?.like_count ?? 0,
        reposts: t.public_metrics?.retweet_count ?? 0,
        reacties: t.public_metrics?.reply_count ?? 0,
        citaten: t.public_metrics?.quote_count ?? 0,
        bladwijzers: t.public_metrics?.bookmark_count ?? 0,
        linkklikken: t.non_public_metrics?.url_link_clicks ?? null,
        profielklikken: t.non_public_metrics?.user_profile_clicks ?? null,
      }));
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
      log(`[droogtest] zou nu posten: ${item.id}${item.afbeelding ? ` (met afbeelding ${basename(item.afbeelding)})` : ""}\n${item.tekst}\n`);
      continue;
    }
    try {
      const { id } = await client.post(item.tekst, item.afbeelding ? { afbeelding: item.afbeelding } : {});
      const record = {
        id: item.id,
        hash: approvalHash(item.tekst),
        tweetId: id,
        url: `https://x.com/i/web/status/${id}`,
        geplaatstOp: now.toISOString(),
        kostUsd: item.kostUsd,
        ...(item.afbeelding ? { afbeelding: basename(item.afbeelding) } : {}),
        ...(item.test ? { test: item.test, variant: item.variant } : {}),
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
