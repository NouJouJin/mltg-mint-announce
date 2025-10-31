# AWS Deployment Guide

このガイドでは、NFTミント通知システムをAWSにデプロイする方法を説明します。

## コスト最適化について

このシステムはコスト最適化版として設定されています：

- **デフォルトポーリング間隔**: 30分（1,440回/月）
- **推奨環境**: AWS Lightsail $3.50/月プラン
- **月間想定コスト**: $3.50〜$5

### ポーリング間隔とコストの関係

| 間隔 | 月間チェック回数 | 推奨用途 |
|------|-----------------|---------|
| 15秒 | 172,800回 | 高頻度ミント、リアルタイム通知が必要 |
| 1分 | 43,200回 | 中頻度ミント |
| 15分 | 2,880回 | 低頻度ミント |
| **30分** | **1,440回** | **1日1回未満のミント（推奨）** |
| 1時間 | 720回 | 1週間に数回のミント |

## Option 1: AWS Lightsail（推奨・最も簡単）

### コスト: $3.50/月〜

最もシンプルで固定料金。初心者におすすめです。

### 手順

#### 1. Lightsailインスタンスの作成

```bash
# AWS Lightsailコンソールから:
- OS: Ubuntu 22.04 LTS
- プラン: $3.50/月 (512MB RAM, 1 vCPU)
- インスタンス名: nft-mint-monitor
```

#### 2. SSH接続とセットアップ

```bash
# Lightsailコンソールから「Connect using SSH」をクリック

# Node.js 20のインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Gitのインストール
sudo apt-get update
sudo apt-get install -y git

# プロジェクトのクローン
git clone https://github.com/YOUR_USERNAME/mltg-mint-announce.git
cd mltg-mint-announce
```

#### 3. 環境設定

```bash
# 環境変数ファイルの作成
cp .env.example .env
nano .env

# 以下を設定:
# CONTRACT_ADDRESS=0x30961b851a8a766014e53955694b3210718066e5
# POLYGON_RPC_URL=https://polygon-rpc.com
# GAS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR-DEPLOYMENT-ID/exec
# START_BLOCK=78000000  ← 監視開始ブロック（重要！）
# POLL_INTERVAL=1800000  ← 30分間隔（デフォルト）
```

**重要**: `START_BLOCK`を設定しないと、現在のブロックから監視を開始するため、過去のミントを見逃します。

#### 4. ビルドと起動

```bash
# 依存パッケージのインストール
npm install

# TypeScriptのビルド
npm run build

# 動作確認
npm start

# 正常に起動したら Ctrl+C で停止
```

#### 5. PM2で永続化（推奨）

```bash
# PM2のインストール
sudo npm install -g pm2

# アプリケーションの起動
pm2 start npm --name "nft-monitor" -- start

# 起動確認
pm2 status
pm2 logs nft-monitor

# システム起動時に自動起動
pm2 startup
pm2 save
```

#### 6. ログの確認

```bash
# リアルタイムログ表示
pm2 logs nft-monitor

# ログファイルの場所
~/.pm2/logs/nft-monitor-out.log
~/.pm2/logs/nft-monitor-error.log
```

### メンテナンス

```bash
# アプリケーションの更新
cd mltg-mint-announce
git pull
npm install
npm run build
pm2 restart nft-monitor

# 停止
pm2 stop nft-monitor

# 削除
pm2 delete nft-monitor
```

---

## Option 2: AWS EC2（より細かい設定が可能）

### コスト: $5〜$10/月（t3.micro/t4g.nano使用時）

EC2を使う場合も、手順はLightsailとほぼ同じです。

### 追加設定

```bash
# セキュリティグループ
- インバウンドルール: SSH (22) のみ必要
- アウトバウンドルール: HTTPS (443) を許可（RPC通信用）

# Elastic IPの設定（オプション）
# 固定IPが必要な場合は、Elastic IPを割り当て
```

---

## Option 3: AWS Lambda + EventBridge（最もコスト効率が良い）

### コスト: $0.05〜$0.50/月（ほぼ無料）

より高度ですが、コストを最小限に抑えられます。

### 必要な変更点

Lambda対応には以下の追加実装が必要です：

1. Lambda用ハンドラー関数の作成
2. DynamoDBでブロック番号の永続化
3. AWS SAM or Serverless Frameworkでのデプロイ

Lambdaへの移行を希望される場合は、別途対応可能です。

---

## トラブルシューティング

### ミントが検出されない

```bash
# デバッグスクリプトで確認
npx ts-node src/debug.ts

# 特定のトランザクションを確認
npx ts-node src/debug.ts --tx 0xTRANSACTION_HASH

# START_BLOCKが正しく設定されているか確認
# .envファイルのSTART_BLOCKを、最初のミントが発生したブロックより前に設定
```

### RPC エラーが発生する

```bash
# AlchemyやInfuraの無料プランを使用することを推奨
# 公共RPCはレート制限が厳しい場合があります

# .envファイルで変更:
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY
```

### メモリ不足

```bash
# Lightsail $3.50プラン（512MB）で動作確認済み
# それでも不足する場合は、$5プラン（1GB）にアップグレード
```

---

## ポーリング間隔のカスタマイズ

ミント頻度に応じて、`.env`ファイルで調整可能です：

```bash
# 1時間間隔（最もコスト効率が良い）
POLL_INTERVAL=3600000

# 30分間隔（推奨・デフォルト）
POLL_INTERVAL=1800000

# 15分間隔
POLL_INTERVAL=900000

# 5分間隔
POLL_INTERVAL=300000

# 1分間隔
POLL_INTERVAL=60000
```

---

## まとめ

- **初心者・シンプル重視**: Lightsail ($3.50/月)
- **細かい設定が必要**: EC2 ($5〜$10/月)
- **最小コスト重視**: Lambda + EventBridge ($0.05〜$0.50/月)

1日1回未満のミント頻度なら、**Lightsail $3.50プラン + 30分間隔**が最もバランスが良い選択です。
