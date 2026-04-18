# Excel 資料夾說明

請把每個大地區的 Excel 檔放在這裡，例如：

- `taichung.xlsx`
- `taipei.xlsx`
- `tainan.xlsx`

建議每個 Excel 至少包含以下工作表：

- `shops_main`
- `shops_manual_add`
- `shops_ai_raw`
- `meta`

當你更新這個資料夾內的 `.xlsx` 檔並 push 到 GitHub 後，GitHub Actions 會自動執行 `scripts/build-data.mjs`，把資料轉成 `docs/data/*.json`。