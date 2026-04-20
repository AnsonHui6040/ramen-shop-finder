const state = {
  meta: null,
  regions: [],
  currentRegionCode: "",
  regionData: null,
  profiles: [],
  map: null,
  markersLayer: null,
  selectedShopId: "",
  sortByCount: false,
};

const els = {
  regionSelect: document.getElementById("region-select"),
  keywordInput: document.getElementById("keyword-input"),
  districtSelect: document.getElementById("district-select"),
  areaSelect: document.getElementById("area-select"),
  styleSelect: document.getElementById("style-select"),
  ratingSelect: document.getElementById("rating-select"),
  sortCountBtn: document.getElementById("sort-count-btn"),
  chipSearch: document.getElementById("chip-search"),
  mRegionSelect: document.getElementById("m-region-select"),
  mDistrictSelect: document.getElementById("m-district-select"),
  mAreaSelect: document.getElementById("m-area-select"),
  mStyleSelect: document.getElementById("m-style-select"),
  chipRatingRow: document.getElementById("chip-rating-row"),
  styleHelp: document.getElementById("style-help"),
  resultCount: document.getElementById("result-count"),
  shopList: document.getElementById("shop-list"),
  dataUpdatedAt: document.getElementById("data-updated-at"),
  detailContent: document.getElementById("detail-content"),
  detailPanel: document.querySelector(".detail-panel"),
  detailHeader: document.getElementById("detail-header"),
  detailTitle: document.getElementById("detail-title"),
  detailChevron: document.getElementById("detail-chevron"),
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
    option.textContent = `${profile.code}｜${profile.name}`;
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
    els.styleHelp.textContent = "請先選擇一個類型。";
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
  }).sort((a, b) =>
    state.sortByCount
      ? (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
      : (b.rating ?? 0) - (a.rating ?? 0)
  );
}

function isMobile() {
  return window.innerWidth <= 960;
}

function renderDetail(shop) {
  els.detailTitle.textContent = shop ? shop.name : "店家詳細";
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
        <div class="detail-row"><strong>市</strong><span>${escapeHtml(shop.region || "-")} ${shop.district ? `／${escapeHtml(shop.district)}` : ""}</span></div>
        <div class="detail-row"><strong>商圈 / 路段</strong><span>${escapeHtml(shop.areaTag || "未設定")}</span></div>
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

function makeChip(label, active, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `chip-btn${active ? " is-active" : ""}`;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderChipFilters() {
  if (!state.regionData) return;
  const selRating = els.ratingSelect.value;

  // Sync mobile style select
  if (els.mStyleSelect.options.length <= 1) {
    state.profiles.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.code;
      opt.textContent = `${p.code}｜${p.name}`;
      els.mStyleSelect.appendChild(opt);
    });
  }
  els.mStyleSelect.value = els.styleSelect.value;

  // Rating + sort chips
  els.chipRatingRow.innerHTML = "";
  [{ label: "⭐ 4.5+", val: "4.5" }, { label: "⭐ 4.0+", val: "4.0" }, { label: "⭐ 3.5+", val: "3.5" }].forEach(({ label, val }) =>
    els.chipRatingRow.appendChild(makeChip(label, selRating === val, () => {
      els.ratingSelect.value = selRating === val ? "" : val;
      renderShops(true);
    }))
  );
  els.chipRatingRow.appendChild(makeChip("評論數↓", state.sortByCount, () => {
    state.sortByCount = !state.sortByCount;
    els.sortCountBtn.classList.toggle("is-active", state.sortByCount);
    renderShops(true);
  }));
  els.chipRatingRow.appendChild(makeChip("重設", false, () => {
    els.ratingSelect.value = "";
    els.districtSelect.value = "";
    els.areaSelect.value = "";
    els.styleSelect.value = "";
    els.keywordInput.value = "";
    els.chipSearch.value = "";
    state.sortByCount = false;
    els.sortCountBtn.classList.remove("is-active");
    refreshFilters();
    renderStyleHelp();
    renderShops(true);
  }));
}

function renderRegionSummary() {}

function renderShops(fitMap = false) {
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
  const markersById = {};

  shops.forEach((shop) => {
    const isActive = shop.shopId === state.selectedShopId;
    const card = document.createElement("article");
    card.className = `shop-card${isActive ? " is-active" : ""}`;
    card.innerHTML = `
      <h3>${escapeHtml(shop.name)}</h3>
      <div class="shop-meta">
        <span class="tag">${escapeHtml(shop.style4char || "-")}</span>
        <span class="tag">${escapeHtml(shop.district || "-")}</span>
        <span class="tag">${escapeHtml(shop.areaTag || "未設定")}</span>
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
      markersById[shop.shopId] = marker;
      bounds.push([shop.lat, shop.lng]);
    }
  });

  if (fitMap && bounds.length) {
    state.map.fitBounds(bounds, { padding: [36, 36] });
  }
  if (state.selectedShopId && markersById[state.selectedShopId]) {
    markersById[state.selectedShopId].openPopup();
  }

  renderChipFilters();
}

function refreshFilters() {
  const shops = state.regionData?.shops || [];
  const selectedDistrict = els.districtSelect.value;
  const districts = [...new Set(shops.map((shop) => shop.district).filter(Boolean))].sort();
  const areas = [...new Set(
    shops
      .filter((shop) => !selectedDistrict || shop.district === selectedDistrict)
      .map((shop) => shop.areaTag)
      .filter(Boolean)
  )].sort();
  fillSelect(els.districtSelect, districts, "全部");
  fillSelect(els.areaSelect, areas, "全部");
  fillSelect(els.mDistrictSelect, districts, "地區");
  fillSelect(els.mAreaSelect, areas, "商圈 / 路段");
  els.mDistrictSelect.value = els.districtSelect.value;
  els.mAreaSelect.value = els.areaSelect.value;
}

async function loadRegion(regionCode) {
  state.currentRegionCode = regionCode;
  state.regionData = await fetchJson(`./data/${regionCode}.json`);
  state.selectedShopId = state.regionData?.shops?.[0]?.shopId || "";
  const { defaultMap, updatedAt } = state.regionData;

  setFiltersEnabled(true);
  refreshFilters();
  renderStyleHelp();
  renderShops();

  if (defaultMap?.lat && defaultMap?.lng) {
    state.map.setView([defaultMap.lat, defaultMap.lng], defaultMap.zoom || 12);
  }

  els.dataUpdatedAt.textContent = `資料更新：${new Date(updatedAt).toLocaleDateString("zh-Hant")}`;
}

function setFiltersEnabled(enabled) {
  const targets = [
    els.keywordInput, els.districtSelect, els.areaSelect, els.styleSelect,
    els.ratingSelect, els.sortCountBtn, els.chipSearch,
    els.mDistrictSelect, els.mAreaSelect, els.mStyleSelect,
  ];
  targets.forEach((el) => { el.disabled = !enabled; });
  els.chipRatingRow.querySelectorAll("button").forEach((btn) => { btn.disabled = !enabled; });
  document.querySelector(".sidebar .panel:nth-child(2)")?.classList.toggle("filters-locked", !enabled);
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

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "請選擇市";
  els.regionSelect.appendChild(placeholder);
  els.mRegionSelect.appendChild(placeholder.cloneNode(true));

  state.regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.regionCode;
    option.textContent = region.shopCount > 0
      ? `${region.region}（${region.shopCount}）`
      : region.region;
    els.mRegionSelect.appendChild(option.cloneNode(true));
    els.regionSelect.appendChild(option);
  });

  els.regionSelect.value = "";
  els.mRegionSelect.value = "";
  setFiltersEnabled(false);

  els.shopList.innerHTML = '<div class="empty-state">請先選擇市。</div>';
  els.detailContent.textContent = "請先選擇市後，再從列表或地圖選擇一家店。";

  els.detailHeader.addEventListener("click", () => {
    if (isMobile()) {
      const isOpen = els.detailPanel.classList.toggle("is-open");
      els.detailChevron.textContent = isOpen ? "縮小詳細" : "更多詳細";
    }
  });

  function onRegionChange(code) {
    if (!code) {
      setFiltersEnabled(false);
      state.regionData = null;
      state.selectedShopId = "";
      els.shopList.innerHTML = '<div class="empty-state">請先選擇市。</div>';
      renderDetail(null);
      return;
    }
    loadRegion(code);
  }

  els.regionSelect.addEventListener("change", () => {
    els.mRegionSelect.value = els.regionSelect.value;
    onRegionChange(els.regionSelect.value);
  });
  els.mRegionSelect.addEventListener("change", () => {
    els.regionSelect.value = els.mRegionSelect.value;
    onRegionChange(els.mRegionSelect.value);
  });
  els.keywordInput.addEventListener("input", () => renderShops(true));
  els.chipSearch.addEventListener("input", () => {
    els.keywordInput.value = els.chipSearch.value;
    renderShops(true);
  });
  els.mDistrictSelect.addEventListener("change", () => {
    els.districtSelect.value = els.mDistrictSelect.value;
    els.areaSelect.value = "";
    refreshFilters();
    renderShops(true);
  });
  els.mAreaSelect.addEventListener("change", () => {
    els.areaSelect.value = els.mAreaSelect.value;
    renderShops(true);
  });
  els.mStyleSelect.addEventListener("change", () => {
    els.styleSelect.value = els.mStyleSelect.value;
    renderStyleHelp();
    renderShops(true);
  });
  els.districtSelect.addEventListener("change", () => {
    els.areaSelect.value = "";
    refreshFilters();
    renderShops(true);
  });
  els.areaSelect.addEventListener("change", () => renderShops(true));
  els.styleSelect.addEventListener("change", () => {
    renderStyleHelp();
    renderShops(true);
  });
  els.ratingSelect.addEventListener("change", () => renderShops(true));
  els.sortCountBtn.addEventListener("click", () => {
    state.sortByCount = !state.sortByCount;
    els.sortCountBtn.classList.toggle("is-active", state.sortByCount);
    renderShops(true);
  });
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