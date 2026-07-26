#!/usr/bin/env node
/**
 * X のヘッダー画像 (1500x500) の SVG を書き出す。
 *
 *   node scripts/build-header.mjs
 *
 * PNG へのラスタライズは sharp が要るので別工程(README の「画像を作り直す」を参照)。
 *
 * ■ 設計の根拠
 * 就活系で伸びているアカウント(@SHUUKATSU_28 など)のヘッダーに共通するのは、
 * 図形ではなく「文字で何がもらえるか言い切る」こと。具体的には
 *   - 明るい彩度の高い背景 + 集中線(暗い背景は目に留まらない)
 *   - 巨大な見出し1つ
 *   - 誰向けかを明記した帯
 *   - 「無料」「登録不要」など不安を消すバッジ
 * ここではその型に沿い、色だけ tekisei-drill のティール系に寄せている。
 *
 * ■ 配置の制約
 * プロフィール画面では上下が切られ、左下にアイコンが重なる。
 * そのため文字はすべて中央に寄せ、左下 (x<420, y>360) には情報を置かない。
 *
 * ■ フォント
 * 文字は Windows の Yu Gothic UI で描画される。別の環境で作り直すと字形が変わる。
 * librsvg は paint-order を解釈しないので、縁取りは「太い stroke の文字」→
 * 「塗りの文字」の順に2回描いて出している。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1500;
const H = 500;
const CX = W / 2;
const FONT = "Yu Gothic UI, Meiryo, sans-serif";

/** 縁取りつきの文字。librsvg 対策で stroke 版と fill 版を重ねる */
function outlined({ text, x, y, size, fill, stroke, strokeWidth, letterSpacing = 0 }) {
  const common =
    `x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="bold" ` +
    `text-anchor="middle" letter-spacing="${letterSpacing}"`;
  return [
    `  <text ${common} fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round">${text}</text>`,
    `  <text ${common} fill="${fill}">${text}</text>`,
  ].join("\n");
}

/** 中心から放射する集中線 */
function rays() {
  const out = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    if (i % 2) continue;
    const a1 = (i / count) * Math.PI * 2;
    const a2 = ((i + 0.85) / count) * Math.PI * 2;
    const r = 1300;
    const p = (a) => `${(CX + Math.cos(a) * r).toFixed(1)},${(250 + Math.sin(a) * r).toFixed(1)}`;
    out.push(`    <polygon points="${CX},250 ${p(a1)} ${p(a2)}" fill="#ffffff" opacity="0.06"/>`);
  }
  return out.join("\n");
}

/** 角のバッジ。少し傾けて手作り感を出す */
function badge({ text, x, y, w, rotate }) {
  return `  <g transform="translate(${x} ${y}) rotate(${rotate})">
    <rect x="0" y="0" width="${w}" height="78" rx="12" fill="#dc2626" stroke="#7f1d1d" stroke-width="4"/>
    <text x="${w / 2}" y="55" font-family="${FONT}" font-size="44" font-weight="bold" text-anchor="middle" fill="#ffffff">${text}</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- @tekisei_dojo のヘッダー。scripts/build-header.mjs が生成する。手で編集しない -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="55%" stop-color="#0e7490"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <radialGradient id="center" cx="0.5" cy="0.45" r="0.55">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="halftone" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="3" fill="#ffffff" opacity="0.10"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g>
${rays()}
  </g>
  <rect width="${W}" height="${H}" fill="url(#halftone)"/>
  <rect width="${W}" height="${H}" fill="url(#center)"/>

  <!-- 見出し。ヘッダーで一番読ませたい語を1つだけ大きく -->
${outlined({ text: "適性検査ドリル", x: CX, y: 235, size: 132, fill: "#fde047", stroke: "#0f172a", strokeWidth: 20, letterSpacing: 4 })}

  <!-- 何がもらえるかの一行。
       「毎日1問」とは書かない。実際に投稿している27本のうち適性検査の問題解説は7本で、
       残りは ES・面接・段取りの話。書いてあることと中身がずれると信用を落とす -->
${outlined({ text: "就活のコツを毎日1つ", x: CX, y: 318, size: 54, fill: "#ffffff", stroke: "#0f172a", strokeWidth: 10, letterSpacing: 2 })}

  <!-- 誰向けかを明記する帯 -->
  <rect x="0" y="382" width="${W}" height="76" fill="#09090b" opacity="0.88"/>
  <text x="${CX}" y="434" font-family="${FONT}" font-size="44" font-weight="bold" text-anchor="middle" fill="#ffffff" letter-spacing="3">■ 28卒専用　SPI・非言語の対策ドリル ■</text>

  <!-- 不安を消すバッジ。tekisei-drill は実際に無料・登録不要なので誇張ではない -->
${badge({ text: "完全無料", x: 62, y: 52, w: 216, rotate: -4 })}
${badge({ text: "登録不要", x: 1222, y: 52, w: 216, rotate: 4 })}
</svg>
`;

const out = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
  "header.svg",
);
fs.writeFileSync(out, svg, "utf8");
console.log(`header.svg を書き出しました (${W}x${H})`);
