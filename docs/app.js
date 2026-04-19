const state = {
  meta: null,
  regions: [],
  currentRegionCode: "",
  regionData: null,
  profiles: [],
  map: null,
  markersLayer: null,
  selectedShopId: "",
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
  regionSummary: document.getElementById("region-summary"),
  detailContent: document.getElementById("detail-content"),
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    <strong>${escapeHtml(profile.name)}</strong><br />
    ${escapeHtml(profile.summary)}<br /><br />
    家族：${escapeHtml(profile.family)}<br />
    四軸：${escapeHtml(profile.axisLabels.richness)}・${escapeHtml(profile.axisLabels.broth)}・${escapeHtml(profile.axisLabels.impact)}・${escapeHtml(profile.axisLabels.noodle)}<br />
    食材方向：${escapeHtml(tags)}
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

function renderDetail(shop) {
  if (!shop) {
    els.detailContent.innerHTML = "請先從列表或地圖選擇一家店。";
    return;
  }

  els.detailContent.innerHTML = `
    <article class="detail-card">
      <h3>${escapeHtml(shop.name)}</h3>
      <div class="detail-meta">
        <span class="tag">${escapeHtml(shop.style4char || "-")}</span>
        <span class="tag">${escapeHtml(shop.styleCode || "-")}</span>
        <span class="tag">⭐ ${escapeHtml(shop.rating ?? "-")}</span>
        <span class="tag">評論 ${escapeHtml(formatNumber(shop.ratingCount))}</span>
      </div>
      <div class="detail-list">
        <div class="detail-row"><strong>區域</strong><span>${escapeHtml(shop.region || "-")} ${shop.district ? `／${escapeHtml(shop.district)}` : ""}</span></div>
        <div class="detail-row"><strong>商圈</strong><span>${escapeHtml(shop.areaTag || "未設定")}</span></div>
        <div class="detail-row"><strong>地址</strong><span>${escapeHtml(shop.address || "未提供")}</span></div>
        <div class="detail-row"><strong>營業時間</strong><span>${escapeHtml(shop.openHours || "未提供")}</span></div>
        <div class="detail-row"><strong>電話</strong><span>${escapeHtml(shop.phone || "未提供")}</span></div>
        <div class="detail-row"><strong>分類信心</strong><span>${escapeHtml(shop.styleConfidence ?? "-")}</span></div>
        <div class="detail-row"><strong>最後驗證</strong><span>${escapeHtml(shop.lastVerified || "未提供")}</span></div>
        <div class="detail-row"><strong>備註</strong><span>${escapeHtml(shop.notes || "未提供")}</span></div>
      </div>
      <div class="detail-links">
        ${shop.mapUrl ? `<a href="${escapeHtml(shop.mapUrl)}" target="_blank" rel="noreferrer">Google Maps</a>` : ""}
        ${shop.website ? `<a href="${escapeHtml(shop.website)}" target="_blank" rel="noreferrer">官方網站</a>` : ""}
      </div>
    </article>
  `;
}

function setSelectedShop(shop, options = {}) {
  state.selectedShopId = shop?.shopId || "";
  renderDetail(shop || null);

  if (shop && options.panToMarker !== false && typeof shop.lat === "number" && typeof shop.lng === "number") {
    state.map.setView([shop.lat, shop.lng], Math.max(state.map.getZoom(), 15));
  }
}

function renderRegionSummary(totalCount, filteredCount) {
  const regionName = state.regionData?.region || state.currentRegionCode || "未選擇地區";
  els.regionSummary.textContent = `${regionName}｜顯示 ${filteredCount} / ${totalCount} 間`;
}

function renderShops() {
  const allShops = state.regionData?.shops || [];
  const shops = getFilteredShops();
  els.resultCount.textContent = `${shops.length} 間`;
  renderRegionSummary(allShops.length, shops.length);

  els.shopList.innerHTML = "";
  state.markersLayer.clearLayers();

  if (!shops.length) {
    state.selectedShopId = "";
    renderDetail(null);
    els.shopList.innerHTML = '<div class="empty-state">沒有符合條件的店家。</div>';
    return;
  }

  const selectedStillVisible = shops.some((shop) => shop.shopId === state.selectedShopId);
  if (!selectedStillVisible) {
    state.selectedShopId = shops[0].shopId;
  }

  const activeShop = shops.find((shop) => shop.shopId === state.selectedShopId) || shops[0];
  renderDetail(activeShop);

  const bounds = [];

  shops.forEach((shop) => {
    const isActive = shop.shopId === state.selectedShopId;
    const card = document.createElement("article");
    card.className = `shop-card${isActive ? " is-active" : ""}`;
    card.innerHTML = `
      <h3>${escapeHtml(shop.name)}</h3>
      <div class="shop-meta">
        <span class="tag">${escapeHtml(shop.style4char || "-")}</span>
        <span class="tag">${escapeHtml(shop.district || "-")}</span>
        <span class="tag">${escapeHtml(shop.areaTag || "未設定商圈")}</span>
        <span class="tag">⭐ ${escapeHtml(shop.rating ?? "-")}</span>
        <span class="tag">評論 ${escapeHtml(formatNumber(shop.ratingCount))}</span>
      </div>
      <p>${escapeHtml(shop.address || "未提供地址")}</p>
      <p>${escapeHtml(shop.openHours || "未提供營業時間")}</p>
      <p>${escapeHtml(shop.notes || "")}</p>
      <div class="shop-links">
        ${shop.mapUrl ? `<a href="${escapeHtml(shop.mapUrl)}" target="_blank" rel="noreferrer">Google Maps</a>` : ""}
        ${shop.website ? `<a href="${escapeHtml(shop.website)}" target="_blank" rel="noreferrer">官方網站</a>` : ""}
      </div>
    `;

    card.addEventListener("click", (event) => {
      const clickedLink = event.target.closest("a");
      if (clickedLink) return;
      setSelectedShop(shop);
      renderShops();
    });

    els.shopList.appendChild(card);

    if (typeof shop.lat === "number" && typeof shop.lng === "number") {
      const marker = L.marker([shop.lat, shop.lng]).bindPopup(`
        <strong>${escapeHtml(shop.name)}</strong><br />
        ${escapeHtml(shop.style4char || "-")}<br />
        ${escapeHtml(shop.district || "")} ${shop.areaTag ? `・${escapeHtml(shop.areaTag)}` : ""}<br />
        ⭐ ${escapeHtml(shop.rating ?? "-")} / ${escapeHtml(formatNumber(shop.ratingCount))}
      `);
      marker.on("click", () => {
        setSelectedShop(shop, { panToMarker: false });
        renderShops();
      });
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
  state.selectedShopId = state.regionData?.shops?.[0]?.shopId || "";
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
  if (els.shopList) {
    els.shopList.innerHTML = `<div class="empty-state">資料載入失敗：${escapeHtml(error.message)}</div>`;
  }
  if (els.detailContent) {
    els.detailContent.textContent = "目前無法載入店家詳細資料。";
  }
});