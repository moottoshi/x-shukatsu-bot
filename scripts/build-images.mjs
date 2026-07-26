#!/usr/bin/env node
/**
 * X のアイコン (400x400) とヘッダー (1500x500) の SVG を書き出す。
 *
 *   node scripts/build-images.mjs
 *
 * PNG へのラスタライズは sharp が要るので別工程(README の「画像を作り直す」を参照)。
 *
 * ■ 設計の根拠
 * 就活系で伸びているアカウント(@SHUUKATSU_28 など)の画像に共通するのは、
 * 図形ではなく「文字で何のアカウントか言い切る」こと。具体的には
 *   - 明るい彩度の高い背景 + 集中線(暗い背景はタイムラインで沈む)
 *   - 巨大な見出し1つ。アイコンは2文字まで
 *   - 誰向けかを明記した帯
 *   - 「無料」「登録不要」など不安を消すバッジ
 * 色だけ tekisei-drill のティール系に寄せている。
 *
 * ■ 配置の制約
 * アイコンは円形に切られるので、中心から半径160の内側に収める。
 * ヘッダーは上下が切られ左下にアイコンが重なるので、文字はすべて中央に寄せる。
 *
 * ■ フォント
 * Windows の Yu Gothic UI で描画される。別の環境で作り直すと字形が変わる。
 * librsvg は paint-order を解釈しないので、縁取りは「太い stroke の文字」→
 * 「塗りの文字」の順に2回描いて出している。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT = "Yu Gothic UI, Meiryo, sans-serif";
const ASSETS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
);

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
function rays(cx, cy, reach, count = 28) {
  const out = [];
  for (let i = 0; i < count; i += 2) {
    const a1 = (i / count) * Math.PI * 2;
    const a2 = ((i + 0.85) / count) * Math.PI * 2;
    const p = (a) =>
      `${(cx + Math.cos(a) * reach).toFixed(1)},${(cy + Math.sin(a) * reach).toFixed(1)}`;
    out.push(`    <polygon points="${cx},${cy} ${p(a1)} ${p(a2)}" fill="#ffffff" opacity="0.06"/>`);
  }
  return out.join("\n");
}

/** 背景(グラデーション・集中線・網点・中央の光)の定義と描画をまとめて返す */
function backdrop(w, h, cx, cy, reach) {
  return {
    defs: `    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
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
    </pattern>`,
    body: `  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g>
${rays(cx, cy, reach)}
  </g>
  <rect width="${w}" height="${h}" fill="url(#halftone)"/>
  <rect width="${w}" height="${h}" fill="url(#center)"/>`,
  };
}

// ---------------------------------------------------------------------------
// アイコン
// ---------------------------------------------------------------------------

function buildAvatar() {
  const S = 400;
  const bg = backdrop(S, S, S / 2, 180, 400);

  // タイムラインでは 48px まで縮む。読ませるのは2文字が限界なので「適性」だけ。
  // 下の帯は縮むと読めないが、色の面として効くので残している。
  // 学年(28卒など)は毎年書き換えが要るのでアイコンには入れない
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <!-- @tekisei_dojo のアイコン。scripts/build-images.mjs が生成する。手で編集しない -->
  <defs>
${bg.defs}
  </defs>
${bg.body}

${outlined({ text: "適性", x: S / 2, y: 232, size: 152, fill: "#fde047", stroke: "#0f172a", strokeWidth: 22, letterSpacing: 2 })}

  <rect x="88" y="286" width="224" height="58" rx="10" fill="#09090b" opacity="0.88"/>
  <text x="${S / 2}" y="328" font-family="${FONT}" font-size="38" font-weight="bold" text-anchor="middle" fill="#ffffff" letter-spacing="2">SPI対策</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// ヘッダー
// ---------------------------------------------------------------------------

/** 角のバッジ。少し傾けて手作り感を出す */
function badge({ text, x, y, w, rotate }) {
  return `  <g transform="translate(${x} ${y}) rotate(${rotate})">
    <rect x="0" y="0" width="${w}" height="78" rx="12" fill="#dc2626" stroke="#7f1d1d" stroke-width="4"/>
    <text x="${w / 2}" y="55" font-family="${FONT}" font-size="44" font-weight="bold" text-anchor="middle" fill="#ffffff">${text}</text>
  </g>`;
}

function buildHeader() {
  const W = 1500;
  const H = 500;
  const CX = W / 2;
  const bg = backdrop(W, H, CX, 250, 1300);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- @tekisei_dojo のヘッダー。scripts/build-images.mjs が生成する。手で編集しない -->
  <defs>
${bg.defs}
  </defs>
${bg.body}

  <!-- 見出し。ヘッダーで一番読ませたい語を1つだけ大きく -->
${outlined({ text: "適性検査ドリル", x: CX, y: 235, size: 132, fill: "#fde047", stroke: "#0f172a", strokeWidth: 20, letterSpacing: 4 })}

  <!-- 何がもらえるかの一行。
       「毎日1問」とは書かない。初回に投稿した27本のうち適性検査の解説は7本で、
       残りは ES・面接・段取りの話だった。書いてあることと中身がずれると信用を落とす -->
${outlined({ text: "就活のコツを毎日1つ", x: CX, y: 318, size: 54, fill: "#ffffff", stroke: "#0f172a", strokeWidth: 10, letterSpacing: 2 })}

  <!-- 誰向けかを明記する帯。
       解き方は学年に関係ないので 29卒 まで広げる。30卒は 2026年7月時点で大学1年、
       まだ適性検査を調べていないので入れない(1年後に足す) -->
  <rect x="0" y="382" width="${W}" height="76" fill="#09090b" opacity="0.88"/>
  <text x="${CX}" y="434" font-family="${FONT}" font-size="44" font-weight="bold" text-anchor="middle" fill="#ffffff" letter-spacing="3">■ 28卒・29卒　SPI・非言語の対策ドリル ■</text>

  <!-- 不安を消すバッジ。tekisei-drill は実際に無料・登録不要なので誇張ではない -->
${badge({ text: "完全無料", x: 62, y: 52, w: 216, rotate: -4 })}
${badge({ text: "登録不要", x: 1222, y: 52, w: 216, rotate: 4 })}
</svg>
`;
}

for (const [name, svg] of [["avatar", buildAvatar()], ["header", buildHeader()]]) {
  fs.writeFileSync(path.join(ASSETS, `${name}.svg`), svg, "utf8");
  console.log(`${name}.svg を書き出しました`);
}
