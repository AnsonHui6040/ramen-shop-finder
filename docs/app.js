const state = {
  meta: null,
  regions: [],
  currentRegionCode: "",
  regionData: null,
  profiles: [],
  map: null,
  markersLayer: null,
  markersById: {},
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
  priceSelect: document.getElementById("price-select"),
  sortCountBtn: document.getElementById("sort-count-btn"),
  chipSearch: document.getElementById("chip-search"),
  mRegionSelect: document.getElementById("m-region-select"),
  mDistrictSelect: document.getElementById("m-district-select"),
  mAreaSelect: document.getElementById("m-area-select"),
  mStyleSelect: document.getElementById("m-style-select"),
  mPriceSelect: document.getElementById("m-price-select"),
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

  invalidateMapSoon(100);
}

function invalidateMapSoon(delay = 100) {
  window.requestAnimationFrame(() => {
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, delay);
  });
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

function getPriceRangeMatch(shop, priceRange) {
  if (!priceRange) return true;
  if (typeof shop.priceMin !== "number" || typeof shop.priceMax !== "number") return false;

  switch (priceRange) {
    case "under-200":
      return shop.priceMin <= 200 || shop.priceMax <= 200;
    case "200-300":
      return shop.priceMin <= 300 && shop.priceMax >= 200;
    case "300-400":
      return shop.priceMin <= 400 && shop.priceMax >= 300;
    case "over-400":
      return shop.priceMax >= 400;
    default:
      return true;
  }
}

function getCurrentFilters() {
  return {
    keyword: els.keywordInput.value.trim(),
    district: els.districtSelect.value,
    area: els.areaSelect.value,
    styleCode: els.styleSelect.value,
    minRating: els.ratingSelect.value,
    priceRange: els.priceSelect.value,
  };
}

function getFilteredShops() {
  const shops = state.regionData?.shops || [];
  const keyword = els.keywordInput.value.trim().toLowerCase();
  const district = els.districtSelect.value;
  const area = els.areaSelect.value;
  const styleCode = els.styleSelect.value;
  const minRating = Number(els.ratingSelect.value || 0);
  const priceRange = els.priceSelect.value;

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
    const priceMatch = getPriceRangeMatch(shop, priceRange);

    return keywordMatch && districtMatch && areaMatch && styleMatch && ratingMatch && priceMatch;
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
        <span class="stamp-rect">${escapeHtml(shop.styleCode || "-")}</span>
        <span class="tag"><span class="tag-hole"></span>${escapeHtml(shop.style4char || "-")}</span>
        <span class="tag"><span class="tag-hole"></span>★ ${escapeHtml(shop.rating ?? "-")}</span>
        <span class="tag"><span class="tag-hole"></span>${escapeHtml(formatNumber(shop.ratingCount))} 則評論</span>
        <span class="tag"><span class="tag-hole"></span>${escapeHtml(shop.priceRangeLabel || "未提供")}</span>
      </div>
      <div class="detail-list">
        <div class="detail-row"><strong>縣市</strong><span>${escapeHtml(shop.region || "-")}${shop.district ? `／${escapeHtml(shop.district)}` : ""}</span></div>
        <div class="detail-row"><strong>商圈</strong><span>${escapeHtml(shop.areaTag || "未設定")}</span></div>
        <div class="detail-row"><strong>地址</strong><span>${escapeHtml(shop.address || "未提供")}</span></div>
        <div class="detail-row"><strong>營業</strong><span>${escapeHtml(shop.openHours || "未提供")}</span></div>
        <div class="detail-row"><strong>電話</strong><span>${escapeHtml(shop.phone || "未提供")}</span></div>
        <div class="detail-row"><strong>價格</strong><span>${escapeHtml(shop.priceRangeLabel || "未提供")}</span></div>
        <div class="detail-row"><strong>信心</strong><span>${escapeHtml(shop.styleConfidence ?? "-")}</span></div>
        <div class="detail-row"><strong>更新</strong><span>${escapeHtml(shop.lastVerified || "未提供")}</span></div>
        ${shop.notes ? `<div class="detail-row"><strong>備註</strong><span>${escapeHtml(shop.notes)}</span></div>` : ""}
      </div>
      <div class="detail-links">
        ${shop.mapUrl ? `<a href="${escapeHtml(shop.mapUrl)}" target="_blank" rel="noreferrer" data-link-kind="map">Google Maps</a>` : ""}
        ${shop.website ? `<a href="${escapeHtml(shop.website)}" target="_blank" rel="noreferrer">官方網站</a>` : ""}
      </div>
    </article>
  `;

  // 追蹤詳情面板中的地圖連結點擊（fire-and-forget，不阻擋開啟）
  if (window.ramenTracking) {
    els.detailContent.querySelectorAll('.detail-links a[data-link-kind="map"][href]').forEach((link) => {
      link.addEventListener("click", () => {
        window.ramenTracking.trackMapClick(
          { ...shop, region: state.currentRegionCode },
          "google_maps",
          link.getAttribute("href") || ""
        );
      });
    });
  }
}

function setSelectedShop(shop, options = {}) {
  state.selectedShopId = shop?.shopId || "";
  renderDetail(shop || null);

  if (shop && options.panToMarker !== false && typeof shop.lat === "number" && typeof shop.lng === "number") {
    state.map.setView([shop.lat, shop.lng], Math.max(state.map.getZoom(), 15));
  }
}

/** 只更新 is-active class，不重建整個列表 */
function updateActiveShopCard() {
  document.querySelectorAll(".shop-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.shopId === state.selectedShopId);
  });
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
  els.mPriceSelect.value = els.priceSelect.value;

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
    const hadPriceFilter = Boolean(els.priceSelect.value);
    els.ratingSelect.value = "";
    els.districtSelect.value = "";
    els.areaSelect.value = "";
    els.styleSelect.value = "";
    els.priceSelect.value = "";
    els.mPriceSelect.value = "";
    els.keywordInput.value = "";
    els.chipSearch.value = "";
    state.sortByCount = false;
    els.sortCountBtn.classList.remove("is-active");
    refreshFilters();
    renderStyleHelp();
    const resultCount = renderShops(true);
    if (hadPriceFilter) trackPriceFilterChange(resultCount);
  }));
}

function renderRegionSummary() {}

function trackPriceFilterChange(resultCount) {
  if (!window.ramenTracking) return;
  window.ramenTracking.trackFilterChange({
    filterName: "priceRange",
    filterValue: els.priceSelect.value,
    region: state.currentRegionCode,
    resultCount,
    filters: getCurrentFilters(),
  });
}

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
    renderChipFilters();
    return shops.length;
  }

  const selectedStillVisible = shops.some((shop) => shop.shopId === state.selectedShopId);
  if (!selectedStillVisible) {
    state.selectedShopId = shops[0].shopId;
  }

  const activeShop = shops.find((shop) => shop.shopId === state.selectedShopId) || shops[0];
  renderDetail(activeShop);

  const bounds = [];
  state.markersById = {};

  shops.forEach((shop) => {
    const isActive = shop.shopId === state.selectedShopId;
    const card = document.createElement("article");
    card.className = `shop-card${isActive ? " is-active" : ""}`;
    card.dataset.shopId = shop.shopId;
    card.innerHTML = `
      <h3>${escapeHtml(shop.name)}</h3>
      <div class="shop-meta">
        <span class="stamp-rect">${escapeHtml(shop.styleCode || "-")}</span>
        <span class="tag"><span class="tag-hole"></span>${escapeHtml(shop.style4char || "-")}</span>
        <span class="tag"><span class="tag-hole"></span>${escapeHtml(shop.district || "-")}</span>
        <span class="tag"><span class="tag-hole"></span>${escapeHtml(shop.priceRangeLabel || "未提供")}</span>
        ${shop.areaTag ? `<span class="tag"><span class="tag-hole"></span>${escapeHtml(shop.areaTag)}</span>` : ""}
      </div>
      <p>★ ${escapeHtml(shop.rating ?? "-")}　評論 ${escapeHtml(formatNumber(shop.ratingCount))}</p>
      <p>${escapeHtml(shop.address || "未提供地址")}</p>
      ${shop.openHours ? `<p>${escapeHtml(shop.openHours)}</p>` : ""}
      ${shop.notes ? `<p>${escapeHtml(shop.notes)}</p>` : ""}
      <div class="shop-links">
        ${shop.mapUrl ? `<a href="${escapeHtml(shop.mapUrl)}" target="_blank" rel="noreferrer" data-link-kind="map">Google Maps</a>` : ""}
        ${shop.website ? `<a href="${escapeHtml(shop.website)}" target="_blank" rel="noreferrer">官方網站</a>` : ""}
      </div>
    `;

    card.addEventListener("click", (event) => {
      const clickedLink = event.target.closest("a");
      if (clickedLink) {
        // map_click: fire-and-forget，不阻擋連結開啟
        if (window.ramenTracking && clickedLink.dataset.linkKind === "map") {
          window.ramenTracking.trackMapClick(
            { ...shop, region: state.currentRegionCode },
            "google_maps",
            clickedLink.getAttribute("href") || ""
          );
        }
        return;
      }
      if (window.ramenTracking) {
        window.ramenTracking.trackShopClick(
          { ...shop, region: state.currentRegionCode },
          "card"
        );
      }
      setSelectedShop(shop);
      updateActiveShopCard();
      // 開啟對應的 marker popup
      if (state.markersById[shop.shopId]) {
        state.markersById[shop.shopId].openPopup();
      }
    });

    els.shopList.appendChild(card);

    if (typeof shop.lat === "number" && typeof shop.lng === "number") {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;border-radius:50%;background:oklch(0.52 0.14 35);border:2px solid oklch(0.94 0.015 80);box-shadow:0 1px 3px rgba(0,0,0,.35);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -8],
      });
      const marker = L.marker([shop.lat, shop.lng], { icon }).bindPopup(`
        <strong>${escapeHtml(shop.name)}</strong><br />
        ${escapeHtml(shop.style4char || "-")}<br />
        ${escapeHtml(shop.district || "")} ${shop.areaTag ? `・${escapeHtml(shop.areaTag)}` : ""}<br />
        ⭐ ${escapeHtml(shop.rating ?? "-")} / ${escapeHtml(formatNumber(shop.ratingCount))}
      `);
      marker.on("click", () => {
        if (window.ramenTracking) {
          window.ramenTracking.trackShopClick(
            { ...shop, region: state.currentRegionCode },
            "card"
          );
        }
        setSelectedShop(shop, { panToMarker: false });
        updateActiveShopCard();
      });
      marker.addTo(state.markersLayer);
      state.markersById[shop.shopId] = marker;
      bounds.push([shop.lat, shop.lng]);
    }
  });

  if (fitMap && bounds.length) {
    state.map.fitBounds(bounds, { padding: [36, 36] });
  }
  if (state.selectedShopId && state.markersById[state.selectedShopId]) {
    state.markersById[state.selectedShopId].openPopup();
  }

  renderChipFilters();
  return shops.length;
}

function refreshFilters() {
  const shops = state.regionData?.shops || [];
  const seedDistricts = state.regionData?.districts || [];
  const selectedDistrict = els.districtSelect.value;

  // Merge seed districts with any districts from actual shops
  const seedDistrictNames = seedDistricts.map((d) => d.district);
  const shopDistrictNames = shops.map((s) => s.district).filter(Boolean);
  const allDistricts = [...new Set([...seedDistrictNames, ...shopDistrictNames])];

  // Areas: seed areas for selected district + areas from shops
  let allAreas;
  if (selectedDistrict) {
    const seedEntry = seedDistricts.find((d) => d.district === selectedDistrict);
    const seedAreas = seedEntry?.areas || [];
    const shopAreas = shops
      .filter((s) => s.district === selectedDistrict)
      .map((s) => s.areaTag)
      .filter(Boolean);
    allAreas = [...new Set([...seedAreas, ...shopAreas])];
  } else {
    const allSeedAreas = seedDistricts.flatMap((d) => d.areas);
    const allShopAreas = shops.map((s) => s.areaTag).filter(Boolean);
    allAreas = [...new Set([...allSeedAreas, ...allShopAreas])];
  }

  fillSelect(els.districtSelect, allDistricts, "全部");
  fillSelect(els.areaSelect, allAreas, "全部");
  fillSelect(els.mDistrictSelect, allDistricts, "地區");
  fillSelect(els.mAreaSelect, allAreas, "商圈 / 路段");
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

  if (defaultMap?.lat && defaultMap?.lng) {
    state.map.setView([defaultMap.lat, defaultMap.lng], defaultMap.zoom || 12);
  }

  renderShops(true);
  invalidateMapSoon(150);

  els.dataUpdatedAt.textContent = `資料更新：${new Date(updatedAt).toLocaleDateString("zh-Hant")}`;
}

function setFiltersEnabled(enabled) {
  const targets = [
    els.keywordInput, els.districtSelect, els.areaSelect, els.styleSelect,
    els.ratingSelect, els.priceSelect, els.sortCountBtn, els.chipSearch,
    els.mDistrictSelect, els.mAreaSelect, els.mStyleSelect, els.mPriceSelect,
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
      if (isOpen && window.ramenTracking && state.selectedShopId) {
        const activeShop = state.regionData?.shops?.find(
          (s) => s.shopId === state.selectedShopId
        );
        if (activeShop) {
          window.ramenTracking.trackShopClick(
            { ...activeShop, region: state.currentRegionCode },
            "detail"
          );
        }
      }
      // 展開/收合詳情面板後重算地圖尺寸
      invalidateMapSoon(100);
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
  els.mPriceSelect.addEventListener("change", () => {
    els.priceSelect.value = els.mPriceSelect.value;
    const resultCount = renderShops(true);
    trackPriceFilterChange(resultCount);
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
  els.priceSelect.addEventListener("change", () => {
    els.mPriceSelect.value = els.priceSelect.value;
    const resultCount = renderShops(true);
    trackPriceFilterChange(resultCount);
  });
  els.sortCountBtn.addEventListener("click", () => {
    state.sortByCount = !state.sortByCount;
    els.sortCountBtn.classList.toggle("is-active", state.sortByCount);
    renderShops(true);
  });

  // window resize debounce 重算地圖尺寸
  let _resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => invalidateMapSoon(0), 200);
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
