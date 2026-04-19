# ramen-shop-finder

以 **Excel 作為資料後台**、以 **GitHub 作為更新入口** 的台灣拉麵店分類地圖。  
沿用 [`ramen-style-finder`](https://github.com/AnsonHui6040/ramen-style-finder) 的 16 個類型分類，把各地區拉麵店整理成可搜尋、可篩選、可地圖顯示的資料站。

## 功能概覽

- 互動地圖（Leaflet.js + OpenStreetMap），點擊圖標顯示店家資訊
- 多條件篩選：市、地區、商圈／路段、類型、最低評分
- 地區選擇連動商圈：切換地區時自動重設商圈選單
- 依評分或評論數排序
- 手機版：地圖置頂，地圖下方顯示緊湊篩選列與可收合的店家詳細面板
- 本機開發伺服器自動印出區域網絡 IP，方便手機即時測試

## 目前狀態

- 支援 **台中**（含 31 間範例店舖，分布 15 個行政區）
- 每個市一個 Excel，放在 `data/excel/`
- GitHub Actions 在 Excel 更新後自動重建 `docs/data/*.json`
- 前端為純靜態頁面，可直接部署至 GitHub Pages

## 專案結構

```text
ramen-shop-finder/
├─ data/
│  ├─ excel/
│  │  └─ taichung-template-v3.xlsx
│  └─ style/
│     └─ type-profiles.json
├─ scripts/
│  ├─ build-data.mjs       # Excel → JSON 轉換
│  └─ dev-server.mjs       # 本機靜態預覽伺服器
├─ docs/
│  ├─ index.html
│  ├─ app.js
│  ├─ style.css
│  └─ data/
│     ├─ meta.json
│     ├─ taichung.json
│     └─ type-profiles.json
└─ .github/
   └─ workflows/
      └─ build-data.yml
```

## Excel 工作表規格

每個市的 Excel 包含以下工作表：

### `shops_main`
正式資料表，只輸出 `status = published` 的列。

| 欄位 | 說明 |
|---|---|
| `shop_id` | 唯一 ID，例如 `tcg-xitun-0001` |
| `status` | `draft` / `published` / `hidden` |
| `source_type` | `ai_import` / `manual` / `mixed` |
| `region` | 市，例如 `台中` |
| `district` | 地區，例如 `西屯區` |
| `area_tag` | 商圈 / 路段，例如 `逢甲夜市` |
| `name_zh` | 中文店名 |
| `name_original` | 原文店名 |
| `style_code` | 類型代碼，例如 `RWHT` |
| `style_4char` | 類型名稱，例如 `濃白重口型` |
| `style_confidence` | 分類信心值 0–100 |
| `rating` | 評分 |
| `rating_count` | 評論數 |
| `address` | 完整地址 |
| `lat` / `lng` | 座標 |
| `open_hours` | 營業時間 |
| `phone` | 電話 |
| `website` | 官網 |
| `map_url` | Google Maps 連結 |
| `notes` | 備註 |
| `last_verified` | 最後人工確認日期 |

### `shops_manual_add`
人工新增與待審資料，欄位同上，另加 `review_flag`、`editor_note`。  
只有 `review_flag = approved` 且 `status = published` 的列才會上線。

### `shops_ai_raw`
AI 匯入原始資料暫存區，不直接上線。

### `meta`
地區設定，包含 `region_code`、`region_name`、預設地圖中心座標與縮放層級。

## 本機開發

```bash
npm install
npm run dev        # 自動 build:data 後啟動預覽伺服器
```

啟動後輸出：

```
Preview server running at http://127.0.0.1:5173
Network access:         http://<區域網絡 IP>:5173
```

手動重建資料：

```bash
npm run build:data
```

## GitHub Actions

監聽以下檔案變更時自動重建：

- `data/excel/*.xlsx`
- `scripts/build-data.mjs`

產出：`docs/data/<region>.json`、`docs/data/meta.json`

## 類型分類

16 個類型代碼來自 `data/style/type-profiles.json`，依四軸（濃淡、湯底、衝擊感、麵體）劃分：

| 家族 | 代碼 |
|------|------|
| 清亮系 | CKLF / CKLT / CKHF / CKHT |
| 白湯系 | CWLF / CWLT / CWHF / CWHT |
| 厚湯系 | RKLF / RKLT / RKHF / RKHT |
| 濃白系 | RWLF / RWLT / RWHF / RWHT |
