# x-shukatsu-bot

28卒向けの就活アカウントを、ランニングコスト **¥0** で1日1投稿ずつ自動運用する仕組み。

投稿先は [適性検査ドリル](https://tekisei-drill.vercel.app) への導線を兼ねている。

## 仕組み

```
【月1回・手元で】
  Claude Code に prompts/generate-posts.md を貼る
  → posts.json に30本ぶんの投稿案が入る
  → 目を通して push

【毎朝7:30・GitHub Actions】
  posts.json から次の1本を取り出して X に投稿
  → state.json のカウンタを進めて自動 commit
  ※ Claude を呼ばないので完全無料。PC の電源も不要
```

30本使い切ると自動で投稿が止まる。同じ文面を投稿すると X 側で重複として弾かれるため、
無理に循環させず「次の30本を作る合図」にしている。

## かかるお金

| 項目 | 費用 |
|---|---|
| X API(Free tier) | ¥0 |
| GitHub Actions(publicリポジトリ) | ¥0 |
| 投稿文の生成 | Claude Code のサブスク内 |
| 画像生成 | 使わない(自サイトのOGPカードで代用) |

X Premium には**入らない**。収益分配の条件(フォロワー500人以上かつ直近3か月で
500万インプレッション)が重く、達成しても月数千円のため、月額 $8 を回収できない可能性が高い。
収益はアフィリエイトと自サイトの AdSense に寄せる。

## セットアップ

### 1. X アカウントと開発者登録

1. 投稿用の X アカウントを作る
2. [developer.x.com](https://developer.x.com) で Free プランのアプリを作成
3. アプリの **User authentication settings** を開き、以下を設定
   - App permissions: **Read and write**(Read only のままだと投稿が 403 になる)
   - Type of App: Web App / Automated App or Bot
4. **権限を変更したあとに** Keys and tokens タブで Access Token を再生成する
   (先に発行したトークンには古い権限が焼き付いているため)
5. 次の4つを控える
   - API Key / API Key Secret
   - Access Token / Access Token Secret

> Free プランの投稿上限は仕様変更が多い。1日1投稿なら問題ないが、
> 現在の上限は Developer Portal のダッシュボードで確認すること。

### 2. GitHub リポジトリ

このフォルダを **public** リポジトリとして push する
(private でも動くが、Actions の無料枠を消費する)。

Settings → Secrets and variables → Actions → New repository secret で4つ登録:

| Secret 名 | 中身 |
|---|---|
| `X_API_KEY` | API Key |
| `X_API_SECRET` | API Key Secret |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_SECRET` | Access Token Secret |

### 3. 動作確認

Actions タブ → `daily post` → Run workflow。
`dry_run` に **チェックを入れたまま**実行すると、投稿せずに次の1本が表示される。

問題なければ `dry_run` のチェックを外して実行し、実際に投稿されるか確認する。
以降は毎朝7:30に自動で動く。

## ローカルで確認する

```bash
node --test scripts/post.test.mjs  # 署名アルゴリズムと文字数カウントのテスト
node scripts/post.mjs --check      # 30本すべての文字数と重複を検査
node scripts/post.mjs --dry-run    # 次に投稿される1本を表示
```

依存パッケージなし。Node 20 以上があれば `npm install` は不要。

OAuth 1.0a の署名は、間違っていても X からは 401 が返るだけで原因が掴めない。
そのため X 公式ドキュメントの既知のテストベクタで署名を検証している。
`node --test` が通れば、あとは Secrets の値が正しいかだけの問題になる。

## 運用で気をつけること

- **自動フォロー・自動いいね・自動DMは実装しない。** X の自動化ルール違反で凍結対象。
  この仕組みが自動化しているのは自分の投稿だけ
- **締切や選考フローなど、鮮度のある情報は扱わない。** 事前生成なので、
  投稿される時点で古くなっている可能性がある。日付を1つ間違えると信用が消える
- **数字を盛らない。** 「◯割で通過」「内定率◯%」のような出典のない数字は、
  景品表示法の優良誤認にあたるうえ、アフィリエイト提携の解除理由にもなる
- GitHub の scheduled workflow は**リポジトリが60日間無活動だと自動停止する**。
  この仕組みは毎日 state.json を commit するので、通常は止まらない

## 収益化(まだ入れていない)

現状はフォロワーを貯める段階。導線は適性検査ドリルのみ。

次の段階で入れるもの:

1. A8.net で就活エージェント案件と提携し、
   [tekisei-drill の `lib/offers.ts`](../tekisei-drill/lib/offers.ts) に追加する
   (配列が空だと広告枠自体が描画されない設計になっている)
2. アプリ側の AdSense はすでに稼働中なので、送客が増えれば自動で乗る

見込みは半年でフォロワー1,000〜3,000、月数千円〜1万円程度。
立ち上げから2〜3か月はほぼゼロなので、そこは織り込んでおく。
