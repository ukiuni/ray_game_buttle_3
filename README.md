# LINE SLASH 一閃

線を引いて竜を斬る、1対1の3Dターン制バトル(WebGL / three.js)。Android・iPhone・iPad のブラウザ向け PWA。

- 自分のターン: 画面に線を引くと、勇者がその線の通りに駆け抜けて斬る。光る弱点を通るとクリティカル
- 敵のターン: 「！」が出たらタップでガード
- 竜の HP を 0 にすると勝ち、勇者の HP が 0 になると負け。勝つと次の竜との戦いが自動で始まり、負けるまで続く
- 勇者は 20000 ポリゴン、竜は 30000 ポリゴン(コードで生成。`npm run count` で検証)

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # ビルド + Playwright テスト(ローカルの Google Chrome を使用)
npm run icons   # PWA アイコンの再生成
```

## 公開

`main` ブランチに push すると GitHub Actions(`.github/workflows/deploy.yml`)が GitHub Pages に公開する。

## アップデート

起動時・10分ごと・アプリが前面に戻った時に新バージョンを確認する。新バージョンはバックグラウンドで取得され、
ゲーム中には適用されず、タイトル画面またはゲームオーバー画面でのみ適用(リロード)される。
