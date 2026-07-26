/**
 * 署名と文字数カウントの検証。
 *
 *   node --test scripts/
 *
 * 署名は X 側でしか正誤がわからず、間違っていると本番で 401 が返るだけで
 * 原因が掴めない。なので X の公式ドキュメントに載っている既知のベクタで
 * 事前に検証しておく。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { authHeader, weightedLength } from "./post.mjs";

test("OAuth 1.0a の署名が公式ドキュメントのベクタと一致する", () => {
  // https://developer.x.com/en/docs/authentication/oauth-1-0a/creating-a-signature
  const header = authHeader(
    "POST",
    "https://api.twitter.com/1.1/statuses/update.json",
    {
      apiKey: "xvz1evFS4wEEPTGEFPHBog",
      apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
      accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
      accessSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      timestamp: "1318622958",
    },
    {
      status: "Hello Ladies + Gentlemen, a signed OAuth request!",
      include_entities: "true",
    },
  );

  assert.match(header, /^OAuth /);
  assert.ok(
    header.includes('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'),
    `署名が一致しません:\n${header}`,
  );
});

test("重み付き文字数: 日本語は2、ASCIIは1、URLは23", () => {
  assert.equal(weightedLength("abc"), 3);
  assert.equal(weightedLength("あいう"), 6);
  assert.equal(weightedLength("https://example.com/very/long/path/here"), 23);
  assert.equal(weightedLength("あ https://example.com"), 26); // 2 + 1(空白) + 23
});
