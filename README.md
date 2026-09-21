# SILVER GARAGE ADVENT · STREETFIGHTERS

銀の膜をコインで削り、息を吹きかけてカスを払い、現れた一台をコレクションする。毎日一枚ずつ楽しむ、架空のSTREETFIGHTERSのスクラッチカードです。

全31枚。少しだけ削っても、「コレクションにしまう」と残りの銀が自然に剥がれます。写真は事前にAIで生成しており、遊ぶときにAIやAPIキーは必要ありません。

[OPEN APP](https://masato-nasu.github.io/SILVER-GARAGE-ADVENT-STREETFIGHTERS/)

![STREETFIGHTERS](assets/streetfighter/day-01.webp)

## 遊び方

1. コインをドラッグして銀の膜を削ります。
2. マイクの使用を許可し、息を吹きかけて削りカスを払います。
3. 「コレクションにしまう」で保存します。
4. 翌日、新しいカードが登場します。

初めて開いた日から31枚を順番に表示し、32日目から繰り返します。保存先は利用中のブラウザです。別端末への同期はありません。

## 動作

HTML / CSS / JavaScriptのみ。ビルド不要。マイクにはHTTPSまたはlocalhostが必要です。音声は端末内で音量・周波数を解析し、録音・送信しません。ブラウザのデータを消すとコレクションも消えます。既存のChatGPT公開版から収集データは自動移行されません。

## ローカル起動

```sh
python3 -m http.server 8080
```

http://localhost:8080 を開きます。

## 制作

Masato Nasu / MASATO LAB。車両画像はAIで生成した架空のデザインです。
