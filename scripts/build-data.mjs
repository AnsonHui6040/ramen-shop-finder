import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const root = process.cwd();
const excelDir = path.join(root, "data", "excel");
const outputDir = path.join(root, "docs", "data");
const typeProfilePath = path.join(root, "data", "style", "type-profiles.json");

const VALID_STATUSES = new Set(["draft", "published", "hidden"]);
const VALID_URL_PROTOCOLS = new Set(["http:", "https:"]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toBoundedNumber(value, min, max) {
  const num = toNumber(value);
  if (num === null || num < min || num > max) return null;
  return num;
}

function toNonNegativeInteger(value) {
  const num = toNumber(value);
  if (num === null || num < 0) return null;
  return Math.round(num);
}

function normalizePriceRange(row) {
  let priceMin = toNonNegativeInteger(row.price_min || row.priceMin);
  let priceMax = toNonNegativeInteger(row.price_max || row.priceMax);

  if (priceMin === null || priceMax === null) {
    return {
      priceMin: null,
      priceMax: null,
      priceRangeLabel: normalizeText(row.price_range_label || row.priceRangeLabel, 50),
    };
  }

  if (priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const priceRangeLabel =
    normalizeText(row.price_range_label || row.priceRangeLabel, 50) || `$${priceMin}–$${priceMax}`;

  return { priceMin, priceMax, priceRangeLabel };
}

function normalizeText(value, maxLength = 500) {
  if (value === null || value === undefined) return "";
  const text = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeStatus(value) {
  const status = normalizeText(value || "draft").toLowerCase();
  return VALID_STATUSES.has(status) ? status : "draft";
}

function normalizeRegionCode(value, fallback) {
  const code = normalizeText(value || fallback, 100)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return code || fallback;
}

function normalizeUrl(value) {
  const raw = normalizeText(value, 1000);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return VALID_URL_PROTOCOLS.has(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });
}

function normalizeShop(row, profilesMap, regionCode) {
  const styleCode = normalizeText(row.style_code || row.styleCode, 20).toUpperCase();
  const profile = profilesMap.get(styleCode);
  const priceRange = normalizePriceRange(row);

  return {
    shopId: normalizeText(row.shop_id || row.shopId, 80),
    status: normalizeStatus(row.status || "draft"),
    sourceType: normalizeText(row.source_type || row.sourceType || "manual", 50),
    region: normalizeText(row.region, 50),
    district: normalizeText(row.district, 50),
    areaTag: normalizeText(row.area_tag || row.areaTag, 80),
    name: normalizeText(row.name_zh || row.name || row.name_original, 120),
    nameOriginal: normalizeText(row.name_original || row.nameOriginal, 120),
    styleCode,
    style4char: normalizeText(row.style_4char || row.style4char || profile?.name || "", 80),
    styleFamily: normalizeText(profile?.family || "", 80),
    styleConfidence: toBoundedNumber(row.style_confidence || row.styleConfidence, 0, 100),
    rating: toBoundedNumber(row.rating, 0, 5),
    ratingCount: toNonNegativeInteger(row.rating_count || row.ratingCount),
    ...priceRange,
    address: normalizeText(row.address, 240),
    lat: toBoundedNumber(row.lat, -90, 90),
    lng: toBoundedNumber(row.lng, -180, 180),
    openHours: normalizeText(row.open_hours || row.openHours, 500),
    phone: normalizeText(row.phone, 50),
    website: normalizeUrl(row.website),
    mapUrl: normalizeUrl(row.map_url || row.mapUrl),
    notes: normalizeText(row.notes, 1000),
    lastVerified: normalizeText(row.last_verified || row.lastVerified, 50),
    regionCode,
  };
}

function dedupeShops(shops, regionCode) {
  const seen = new Set();
  const deduped = [];

  for (const shop of shops) {
    if (!shop.shopId) continue;
    if (seen.has(shop.shopId)) {
      console.warn(`[${regionCode}] skipped duplicated shop_id: ${shop.shopId}`);
      continue;
    }
    seen.add(shop.shopId);
    deduped.push(shop);
  }

  return deduped;
}

function buildRegion(filePath, profilesMap) {
  const workbook = xlsx.readFile(filePath, {
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  });
  const metaRows = readSheet(workbook, "meta");
  const mainRows = readSheet(workbook, "shops_main");
  const manualRows = readSheet(workbook, "shops_manual_add");

  const meta = metaRows[0] || {};
  const fallbackRegionCode = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const regionCode = normalizeRegionCode(meta.region_code, fallbackRegionCode);

  const publishedMain = mainRows
    .map((row) => normalizeShop(row, profilesMap, regionCode))
    .filter((row) => row.status === "published");

  const approvedManual = manualRows
    .filter((row) => normalizeText(row.review_flag || "approved").toLowerCase() === "approved")
    .map((row) => normalizeShop(row, profilesMap, regionCode))
    .filter((row) => row.status === "published");

  const shops = dedupeShops(
    [...publishedMain, ...approvedManual].filter(
      (shop) => shop.shopId && shop.name && shop.lat !== null && shop.lng !== null,
    ),
    regionCode,
  );

  // Build district→areas map from seed sheet.
  const seedRows = readSheet(workbook, "district_area_seed");
  const districtMap = new Map();

  for (const row of seedRows) {
    const district = normalizeText(row.district, 50);
    const area = normalizeText(row.area_tag, 80);
    if (!district) continue;
    if (!districtMap.has(district)) districtMap.set(district, new Set());
    if (area) districtMap.get(district).add(area);
  }

  const districts = Array.from(districtMap.entries()).map(([district, areas]) => ({
    district,
    areas: Array.from(areas),
  }));

  return {
    region: normalizeText(meta.region_name, 50) || normalizeText(shops[0]?.region, 50) || regionCode,
    regionCode,
    updatedAt: new Date().toISOString(),
    defaultMap: {
      lat: toBoundedNumber(meta.default_center_lat, -90, 90) ?? 24.1477,
      lng: toBoundedNumber(meta.default_center_lng, -180, 180) ?? 120.6736,
      zoom: toBoundedNumber(meta.default_zoom, 1, 19) ?? 12,
    },
    shopCount: shops.length,
    districts,
    shops,
  };
}

function loadTypeProfiles() {
  const profiles = JSON.parse(fs.readFileSync(typeProfilePath, "utf-8"));
  if (!Array.isArray(profiles)) {
    throw new Error("data/style/type-profiles.json must be an array.");
  }

  return profiles.map((profile) => ({
    ...profile,
    code: normalizeText(profile.code, 20).toUpperCase(),
  }));
}

function main() {
  ensureDir(outputDir);

  const profiles = loadTypeProfiles();
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
