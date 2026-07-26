#!/usr/bin/env node
/**
 * posts.json から次の1本を取り出して X に投稿する。
 *
 * 依存パッケージなし(Node 20+ の標準機能だけで動く)。
 * npm install が要らないので GitHub Actions が数秒で終わり、無料枠をほぼ消費しない。
 *
 * 認証は OAuth 1.0a User Context を使う。OAuth 2.0 だとアクセストークンの
 * 有効期限が短くリフレッシュの保存先が要るが、1.0a のキー4本は無期限なので
 * GitHub Secrets に置きっぱなしにできる。
 *
 *   node scripts/post.mjs --check     全投稿の文字数と重複を検査(投稿しない)
 *   node scripts/post.mjs --dry-run   次に投稿される1本を表示(投稿しない)
 *   node scripts/post.mjs             実際に投稿する
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_PATH = path.join(ROOT, "posts.json");
const STATE_PATH = path.join(ROOT, "state.json");
const ENDPOINT = "https://api.x.com/2/tweets";

// ---------------------------------------------------------------------------
// 文字数カウント
// ---------------------------------------------------------------------------

/**
 * X の「重み付き文字数」。上限は 280。
 *
 * ASCII など一部の範囲は1文字=1、それ以外(日本語・絵文字)は1文字=2で数える。
 * URL は実際の長さに関係なく一律 23 文字に短縮されて数えられる。
 * つまり日本語だけなら実質140文字、URLを1本入れると本文は約128文字が上限。
 */
const LIGHT_RANGES = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const URL_RE = /https?:\/\/\S+/g;
export const MAX_WEIGHTED = 280;

export function weightedLength(text) {
  const urlCount = (text.match(URL_RE) || []).length;
  const rest = text.replace(URL_RE, "");
  let weight = 0;
  for (const ch of rest) {
    const cp = ch.codePointAt(0);
    const light = LIGHT_RANGES.some(([s, e]) => cp >= s && cp <= e);
    weight += light ? 100 : 200;
  }
  return Math.round(weight / 100) + urlCount * 23;
}

// ---------------------------------------------------------------------------
// OAuth 1.0a
// ---------------------------------------------------------------------------

/** RFC3986 のパーセントエンコード。encodeURIComponent が残す4文字を追加で潰す */
const pct = (s) =>
  encodeURIComponent(String(s)).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );

/**
 * @param extra クエリ文字列など、oauth_* 以外で署名対象に含めるパラメータ。
 *   本文が JSON のリクエストでは本文を署名に含めないので、通常は空でよい
 *   (含めるのは form-encoded のときだけ)。テストで既知のベクタを検証するために開けてある。
 */
export function authHeader(method, url, creds, extra = {}) {
  const params = {
    ...extra,
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: creds.nonce ?? crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:
      creds.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");

  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const key = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`;
  params.oauth_signature = crypto
    .createHmac("sha1", key)
    .update(base)
    .digest("base64");

  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map((k) => `${pct(k)}="${pct(params[k])}"`)
      .join(", ")
  );
}

function readCreds() {
  const creds = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  };
  const missing = Object.entries(creds)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `環境変数が足りません: ${missing.join(", ")}\n` +
        "GitHub の Settings → Secrets and variables → Actions に登録してください。",
    );
  }
  return creds;
}

async function postTweet(text, creds) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authHeader("POST", ENDPOINT, creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

// ---------------------------------------------------------------------------
// ファイル
// ---------------------------------------------------------------------------

const readJson = (p, fallback) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;

function loadPosts() {
  const data = readJson(POSTS_PATH, null);
  if (!data || !Array.isArray(data.posts)) {
    throw new Error("posts.json が読めません");
  }
  return data.posts;
}

function loadState() {
  return readJson(STATE_PATH, { nextIndex: 0, history: [] });
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// 各モード
// ---------------------------------------------------------------------------

function check(posts) {
  let bad = 0;
  const seen = new Set();

  for (const p of posts) {
    const len = weightedLength(p.text);
    const problems = [];
    if (len > MAX_WEIGHTED) problems.push(`${len}/${MAX_WEIGHTED} 超過`);
    if (seen.has(p.text)) problems.push("本文が他と重複(X が重複投稿を弾きます)");
    seen.add(p.text);

    if (problems.length > 0) {
      bad++;
      console.error(`NG  ${p.id}  ${problems.join(" / ")}`);
    } else {
      console.log(`ok  ${p.id}  ${String(len).padStart(3)}/${MAX_WEIGHTED}  ${p.category}`);
    }
  }

  console.log(`\n${posts.length}本中 ${posts.length - bad}本OK`);
  if (bad > 0) process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const posts = loadPosts();

  if (args.includes("--check")) {
    check(posts);
    return;
  }

  const state = loadState();
  const index = state.nextIndex ?? 0;

  if (index >= posts.length) {
    // 使い切った。同じ投稿を繰り返すと X 側で重複として弾かれるので、
    // ここは失敗させず静かに終了して、次の30本を用意する合図にする。
    console.log(
      `投稿ストックを使い切りました(${posts.length}本すべて投稿済み)。\n` +
        "prompts/generate-posts.md を使って次の30本を生成してください。",
    );
    return;
  }

  const post = posts[index];
  const len = weightedLength(post.text);
  if (len > MAX_WEIGHTED) {
    throw new Error(`${post.id} が長すぎます(${len}/${MAX_WEIGHTED})`);
  }

  if (args.includes("--dry-run")) {
    console.log(`--- ${post.id} (${index + 1}/${posts.length}) ${len}/${MAX_WEIGHTED} ---`);
    console.log(post.text);
    return;
  }

  const result = await postTweet(post.text, readCreds());
  const tweetId = result?.data?.id ?? null;

  state.nextIndex = index + 1;
  state.history = [
    ...(state.history ?? []),
    { id: post.id, tweetId, at: new Date().toISOString() },
  ];
  saveState(state);

  console.log(`投稿しました ${post.id} → https://x.com/i/status/${tweetId}`);
  console.log(`残り ${posts.length - state.nextIndex} 本`);
}

// テストから import されたときは実行しない
const isEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntry) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
