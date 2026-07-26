#!/usr/bin/env node
/**
 * posts.json から「予約投稿の作業リスト」を作る。
 *
 * X の公式の予約投稿機能(無料・API不要)で1本ずつ登録していく前提。
 * 画面と見比べながら上から順に消化できるよう、日付・時刻・本文を並べる。
 *
 *   node scripts/make-schedule.mjs              明日から1日1本
 *   node scripts/make-schedule.mjs 2026-09-01   開始日を指定
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POST_HOUR = "7:30";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const posts = JSON.parse(
  fs.readFileSync(path.join(ROOT, "posts.json"), "utf8"),
).posts;

// 開始日。省略時は明日
const arg = process.argv[2];
const start = arg ? new Date(`${arg}T00:00:00`) : new Date();
if (!arg) start.setDate(start.getDate() + 1);

if (Number.isNaN(start.getTime())) {
  console.error("日付は 2026-09-01 の形式で指定してください");
  process.exit(1);
}

const lines = [
  "# 予約投稿リスト",
  "",
  "X の投稿画面で、上から順に1本ずつ予約していく。",
  "",
  "1. 本文をコピーして投稿欄に貼る",
  "2. カレンダーのマークを押して、下の日付と時刻を入れる",
  "3. 「予約する」を押す",
  "",
  `全 ${posts.length} 本。1本あたり30秒ほどなので、20〜30分で終わる。`,
  "",
  "> このファイルは `node scripts/make-schedule.mjs` で作り直せる。",
  "",
  "---",
  "",
];

posts.forEach((post, i) => {
  const d = new Date(start);
  d.setDate(d.getDate() + i);
  const label =
    `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]}) ${POST_HOUR}`;

  lines.push(`## ${i + 1}／${posts.length}　${label}`, "", "```", post.text, "```", "");
});

const out = path.join(ROOT, "schedule.md");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(`schedule.md を作りました(${posts.length}本 / ${start.getMonth() + 1}月${start.getDate()}日から)`);
