import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const root = process.cwd();
const excelDir = path.join(root, "data", "excel");
const outputDir = path.join(root, "docs", "data");
const typeProfilePath = path.join(root, "data", "style", "type-profiles.json");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

function normalizeShop(row, profilesMap, regionCode) {
  const styleCode = normalizeText(row.style_code || row.styleCode).toUpperCase();
  const profile = profilesMap.get(styleCode);

  return {
    shopId: normalizeText(row.shop_id || row.shopId),
    status: normalizeText(row.status || "draft"),
    sourceType: normalizeText(row.source_type || row.sourceType || "manual"),
    region: normalizeText(row.region),
    district: normalizeText(row.district),
    areaTag: normalizeText(row.area_tag || row.areaTag),
    name: normalizeText(row.name_zh || row.name || row.name_original),
    nameOriginal: normalizeText(row.name_original || row.nameOriginal),
    styleCode,
    style4char: normalizeText(row.style_4char || row.style4char || profile?.name || ""),
    styleFamily: profile?.family || "",
    styleConfidence: toNumber(row.style_confidence || row.styleConfidence),
    rating: toNumber(row.rating),
    ratingCount: toNumber(row.rating_count || row.ratingCount),
    address: normalizeText(row.address),
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    openHours: normalizeText(row.open_hours || row.openHours),
    phone: normalizeText(row.phone),
    website: normalizeText(row.website),
    mapUrl: normalizeText(row.map_url || row.mapUrl),
    notes: normalizeText(row.notes),
    lastVerified: normalizeText(row.last_verified || row.lastVerified),
    regionCode,
  };
}

function buildRegion(filePath, profilesMap) {
  const workbook = xlsx.readFile(filePath);
  const metaRows = readSheet(workbook, "meta");
  const mainRows = readSheet(workbook, "shops_main");
  const manualRows = readSheet(workbook, "shops_manual_add");

  const meta = metaRows[0] || {};
  const regionCode =
    normalizeText(meta.region_code) ||
    path.basename(filePath, path.extname(filePath)).toLowerCase();

  const publishedMain = mainRows
    .map((row) => normalizeShop(row, profilesMap, regionCode))
    .filter((row) => row.status === "published");

  const approvedManual = manualRows
    .filter((row) => normalizeText(row.review_flag || "approved") === "approved")
    .map((row) => normalizeShop(row, profilesMap, regionCode))
    .filter((row) => row.status === "published");

  const shops = [...publishedMain, ...approvedManual].filter(
    (shop) => shop.shopId && shop.name && shop.lat !== null && shop.lng !== null,
  );

  return {
    region: normalizeText(meta.region_name) || normalizeText(shops[0]?.region) || regionCode,
    regionCode,
    updatedAt: new Date().toISOString(),
    defaultMap: {
      lat: toNumber(meta.default_center_lat) || 24.1477,
      lng: toNumber(meta.default_center_lng) || 120.6736,
      zoom: toNumber(meta.default_zoom) || 12,
    },
    shopCount: shops.length,
    shops,
  };
}

function main() {
  ensureDir(outputDir);

  const profiles = JSON.parse(fs.readFileSync(typeProfilePath, "utf-8"));
  const profilesMap = new Map(profiles.map((profile) => [profile.code, profile]));

  const files = fs.existsSync(excelDir)
    ? fs.readdirSync(excelDir).filter((file) => file.endsWith(".xlsx"))
    : [];

  const regions = [];

  for (const file of files) {
    const regionData = buildRegion(path.join(excelDir, file), profilesMap);
    regions.push(regionData);

    fs.writeFileSync(
      path.join(outputDir, `${regionData.regionCode}.json`),
      JSON.stringify(regionData, null, 2),
      "utf-8",
    );
  }

  fs.writeFileSync(
    path.join(outputDir, "type-profiles.json"),
    JSON.stringify(profiles, null, 2),
    "utf-8",
  );

  const meta = {
    updatedAt: new Date().toISOString(),
    regionCount: regions.length,
    regions: regions.map((region) => ({
      region: region.region,
      regionCode: region.regionCode,
      shopCount: region.shopCount,
      defaultMap: region.defaultMap,
      dataPath: `./data/${region.regionCode}.json`,
    })),
  };

  fs.writeFileSync(path.join(outputDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log(`Built ${regions.length} region JSON files.`);
}

main();