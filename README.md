# NFT Mint Notification System

NFTが新たにクレーム（Mint）された際にメール通知を送信するシステムです。

## 対象NFT

- **コレクション**: MetaGriLabo Thanks Gift Farming 2025
- **コントラクトアドレス**: `0x30961b851a8a766014e53955694b3210718066e5`
- **ネットワーク**: Polygon (Matic)
- **OpenSea**: https://opensea.io/collection/metagrilabo-thanks-gift-farming-2025
- **PolygonScan**: https://polygonscan.com/address/0x30961b851a8a766014e53955694b3210718066e5

## システム概要

このシステムは以下の機能を提供します：

1. **Polygonブロックチェーンの監視**: 定期的にブロックチェーンをポーリングして新しいTransferイベントを検出
2. **新規Mintの判定**: `from`アドレスが`0x0000...0000`（ゼロアドレス）のTransferイベントのみを対象
3. **Google Apps Script (GAS) への通知**: 検出したMintイベントをGASのWebアプリエンドポイントにPOST
4. **メール送信**: GAS側でメールを送信

## 必要な準備

### 1. Node.js環境

- Node.js 18以上が必要です

### 2. Google Apps Script (GAS) の設定

GAS側でWebアプリを作成し、POSTリクエストを受け取ってメールを送信する必要があります。

#### GASサンプルコード

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // テストリクエストの場合
    if (data.test) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Test successful'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // メール本文の作成
    const subject = `🎁 新しいNFTがクレームされました - Token ID: ${data.tokenId}`;
    const body = `
MetaGriLabo Thanks Gift Farming 2025 NFTが新たにクレームされました。

📋 詳細情報:
- Token ID: ${data.tokenId}
- 受取アドレス: ${data.toAddress}
- ブロック番号: ${data.blockNumber}
- タイムスタンプ: ${data.timestamp}

🔗 リンク:
- OpenSea: ${data.openseaUrl}
- PolygonScan: ${data.polygonscanUrl}

このメールは自動送信されています。
    `;

    // メール送信（送信先アドレスを設定してください）
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

#### GASのデプロイ手順

1. Google Apps Scriptで新しいプロジェクトを作成
2. 上記のコードを貼り付け
3. `your-email@example.com`を実際の送信先メールアドレスに変更
4. 「デプロイ」→「新しいデプロイ」を選択
5. 種類：「ウェブアプリ」を選択
6. アクセス権限：「全員」を選択（または制限を設定）
7. デプロイして、表示されるURLをコピー

### 3. Polygon RPC エンドポイント

以下のいずれかを使用できます：

- **パブリックRPC**: `https://polygon-rpc.com` (無料、制限あり)
- **Alchemy**: https://www.alchemy.com/ (無料プランあり)
- **Infura**: https://www.infura.io/ (無料プランあり)
- **QuickNode**: https://www.quicknode.com/ (無料プランあり)

## インストール手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd mltg-mint-announce
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`をコピーして`.env`を作成：

```bash
cp .env.example .env
```

`.env`ファイルを編集して必要な情報を設定：

```bash
CONTRACT_ADDRESS=0x30961b851a8a766014e53955694b3210718066e5
POLYGON_RPC_URL=https://polygon-rpc.com
GAS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR-DEPLOYMENT-ID/exec
```

### 4. ビルド

```bash
npm run build
```

## 実行方法

### ローカルでの開発実行

```bash
npm run dev
```

### プロダクション実行

```bash
npm start
```

## Vultrへのデプロイ

### 1. Vultrインスタンスの準備

1. Vultrでインスタンスを作成（Ubuntu 22.04推奨）
2. SSHでログイン
3. Node.jsとPM2をインストール：

```bash
# Node.jsのインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2のインストール
sudo npm install -g pm2
```

### 2. プロジェクトのデプロイ

```bash
# プロジェクトをクローン
git clone <repository-url>
cd mltg-mint-announce

# 依存関係のインストール
npm install

# ビルド
npm run build

# 環境変数の設定
cp .env.example .env
nano .env  # 必要な情報を入力
```

### 3. PM2での起動

```bash
# PM2で起動
pm2 start ecosystem.config.js

# 起動確認
pm2 status

# ログ確認
pm2 logs mltg-mint-announce

# システム起動時に自動起動
pm2 startup
pm2 save
```

### PM2の基本コマンド

```bash
# 停止
pm2 stop mltg-mint-announce

# 再起動
pm2 restart mltg-mint-announce

# 削除
pm2 delete mltg-mint-announce

# ログ表示
pm2 logs mltg-mint-announce

# モニター
pm2 monit
```

## 設定オプション

### START_BLOCK

監視を開始するブロック番号を指定できます。指定しない場合は現在のブロックから監視を開始します。

過去のMintイベントも検出したい場合は、過去のブロック番号を指定してください。

```bash
START_BLOCK=50000000
```

### POLL_INTERVAL

ブロックチェーンをポーリングする間隔（ミリ秒）を設定できます。デフォルトは15秒です。

Polygonのブロック時間は約2秒ですが、あまり頻繁にポーリングするとRPCプロバイダーのレート制限に引っかかる可能性があります。

```bash
POLL_INTERVAL=15000  # 15秒
```

## トラブルシューティング

### RPCエンドポイントの接続エラー

- パブリックRPCは制限があるため、AlchemyやInfuraなどの有料プランを検討
- `POLL_INTERVAL`を長くして負荷を減らす

### GAS Webhookのエラー

- GASのデプロイ設定で「全員」にアクセス権限が付与されているか確認
- GASのスクリプトにエラーがないか確認
- GASの実行ログを確認

### Mintイベントが検出されない

- `START_BLOCK`が新しすぎないか確認
- コントラクトアドレスが正しいか確認
- PolygonScanで実際にMintイベントが発生しているか確認

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHubのIssuesでお知らせください。
