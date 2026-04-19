# ramen-shop-finder

以 **Excel 作為資料後台**、以 **GitHub 作為更新入口** 的台灣拉麵店分類地圖。  
本專案會沿用 [`ramen-style-finder`](https://github.com/AnsonHui6040/ramen-style-finder) 的 16 個四字分類，並把各地區拉麵店整理成可搜尋、可篩選、可地圖顯示的資料站。

## 目前版本

- 先支援 **台中** 範例資料
- 每個大地區一個 Excel，例如 `data/excel/taichung.xlsx`
- GitHub Actions 會在 Excel 更新後自動轉成 `docs/data/*.json`
- 前端為靜態頁面，可直接部署到 GitHub Pages

## 專案結構

```text
ramen-shop-finder/
├─ data/
│  ├─ excel/
│  │  └─ taichung.xlsx
│  └─ style/
│     └─ type-profiles.json
├─ scripts/
│  ├─ build-data.mjs
│  └─ dev-server.mjs
├─ docs/
│  ├─ index.html
│  ├─ app.js
│  ├─ style.css
│  └─ data/
│     ├─ taichung.json
│     └─ meta.json
└─ .github/
   └─ workflows/
      └─ build-data.yml
```

## Excel 工作表規格

每個地區 Excel 建議包含以下工作表：

### 1. `shops_main`
正式資料表，網站只會輸出 `status = published` 的列。

| 欄位 | 說明 |
|---|---|
| `shop_id` | 唯一 ID，例如 `tcg-xitun-0001` |
| `status` | `draft` / `published` / `hidden` |
| `source_type` | `ai_import` / `manual` / `mixed` |
| `region` | 大地區，例如 `台中` |
| `district` | 行政區，例如 `西屯區` |
| `area_tag` | 地標／商圈，例如 `逢甲夜市` |
| `name_zh` | 中文店名 |
| `name_original` | 原文店名 |
| `style_code` | 4 字分類代碼，例如 `RWHT` |
| `style_4char` | 4 字分類名稱，例如 `濃白重口型` |
| `style_confidence` | 0–100 |
| `rating` | 評分 |
| `rating_count` | 評價數 |
| `address` | 完整地址 |
| `lat` / `lng` | 座標 |
| `open_hours` | 營業時間 |
| `phone` | 電話 |
| `website` | 官網 |
| `map_url` | Google Maps 連結 |
| `notes` | 備註 |
| `last_verified` | 最後人工確認日期 |

### 2. `shops_manual_add`
人工新增與待審資料表，欄位可與 `shops_main` 相同，另加：

- `review_flag`
- `editor_note`

### 3. `shops_ai_raw`
AI 匯入原始資料表，不直接上線，用來保留原始輸出與比對。

### 4. `meta`
地區設定表，例如：

- `region_code`
- `region_name`
- `default_center_lat`
- `default_center_lng`
- `default_zoom`
- `last_update`

## 本機開發

安裝依賴：

```bash
npm install
```

手動重建資料：

```bash
npm run build:data
```

啟動本機預覽：

```bash
npm run dev
```

本機預覽預設網址：

```text
http://127.0.0.1:5173
```

`npm run dev` 會先自動執行 `build:data`，再啟動 `docs/` 的靜態預覽伺服器。

## GitHub Actions

當以下內容更新時，workflow 會自動重建資料：

- `data/excel/*.xlsx`
- `scripts/build-data.mjs`

產出檔案：

- `docs/data/<region>.json`
- `docs/data/meta.json`

## 備註

本版已把 `ramen-style-finder` 的 16 個分類資料抽出成 `data/style/type-profiles.json`，可直接供分類頁與資料整理流程使用。

## 智慧財產權與使用聲明

本專案之原始碼、介面設計、流程架構、題庫設計、分類邏輯、文案內容與相關成果，除另有註明者外，均由本專案作者保留其相關智慧財產權。

### 著作權聲明
本專案內容包括但不限於：
- 原始碼
- UI / UX 設計
- 分類流程設計
- 題庫與分類邏輯
- 結果頁呈現方式
- 專案說明文件

上述內容均受著作權法及相關智慧財產權法規保護。

### 使用與授權
除本專案另附之授權條款（如 LICENSE）明確允許者外，任何人不得未經作者事前書面同意，對本專案內容進行下列行為：
- 重製
- 散布
- 修改後再發布
- 商業使用
- 作為其他產品、服務或平台之核心內容

### 第三方套件與資源
本專案可能使用第三方開源套件、框架或工具，其權利仍屬各原權利人所有。  
相關第三方資源之授權條款，應依各自官方授權文件為準。

### 商標與名稱聲明
本專案中提及之品牌名稱、產品名稱、框架名稱或服務名稱，均屬其各自權利人所有。  
本專案之使用僅為功能描述、研究、開發或識別目的，不代表任何官方合作、授權或從屬關係。

### 免責聲明
本專案目前為開發／研究用途之 MVP，分類結果僅供參考，不保證其完整性、即時性或絕對準確性。  
作者不對因使用本專案所產生之任何直接或間接損失負責。

### 聯絡與授權洽詢
如需引用、轉載、商業合作、二次開發授權或其他使用授權，請先與專案作者聯絡。