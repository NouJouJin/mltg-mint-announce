# Vultrへのデプロイ手順（Docker Compose + GitHub Actions）

このドキュメントは、`mltg-mint-announce` を Vultr サーバーへ安全に追加デプロイするための手順です。
既存アプリに影響を出さないよう、ディレクトリ・ポート・Compose プロジェクト名を分離します。

## 0. 事前に決めること

- 新しいアプリ名（例: `my-second-bot`）
- サーバー上の配置先ディレクトリ（例: `/opt/apps/my-second-bot`）
- 使うポート（例: `3002`）
- ドメインを使う場合のサブドメイン（例: `bot2.example.com`）

> ポート番号は既存アプリと重複させないことが重要です。

## 1. VultrサーバーへSSH接続

```bash
ssh <SSH_USER>@<SSH_HOST>
```

## 1.5 Vultr側で事前に必要な設定（初回のみ）

### 1) Docker / Compose のインストール確認

```bash
docker --version
docker compose version
```

### 2) デプロイ用ユーザーの権限確認（Docker実行権限）

```bash
groups <SSH_USER>
```

- `docker` グループに入っていない場合は追加して再ログイン

### 3) SSH鍵の設定確認（GitHub Actionsから接続する鍵）

- サーバー側: `~/.ssh/authorized_keys`
- GitHub側: `SSH_PRIVATE_KEY` Secret

### 4) Firewall / UFW のポート開放確認

- Web 公開する場合は `80/443` を許可
- アプリが待受ポートを使う場合は対象ポートも許可

### 5) 時刻・タイムゾーン確認（cron運用のズレ防止）

```bash
timedatectl
```

## 2. アプリ用ディレクトリを作成してクローン

```bash
sudo mkdir -p /opt/apps/mltg-mint-announce
sudo chown -R $USER:$USER /opt/apps/mltg-mint-announce
cd /opt/apps/mltg-mint-announce
git clone https://github.com/<your-org>/mltg-mint-announce.git .
```

## 3. `.env` を作成（機密情報を設定）

```bash
cp .env.sample .env
nano .env
```

- APIキーやTokenはGitHubにコミットしない
- 既存Botと同じ値を使う場合でも、1つずつ確認

## 4. Docker Composeで起動

```bash
docker compose pull
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100
```

- `Up` なら起動成功
- エラー時は `.env` の不足、ポート重複、APIキー設定ミスを優先確認

## 5. GitHub Actionsで自動デプロイを有効化

### 1) Secrets を登録

GitHub リポジトリの `Settings` → `Secrets and variables` → `Actions` で次を登録:

- 共通: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
- アプリ固有: `.env` で使う全変数
  - `CONTRACT_ADDRESS`
  - `POLYGON_RPC_URL`
  - `GAS_WEBHOOK_URL`
  - `START_BLOCK`（任意、未使用なら空でも可）
  - `POLL_INTERVAL`（任意、未使用なら空でも可）

### 2) `.github/workflows/deploy.yml` の確認ポイント

- トリガーブランチ: `main`
- SSH接続先Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
- `.env` 生成行と Secrets のキー名を一致させる
- `COMPOSE_PROJECT_NAME` をアプリごとに分ける（コンテナ名衝突回避）

### 3) デプロイ確認

- `Actions` タブで `deploy.yml` の実行ログを確認
- 成功後にサーバーで `docker ps` / `docker compose ps` を確認

## 6. 既存運用に影響を出さない運用ルール

- 1アプリ1ディレクトリで分離（例: `/opt/apps/<repo-name>`）
- 1アプリ1 Composeプロジェクトで分離（`COMPOSE_PROJECT_NAME`）
- ログ確認コマンドを固定化

```bash
docker compose -f /opt/apps/<repo>/compose.yaml logs -f --tail=100
```

- 更新手順を統一

```bash
git pull
docker compose up -d --build
```


## 7. トラブルシューティング（`ssh-private-key is empty` エラー）

GitHub Actions の `Setup SSH key` ステップで次のような失敗が出る場合：

- `The ssh-private-key argument is empty`

原因はほぼ確実に、**`SSH_PRIVATE_KEY` Secret が未登録・空文字・名前違い**です。

### 7.1 まず確認すること（最優先）

1. GitHub リポジトリの `Settings` → `Secrets and variables` → `Actions` を開く
2. `Repository secrets` に **完全一致で `SSH_PRIVATE_KEY`** があるか確認
3. 値が空でないか確認（貼り付けミスで空保存されていないか）

> Secret 名は大文字小文字を区別します。`ssh_private_key` や `SSH-PRIVATE-KEY` は別名扱いです。

### 7.2 正しい秘密鍵の形式

`SSH_PRIVATE_KEY` には **秘密鍵そのもの全文**を入れます（改行を含む）。

例（Ed25519）:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

### 7.3 鍵ペアの作成と登録手順（未作成の場合）

ローカルPCで実行:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/id_ed25519_github_actions
```

公開鍵を Vultr サーバーへ登録:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519_github_actions.pub <SSH_USER>@<SSH_HOST>
```

`ssh-copy-id` が使えない場合は手動追記:

```bash
cat ~/.ssh/id_ed25519_github_actions.pub
# 出力をサーバーの ~/.ssh/authorized_keys に1行で追記
```

GitHub Secret に秘密鍵を登録:

```bash
cat ~/.ssh/id_ed25519_github_actions
# 出力全文を SSH_PRIVATE_KEY に貼り付けて保存
```

### 7.4 登録後の接続確認

ローカルPCで鍵指定して接続確認:

```bash
ssh -i ~/.ssh/id_ed25519_github_actions <SSH_USER>@<SSH_HOST>
```

この接続が成功してから Actions を再実行すると、失敗率を大幅に下げられます。

### 7.5 それでも失敗する場合の確認リスト

- `SSH_HOST` がIP/ホスト名として正しいか
- `SSH_USER` が実在ユーザーか
- サーバー側 `~/.ssh` 権限が適切か（例: `700`）、`authorized_keys` が `600` か
- Firewall/UFW で SSH（通常22番）が閉じていないか
- 鍵を再発行した場合、古い公開鍵が残っていないか

### 7.6 Secret 名を変更したい場合

ワークフロー側の参照名を Secret 名に合わせて変更します。

```yaml
ssh-private-key: ${{ secrets.YOUR_SECRET_NAME }}
```

ただし、運用を簡単にするため、基本は `SSH_PRIVATE_KEY` に統一することを推奨します。
