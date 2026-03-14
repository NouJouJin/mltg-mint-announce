# 初心者向け：GitHub Actions 用 SSH 鍵の正しい設定手順

GitHub Actions からサーバーに自動デプロイ（接続）するためには、**「鍵と南京錠」** の仕組みを使います。

- **公開鍵 (Public Key):** サーバーに取り付ける「南京錠」。（`.pub` がつくファイル）
- **秘密鍵 (Private Key):** GitHub に持たせる「マスターキー」。（拡張子がないファイル）

この2つが **絶対に同じペア** であることが成功の絶対条件です。

---

## ステップ 1：自分の PC で新しい「鍵のペア」を作る

Windows の「PowerShell」を開いて、以下のコマンドをコピーして実行します。

```powershell
# GitHub Actions専用の新しい鍵を作成（パスワードなし）
ssh-keygen -t ed25519 -f $HOME\.ssh\github_actions_key -N '""'
```

> **注意:** `-N '""'` はパスフレーズを「空」にする指定です。
> GitHub Actions では無人で実行するため、パスフレーズは **設定しないでください。**

### 確認

`C:\Users\あなたの名前\.ssh\` フォルダに以下の2つのファイルが作成されます。

| ファイル名 | 種類 | 登録先 |
|---|---|---|
| `github_actions_key.pub` | 公開鍵（南京錠） | サーバー |
| `github_actions_key` | 秘密鍵（マスターキー） | GitHub |

---

## ステップ 2：サーバーに「公開鍵（南京錠）」を登録する

### 2-1. 自分の PC で公開鍵の中身をコピーする

PowerShell で以下を実行して、表示された文字を **すべてコピー** します。

```powershell
cat $HOME\.ssh\github_actions_key.pub
```

> `ssh-ed25519 AAAA...` から始まる **1行の長い文字列** が表示されます。

### 2-2. サーバーにログインして登録する

サーバー（Vultr のコンソールなど）を開き、以下のコマンドを **1行ずつ** 実行します。

```bash
# 1. 鍵を入れるフォルダを作る（既にある場合も安全に実行できます）
mkdir -p ~/.ssh

# 2. 公開鍵を登録する（※ " " の中に、さっきコピーした文字列を貼り付けてください！）
echo "ssh-ed25519 AAAAC3NzaC...（あなたの公開鍵をここにペースト）" >> ~/.ssh/authorized_keys

# 3. セキュリティ権限を厳しくする（※これを忘れると絶対に接続できません！）
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

> **なぜ権限設定が必要？**
> SSH は「他の人が読めるようになっている鍵ファイル」を **危険と判断して拒否** します。
> `chmod 700` / `chmod 600` を忘れると `Permission denied` エラーになります。

---

## ステップ 3：GitHub に「秘密鍵（マスターキー）」を登録する

### 3-1. 自分の PC で秘密鍵の中身をコピーする

PowerShell で以下を実行して、表示された文字を **すべてコピー** します。

```powershell
cat $HOME\.ssh\github_actions_key
```

**絶対に注意すること:**

一番上の `-----BEGIN OPENSSH PRIVATE KEY-----` から、
一番下の `-----END OPENSSH PRIVATE KEY-----` まで、**1文字も漏らさずコピー** してください。

### 3-2. GitHub の画面で登録する

1. ブラウザで GitHub の自分のリポジトリ（プロジェクト）を開く
2. 上部の **`Settings`** タブをクリック
3. 左メニューの **`Secrets and variables`** > **`Actions`** をクリック
4. 緑色の **`New repository secret`** ボタンを押す
5. **Name:** `SSH_PRIVATE_KEY`（ワークフローの記載に合わせる）
6. **Secret:** さっきコピーした秘密鍵をペーストする
7. **`Add secret`** を押して保存

> **同時に以下の Secret も必要です:**
>
> | Name | 値の例 | 説明 |
> |---|---|---|
> | `SSH_HOST` | `155.138.209.141` | サーバーの IP アドレス |
> | `SSH_USER` | `root` | SSH ログインユーザー名 |

---

## ステップ 4：サーバーの SSH 受け入れ設定を確認する

サーバーが ed25519 鍵を拒否しないように、以下の設定を確認しておくと安心です。

```bash
# 現在の設定を確認
grep -E "PubkeyAuthentication|PubkeyAcceptedKeyTypes" /etc/ssh/sshd_config
```

もし `PubkeyAuthentication no` になっていたら、以下で修正します。

```bash
# SSH設定ファイルを編集
vi /etc/ssh/sshd_config
```

以下の行が存在し、`yes` になっていることを確認してください。

```
PubkeyAuthentication yes
```

もし変更した場合は SSH を再起動します。

```bash
systemctl restart sshd
```

> **注意:** `sshd_config` の変更は慎重に行ってください。
> 設定ミスがあると SSH 接続自体ができなくなる可能性があります。
> 必ず **Vultr のコンソール（Web UI）からもログインできる状態** で作業してください。

---

## ステップ 5：接続テスト

すべての設定が完了したら、自分の PC から接続テストを行います。

```powershell
ssh -i $HOME\.ssh\github_actions_key -o IdentitiesOnly=yes root@155.138.209.141 "echo 接続成功！"
```

`接続成功！` と表示されれば OK です。
GitHub Actions でも同じ鍵で接続できます。

---

## よくある失敗ポイント（チェックリスト）

GitHub Actions で `Permission denied (publickey)` エラーが出たら、以下を確認してください。

| 症状 | 原因 | 対処法 |
|---|---|---|
| `Permission denied (publickey)` | 公開鍵がサーバーに未登録 / 鍵ペアの不一致 | ステップ 2 をやり直す |
| `Load key: invalid format` | GitHub Secret に公開鍵（`.pub`）を間違えて登録 | ステップ 3 で **拡張子なし** のファイルを登録 |
| `Permission denied` + 権限エラー | サーバーの `chmod` を忘れた | `chmod 700 ~/.ssh` と `chmod 600 ~/.ssh/authorized_keys` を実行 |
| `Host key verification failed` | `ssh-keyscan` に失敗 | `SSH_HOST` Secret の IP アドレスが正しいか確認 |
| `npm ci` でビルドが失敗 | `package-lock.json` がリポジトリにない | `npm install` して `package-lock.json` をコミット |

---

## 鍵を作り直したいとき

設定がわからなくなったら、**ステップ 1 から新しい鍵を作り直す** のが一番の近道です。

```powershell
# 古い鍵を削除
Remove-Item $HOME\.ssh\github_actions_key*

# 新しい鍵を作成（ステップ 1 と同じ）
ssh-keygen -t ed25519 -f $HOME\.ssh\github_actions_key -N '""'
```

その後、ステップ 2（サーバー）と ステップ 3（GitHub）を **両方やり直してください。**
片方だけ更新すると「鍵と南京錠が合わない」状態になり、`Permission denied` が再発します。
