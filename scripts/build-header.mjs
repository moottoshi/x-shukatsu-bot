#!/usr/bin/env node
/**
 * X のヘッダー画像 (1500x500) の SVG を書き出す。
 *
 *   node scripts/build-header.mjs
 *
 * PNG へのラスタライズは sharp が要るので別工程。tekisei-drill 側に入っているものを使う:
 *   cd ../tekisei-drill && node -e "import('sharp').then(async ({default:s})=>{ ... })"
 * (README の「画像を作り直す」を参照)
 *
 * ■ 配置の制約
 * ヘッダーはプロフィール画面で上下が切られ、左下にアイコンが重なる。
 * そのため主題は右寄りに置き、左下 (x<420, y>300) には何も置かない。
 * 文字は入れない。SVG のテキストはレンダラ側のフォントに依存して崩れるため、
 * 説明はプロフィールの自己紹介に任せる。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1500;
const H = 500;

// マークシートの丸を敷き詰める範囲
const ROWS = [170, 250, 330];
const COL_START = 300;
const COL_STEP = 78;
const COL_COUNT = 15;
const R = 24;

// 塗る丸の位置 [行, 列]。1行に1つだけ塗られている解答用紙に見えるよう散らす
const MARKED = new Set(["0,2", "1,5", "2,3", "0,7", "1,9", "2,12"]);

// 鉛筆が指す丸。ここだけリングを足して「いま塗っている」感を出す。
// 鉛筆は右下から左上に伸びるので、右端に寄せると画面外にはみ出す
const FOCUS_ROW = 0;
const FOCUS_COL = 11;

const bubbles = [];
ROWS.forEach((cy, row) => {
  for (let col = 0; col < COL_COUNT; col++) {
    // 焦点の丸はマスクの外に別途描くので、ここでは飛ばす
    if (row === FOCUS_ROW && col === FOCUS_COL) continue;

    const cx = COL_START + col * COL_STEP;
    const marked = MARKED.has(`${row},${col}`);
    bubbles.push(
      marked
        ? `    <circle cx="${cx}" cy="${cy}" r="${R}" fill="#2dd4bf"/>`
        : `    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#52525b" stroke-width="6"/>`,
    );
  }
});

const FOCUS = { cx: COL_START + FOCUS_COL * COL_STEP, cy: ROWS[FOCUS_ROW] };

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!--
    @tekisei_dojo のヘッダー。scripts/build-header.mjs が生成する。手で編集しない。
    配色は tekisei-drill/assets/og-hero.svg に合わせている。
  -->
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.30"/>
      <stop offset="60%" stop-color="#0d9488" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pencil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>

    <!-- 左側はアイコンが重なるので、丸を左へいくほど薄くする -->
    <linearGradient id="fadeLeft" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000000"/>
      <stop offset="28%" stop-color="#3f3f3f"/>
      <stop offset="55%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <mask id="fade">
      <rect width="${W}" height="${H}" fill="url(#fadeLeft)"/>
    </mask>
  </defs>

  <rect width="${W}" height="${H}" fill="#09090b"/>
  <ellipse cx="1010" cy="250" rx="620" ry="330" fill="url(#glow)"/>

  <g mask="url(#fade)">
${bubbles.join("\n")}
  </g>

  <!-- 鉛筆が指している丸。マスクの外に置いてはっきり見せる -->
  <circle cx="${FOCUS.cx}" cy="${FOCUS.cy}" r="${R + 20}" fill="none" stroke="#14b8a6" stroke-width="4" opacity="0.45"/>
  <circle cx="${FOCUS.cx}" cy="${FOCUS.cy}" r="${R}" fill="#2dd4bf"/>

  <!-- 鉛筆。芯が上の丸に向くよう右下から左上へ -->
  <g transform="translate(${FOCUS.cx + 118} ${FOCUS.cy + 150}) rotate(38)">
    <rect x="-21" y="-196" width="42" height="156" rx="5" fill="url(#pencil)"/>
    <rect x="5" y="-196" width="16" height="156" fill="#d97706" opacity="0.55"/>
    <polygon points="-21,-40 21,-40 0,14" fill="#fcd9a8"/>
    <polygon points="-8,-6 8,-6 0,14" fill="#18181b"/>
    <rect x="-21" y="-214" width="42" height="20" rx="4" fill="#a1a1aa"/>
  </g>

  <!-- 進捗バー。解答が進んでいる感じを一本の線で出す。左下はアイコンが重なるので x=440 から -->
  <rect x="440" y="408" width="920" height="12" rx="6" fill="#27272a"/>
  <rect x="440" y="408" width="600" height="12" rx="6" fill="#14b8a6" opacity="0.85"/>
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
