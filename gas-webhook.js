/**
 * Google Apps Script - NFT Mint Notification Webhook
 *
 * このスクリプトをGoogle Apps Scriptにコピーして使用してください。
 *
 * デプロイ手順:
 * 1. Google Apps Scriptで新しいプロジェクトを作成
 * 2. このコードを貼り付け
 * 3. RECIPIENT_EMAIL を実際の送信先メールアドレスに変更
 * 4. 「デプロイ」→「新しいデプロイ」を選択
 * 5. 種類：「ウェブアプリ」を選択
 * 6. 「次のユーザーとして実行」: 自分
 * 7. 「アクセスできるユーザー」: 全員
 * 8. デプロイして、表示されるURLをコピー
 * 9. URLを.envファイルのGAS_WEBHOOK_URLに設定
 */

// メール送信先アドレス（複数指定も可能）
const RECIPIENT_EMAIL = 'your-email@example.com';

// 複数のメールアドレスに送信する場合はカンマ区切りで指定
// const RECIPIENT_EMAIL = 'email1@example.com,email2@example.com';

/**
 * POSTリクエストを受け取る関数
 */
function doPost(e) {
  try {
    // リクエストボディをパース
    const data = JSON.parse(e.postData.contents);

    // ログに記録
    Logger.log('Received data: ' + JSON.stringify(data));

    // テストリクエストの場合
    if (data.test) {
      Logger.log('Test request received');
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Test successful'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // メール送信
    sendMintNotification(data);

    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      tokenId: data.tokenId,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error: ' + error.toString());

    // エラーレスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエストを受け取る関数（動作確認用）
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'running',
    message: 'NFT Mint Notification Webhook is active',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Mintイベントの通知メールを送信
 */
function sendMintNotification(data) {
  // メール件名
  const subject = `🎁 新しいNFTがクレームされました - Token ID: ${data.tokenId}`;

  // メール本文（HTMLバージョン）
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50;">🎁 NFT Mint 通知</h2>
        <p><strong>MetaGriLabo Thanks Gift Farming 2025</strong> NFTが新たにクレームされました。</p>

        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2196F3;">📋 詳細情報</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0; font-weight: bold;">Token ID:</td>
              <td style="padding: 5px 0;">${data.tokenId}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: bold;">受取アドレス:</td>
              <td style="padding: 5px 0; font-family: monospace; font-size: 0.9em;">${data.toAddress}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: bold;">ブロック番号:</td>
              <td style="padding: 5px 0;">${data.blockNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: bold;">タイムスタンプ:</td>
              <td style="padding: 5px 0;">${formatTimestamp(data.timestamp)}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #2196F3;">🔗 リンク</h3>
          <p>
            <a href="${data.openseaUrl}" style="display: inline-block; padding: 10px 15px; background-color: #2081E2; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
              OpenSeaで見る
            </a>
            <a href="${data.polygonscanUrl}" style="display: inline-block; padding: 10px 15px; background-color: #8247E5; color: white; text-decoration: none; border-radius: 5px;">
              PolygonScanで見る
            </a>
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #777; font-size: 0.9em;">
          このメールは自動送信されています。<br>
          NFT Mint Notification System - MetaGriLabo Thanks Gift Farming 2025
        </p>
      </body>
    </html>
  `;

  // メール本文（プレーンテキストバージョン）
  const plainBody = `
MetaGriLabo Thanks Gift Farming 2025 NFTが新たにクレームされました。

📋 詳細情報:
- Token ID: ${data.tokenId}
- 受取アドレス: ${data.toAddress}
- ブロック番号: ${data.blockNumber}
- タイムスタンプ: ${formatTimestamp(data.timestamp)}

🔗 リンク:
- OpenSea: ${data.openseaUrl}
- PolygonScan: ${data.polygonscanUrl}

--------------------------------------
このメールは自動送信されています。
NFT Mint Notification System - MetaGriLabo Thanks Gift Farming 2025
  `;

  // メール送信
  MailApp.sendEmail({
    to: RECIPIENT_EMAIL,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody
  });

  Logger.log('Email sent successfully to: ' + RECIPIENT_EMAIL);
}

/**
 * タイムスタンプをフォーマット
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // JST = UTC+9

  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} JST`;
}

/**
 * テスト実行用の関数
 * スクリプトエディタで実行して動作確認できます
 */
function testNotification() {
  const testData = {
    tokenId: '12345',
    toAddress: '0x1234567890123456789012345678901234567890',
    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    blockNumber: 50000000,
    timestamp: new Date().toISOString(),
    openseaUrl: 'https://opensea.io/assets/matic/0x30961b851a8a766014e53955694b3210718066e5/12345',
    polygonscanUrl: 'https://polygonscan.com/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  };

  sendMintNotification(testData);
  Logger.log('Test notification sent!');
}
