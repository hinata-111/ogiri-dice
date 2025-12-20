# Role
あなたは経験豊富なUnityゲーム開発者（C#エンジニア）です。
現在、「大喜利すごろくゲーム」を開発しており、バックエンドにはGoogleの **Gemini API (Free Tier)** を使用します。

# Project Goal
ユーザーが入力したテキスト（大喜利の回答）をGemini API (`gemini-1.5-flash`) に送信し、その面白さを「1〜6の整数」で評価させ、JSON形式で結果を受け取るシステムを構築したいです。

# Requirements
以下の要件を満たすC#スクリプトを作成してください。

1. **GeminiAPIManager.cs**
   - Google Generative AI APIのエンドポイントにPOSTリクエストを送るクラス。
   - モデル: `gemini-1.5-flash`
   - エンドポイントURL例: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}`
   - `UnityWebRequest` を使用し、`async/await` パターンで実装してください。
   - APIキーはInspectorで設定可能にしてください。

2. **Request Structure (重要)**
   - Gemini APIのリクエストボディは以下の構造に従う必要があります。
     ```json
     {
       "contents": [{
         "parts": [{ "text": "ここにプロンプトとユーザー入力が入る" }]
       }],
       "generationConfig": {
         "responseMimeType": "application/json"
       }
     }
     ```
   - `responseMimeType: "application/json"` を指定して、確実にJSONが返ってくるようにしてください。

3. **OgiriEvaluator.cs**
   - システムプロンプトを構築するクラス。
   - **System Prompt:**
     "あなたは辛口の放送作家です。提供された【お題】に対する【回答】を評価し、以下のJSONスキーマのみを返してください。マークダウン記法は不要です。
     { \"score\": 1~6の整数, \"comment\": \"短いツッコミ\" }"
   - レスポンスのパース処理（`Newtonsoft.Json` 推奨。もしなければ `JsonUtility` 用のラッパークラスを作成）。

4. **GameManager.cs (テスト用)**
   - Inspector上で「お題」と「回答」を入力し、実行ボタンを押すとログに評価が出る簡易テスト機能。

# Implementation Note
- Geminiのレスポンスは `candidates[0].content.parts[0].text` という深い階層にあるため、適切にパースしてください。
- エラーハンドリング（APIキー無効、ネットワークエラー等）を含めてください。