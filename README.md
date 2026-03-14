# NFT Mint Notification System

NFT が新たにクレーム（Mint）された際に通知を送信するシステムです。

## 対象 NFT

- **コレクション**: MetaGriLabo Thanks Gift Farming 2025
- **コントラクトアドレス**: `0x30961b851a8a766014e53955694b3210718066e5`
- **ネットワーク**: Polygon (Matic)
- **OpenSea**: https://opensea.io/collection/metagrilabo-thanks-gift-farming-2025
- **PolygonScan**: https://polygonscan.com/address/0x30961b851a8a766014e53955694b3210718066e5

## システム概要

1. **Polygon ブロックチェーンの監視**: 定期的にブロックチェーンをポーリングして新しい Transfer イベントを検出
2. **ERC721 & ERC1155 対応**: TransferSingle、TransferBatch もサポート
3. **新規 Mint の判定**: `from` アドレスがゼロアドレスのイベントのみを対象
4. **Google Apps Script (GAS) への通知**: 検出した Mint イベントを GAS の Web アプリエンドポイントに POST
5. **メール送信**: GAS 側でメールを送信

## 構成

| 項目 | 内容 |
|---|---|
| サーバー | Vultr VPS |
| コンテナ | Docker Compose |
| CI/CD | GitHub Actions（`main` ブランチへの push で自動デプロイ） |
| 言語 | TypeScript (Node.js 20) |

## クイックスタート

### ローカル開発

```bash
git clone https://github.com/<your-org>/mltg-mint-announce.git
cd mltg-mint-announce
npm install
cp .env.example .env  # 環境変数を設定
npm run dev
```

### ビルド & 実行

```bash
npm run build
npm start
```

---

## Vultr + GitHub Actions デプロイ手順

`main` ブランチに push すると、GitHub Actions が自動的に Vultr サーバーへ Docker Compose でデプロイします。

### 前提条件

- Vultr VPS が稼働中（Docker / Docker Compose インストール済み）
- SSH でサーバーにログインできる状態

### 1. SSH 鍵の設定

GitHub Actions からサーバーに SSH 接続するための鍵ペアが必要です。

**詳細な手順は [docs/ssh-setup-guide.md](./docs/ssh-setup-guide.md) を参照してください。**

概要:

```powershell
# 1. ローカル PC で鍵を作成（PowerShell）
ssh-keygen -t ed25519 -f $HOME\.ssh\github_actions_key -N '""'

# 2. 公開鍵をサーバーに登録
cat $HOME\.ssh\github_actions_key.pub
# → 出力をサーバーの ~/.ssh/authorized_keys に追記

# 3. 秘密鍵を GitHub Secrets に登録
cat $HOME\.ssh\github_actions_key
# → 出力全文を SSH_PRIVATE_KEY に登録
```

### 2. GitHub Secrets の登録

リポジトリの `Settings` > `Secrets and variables` > `Actions` で以下を登録:

| Secret 名 | 内容 | 必須 |
|---|---|---|
| `SSH_HOST` | Vultr サーバーの IP アドレス | 必須 |
| `SSH_USER` | SSH ログインユーザー名（例: `root`） | 必須 |
| `SSH_PRIVATE_KEY` | 秘密鍵の全文（`-----BEGIN ... -----` から `-----END ... -----` まで） | 必須 |
| `CONTRACT_ADDRESS` | NFT コントラクトアドレス | 必須 |
| `POLYGON_RPC_URL` | Polygon RPC エンドポイント | 必須 |
| `GAS_WEBHOOK_URL` | GAS Web アプリの URL | 必須 |
| `START_BLOCK` | 監視開始ブロック番号 | 任意 |
| `POLL_INTERVAL` | ポーリング間隔（ミリ秒） | 任意 |

### 3. デプロイの実行

```bash
git add .
git commit -m "deploy"
git push origin main
```

GitHub の `Actions` タブでデプロイ状況を確認できます。

### 4. デプロイ後の確認

サーバーに SSH でログインして確認:

```bash
docker ps                          # コンテナが起動しているか
docker compose logs -f --tail=100  # ログを確認
```

---

## サーバー側の初期セットアップ（初回のみ）

### Docker のインストール

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Docker Compose（Docker に組み込み済みの場合は不要）
docker compose version
```

### SSH 鍵の受け入れ設定

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# 公開鍵を登録（ローカル PC で cat した内容をペースト）
echo "ssh-ed25519 AAAA..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Firewall の確認

```bash
# SSH（22番ポート）が開いていることを確認
ufw status
ufw allow 22/tcp
```

---

## 設定オプション

### START_BLOCK

監視を開始するブロック番号。指定しない場合は現在のブロックから監視を開始します。

```bash
START_BLOCK=50000000
```

### POLL_INTERVAL

ポーリング間隔（ミリ秒）。デフォルトは 30 分（43200000ms）。

```bash
POLL_INTERVAL=43200000  # 30分（デフォルト）
POLL_INTERVAL=3600000   # 1時間
POLL_INTERVAL=300000    # 5分
```

> ポーリング間隔を短くすると RPC 呼び出しが増え、レート制限に引っかかる可能性があります。

### Polygon RPC エンドポイント

- **パブリック RPC**: `https://polygon-rpc.com`（無料、制限あり）
- **Alchemy**: https://www.alchemy.com/（無料プランあり）
- **Infura**: https://www.infura.io/（無料プランあり）
- **QuickNode**: https://www.quicknode.com/（無料プランあり）

---

## GAS（Google Apps Script）の設定

GAS 側で Web アプリを作成し、POST リクエストを受け取ってメールを送信します。

### GAS サンプルコード

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.test) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Test successful'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const subject = `新しいNFTがクレームされました - Token ID: ${data.tokenId}`;
    const body = `
MetaGriLabo Thanks Gift Farming 2025 NFTが新たにクレームされました。

詳細情報:
- Token ID: ${data.tokenId}
- 受取アドレス: ${data.toAddress}
- ブロック番号: ${data.blockNumber}
- タイムスタンプ: ${data.timestamp}

リンク:
- OpenSea: ${data.openseaUrl}
- PolygonScan: ${data.polygonscanUrl}
    `;

    const recipient = 'your-email@example.com';
    MailApp.sendEmail(recipient, subject, body);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      tokenId: data.tokenId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### GAS のデプロイ手順

1. Google Apps Script で新しいプロジェクトを作成
2. 上記のコードを貼り付け
3. `your-email@example.com` を実際の送信先メールアドレスに変更
4. 「デプロイ」>「新しいデプロイ」を選択
5. 種類：「ウェブアプリ」を選択
6. アクセス権限：「全員」を選択
7. デプロイして、表示される URL を `GAS_WEBHOOK_URL` に設定

---

## トラブルシューティング

### GitHub Actions デプロイ関連

| エラー | 原因 | 対処 |
|---|---|---|
| `Permission denied (publickey)` | サーバーに公開鍵が未登録 / 鍵ペアの不一致 | [SSH 設定ガイド](./docs/ssh-setup-guide.md)を参照 |
| `SSH_PRIVATE_KEY format was not recognized` | 秘密鍵のフォーマットが不正 | [VULTR_DEPLOYMENT.md](./VULTR_DEPLOYMENT.md) セクション 7.5 参照 |
| `Load key: invalid format` | 公開鍵（`.pub`）を間違えて登録 | 拡張子なしの秘密鍵を登録 |
| `npm ci` でビルド失敗 | `package-lock.json` がリポジトリにない | `npm install` して `package-lock.json` をコミット |

### アプリケーション関連

| 症状 | 対処 |
|---|---|
| RPC 接続エラー | Alchemy / Infura 等の有料プランを検討。`POLL_INTERVAL` を長くする |
| GAS Webhook エラー | GAS のアクセス権限が「全員」になっているか確認 |
| Mint が検出されない | `START_BLOCK` が新しすぎないか、コントラクトアドレスが正しいか確認 |

---

## ドキュメント一覧

| ドキュメント | 内容 |
|---|---|
| [docs/ssh-setup-guide.md](./docs/ssh-setup-guide.md) | SSH 鍵の設定手順（初心者向け） |
| [VULTR_DEPLOYMENT.md](./VULTR_DEPLOYMENT.md) | Vultr デプロイ詳細手順・トラブルシューティング |
| [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) | AWS デプロイ手順（Lightsail / EC2 / Lambda） |

## ライセンス

MIT
