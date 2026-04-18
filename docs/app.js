const state = {
  meta: null,
  regions: [],
  currentRegionCode: "",
  regionData: null,
  profiles: [],
  map: null,
  markersLayer: null,
};

const els = {
  regionSelect: document.getElementById("region-select"),
  keywordInput: document.getElementById("keyword-input"),
  districtSelect: document.getElementById("district-select"),
  areaSelect: document.getElementById("area-select"),
  styleSelect: document.getElementById("style-select"),
  ratingSelect: document.getElementById("rating-select"),
  styleHelp: document.getElementById("style-help"),
  resultCount: document.getElementById("result-count"),
  shopList: document.getElementById("shop-list"),
  dataUpdatedAt: document.getElementById("data-updated-at"),
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }
  return response.json();
}

function initMap() {
  state.map = L.map("map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString("zh-Hant") : "-";
}

function fillSelect(select, values, placeholder = "全部") {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach((value) => {
    if (!value) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = values.includes(current) ? current : "";
}

function renderStyleOptions() {
  const current = els.styleSelect.value;
  els.styleSelect.innerHTML = '<option value="">全部</option>';

  state.profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.code;
    option.textContent = `${profile.name}（${profile.code}）`;
    els.styleSelect.appendChild(option);
  });

  if (state.profiles.some((profile) => profile.code === current)) {
    els.styleSelect.value = current;
  }
}

function getProfile(code) {
  return state.profiles.find((profile) => profile.code === code) || null;
}

function renderStyleHelp() {
  const profile = getProfile(els.styleSelect.value);
  if (!profile) {
    els.styleHelp.textContent = "請先選擇一個四字分類。";
    return;
  }

  const tags = (profile.ingredientTags || []).join(" / ");
  els.styleHelp.innerHTML = `
    <strong>${profile.name}</strong><br />
    ${profile.summary}<br /><br />
    家族：${profile.family}<br />
    四軸：${profile.axisLabels.richness}・${profile.axisLabels.broth}・${profile.axisLabels.impact}・${profile.axisLabels.noodle}<br />
    食材方向：${tags}
  `;
}

function getFilteredShops() {
  const shops = state.regionData?.shops || [];
  const keyword = els.keywordInput.value.trim().toLowerCase();
  const district = els.districtSelect.value;
  const area = els.areaSelect.value;
  const styleCode = els.styleSelect.value;
  const minRating = Number(els.ratingSelect.value || 0);

  return shops.filter((shop) => {
    const keywordMatch =
      !keyword ||
      [shop.name, shop.nameOriginal, shop.address, shop.areaTag, shop.district]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);

    const districtMatch = !district || shop.district === district;
    const areaMatch = !area || shop.areaTag === area;
    const styleMatch = !styleCode || shop.styleCode === styleCode;
    const ratingMatch = !minRating || (shop.rating || 0) >= minRating;

    return keywordMatch && districtMatch && areaMatch && styleMatch && ratingMatch;
  });
}

function renderShops() {
  const shops = getFilteredShops();
  els.resultCount.textContent = `${shops.length} 間`;

  els.shopList.innerHTML = "";
  state.markersLayer.clearLayers();

  if (!shops.length) {
    els.shopList.innerHTML = '<div class="empty-state">沒有符合條件的店家。</div>';
    return;
  }

  const bounds = [];

  shops.forEach((shop) => {
    const card = document.createElement("article");
    card.className = "shop-card";
    card.innerHTML = `
      <h3>${shop.name}</h3>
      <div class="shop-meta">
        <span class="tag">${shop.style4char || "-"}</span>
        <span class="tag">${shop.district || "-"}</span>
        <span class="tag">${shop.areaTag || "未設定商圈"}</span>
        <span class="tag">⭐ ${shop.rating ?? "-"}</span>
        <span class="tag">評論 ${formatNumber(shop.ratingCount)}</span>
      </div>
      <p>${shop.address || "未提供地址"}</p>
      <p>${shop.openHours || "未提供營業時間"}</p>
      <p>${shop.notes || ""}</p>
      <div class="shop-links">
        ${shop.mapUrl ? `<a href="${shop.mapUrl}" target="_blank" rel="noreferrer">Google Maps</a>` : ""}
        ${shop.website ? `<a href="${shop.website}" target="_blank" rel="noreferrer">官方網站</a>` : ""}
      </div>
    `;
    els.shopList.appendChild(card);

    if (typeof shop.lat === "number" && typeof shop.lng === "number") {
      const marker = L.marker([shop.lat, shop.lng]).bindPopup(`
        <strong>${shop.name}</strong><br />
        ${shop.style4char || "-"}<br />
        ${shop.district || ""} ${shop.areaTag ? `・${shop.areaTag}` : ""}<br />
        ⭐ ${shop.rating ?? "-"} / ${formatNumber(shop.ratingCount)}
      `);
      marker.addTo(state.markersLayer);
      bounds.push([shop.lat, shop.lng]);
    }
  });

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [36, 36] });
  }
}

function refreshFilters() {
  const shops = state.regionData?.shops || [];
  const districts = [...new Set(shops.map((shop) => shop.district).filter(Boolean))].sort();
  const areas = [...new Set(shops.map((shop) => shop.areaTag).filter(Boolean))].sort();
  fillSelect(els.districtSelect, districts, "全部");
  fillSelect(els.areaSelect, areas, "全部");
}

async function loadRegion(regionCode) {
  state.currentRegionCode = regionCode;
  state.regionData = await fetchJson(`./data/${regionCode}.json`);
  const { defaultMap, updatedAt } = state.regionData;

  refreshFilters();
  renderStyleHelp();
  renderShops();

  if (defaultMap?.lat && defaultMap?.lng) {
    state.map.setView([defaultMap.lat, defaultMap.lng], defaultMap.zoom || 12);
  }

  els.dataUpdatedAt.textContent = `資料更新：${new Date(updatedAt).toLocaleString("zh-Hant")}`;
}

async function init() {
  initMap();

  const [meta, profiles] = await Promise.all([
    fetchJson("./data/meta.json"),
    fetchJson("./data/type-profiles.json"),
  ]);

  state.meta = meta;
  state.regions = meta.regions || [];
  state.profiles = profiles || [];

  renderStyleOptions();

  state.regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.regionCode;
    option.textContent = `${region.region}（${region.shopCount}）`;
    els.regionSelect.appendChild(option);
  });

  const defaultRegionCode = state.regions[0]?.regionCode || "taichung";
  els.regionSelect.value = defaultRegionCode;

  els.regionSelect.addEventListener("change", () => loadRegion(els.regionSelect.value));
  els.keywordInput.addEventListener("input", renderShops);
  els.districtSelect.addEventListener("change", renderShops);
  els.areaSelect.addEventListener("change", renderShops);
  els.styleSelect.addEventListener("change", () => {
    renderStyleHelp();
    renderShops();
  });
  els.ratingSelect.addEventListener("change", renderShops);

  await loadRegion(defaultRegionCode);
}

init().catch((error) => {
  console.error(error);
  els.shopList.innerHTML = `<div class="empty-state">資料載入失敗：${error.message}</div>`;
});