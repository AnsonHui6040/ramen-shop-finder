/**
 * tracking.js — 匿名化使用事件收集模組
 *
 * 不收集姓名、電話、Email 等可直接識別個人的資料。
 * 若 window.COLLECT_API_URL 未設定，所有追蹤功能自動停用，不影響網站功能。
 * 若 API 發送失敗，只 console.warn，不阻擋任何使用者操作。
 */
(() => {
  const SESSION_KEY = "ramen_shop_finder_session_id";
  const SOURCE = "ramen-shop-finder";
  const APP_VERSION = "1.0.0";

  /** 取得或建立匿名 session ID，存於 localStorage */
  function getSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      // localStorage 不可用時回退（隱私模式等）
      return crypto.randomUUID();
    }
  }

  /**
   * 送出事件至 COLLECT_API_URL
   * @param {string} eventType
   * @param {object} payload
   */
  function trackEvent(eventType, payload) {
    const apiUrl = window.COLLECT_API_URL;
    if (!apiUrl) return; // 未設定 API URL → 停用追蹤

    const body = JSON.stringify({
      eventType,
      sessionId: getSessionId(),
      createdAt: new Date().toISOString(),
      source: SOURCE,
      appVersion: APP_VERSION,
      page: location.pathname,
      payload,
    });

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true, // 確保使用者跳頁時仍能送出
    }).catch((err) => {
      console.warn("[tracking] 無法送出事件，網站功能不受影響。", err);
    });
  }

  /**
   * 建立 shop_click / map_click 共用的店家基礎欄位
   * @param {object} shop
   * @param {string} clickTarget
   */
  function buildShopBase(shop, clickTarget) {
    const payload = {
      shopId: shop.shopId || `${shop.name || ""}_${shop.address || ""}`,
      shopName: shop.name || shop.nameOriginal || "",
      styleCode: shop.styleCode || "",
      styleName: shop.style4char || "",
      region: shop.region || "",
      district: shop.district || "",
      clickTarget,
    };
    // 只在值為有效數字時附加，避免送出 NaN
    if (typeof shop.rating === "number" && !Number.isNaN(shop.rating)) {
      payload.rating = shop.rating;
    }
    if (typeof shop.ratingCount === "number" && !Number.isNaN(shop.ratingCount)) {
      payload.ratingCount = shop.ratingCount;
    }
    if (typeof shop.priceMin === "number" && !Number.isNaN(shop.priceMin)) {
      payload.priceMin = shop.priceMin;
    }
    if (typeof shop.priceMax === "number" && !Number.isNaN(shop.priceMax)) {
      payload.priceMax = shop.priceMax;
    }
    if (shop.priceRangeLabel) {
      payload.priceRangeLabel = shop.priceRangeLabel;
    }
    return payload;
  }

  /**
   * 追蹤店家卡片 / 詳情 / 列表項目點擊
   * @param {object} shop  - 店家資料物件
   * @param {string} clickTarget - "card" | "detail" | "list_item"
   */
  function trackShopClick(shop, clickTarget) {
    trackEvent("shop_click", buildShopBase(shop, clickTarget));
  }

  /**
   * 追蹤 Google Maps / 導航連結點擊
   * @param {object} shop
   * @param {string} [clickTarget] - "google_maps" | "navigation" | "map_link"
   * @param {string} [mapUrl]      - 實際被點擊的 href（優先使用）
   */
  function trackMapClick(shop, clickTarget, mapUrl) {
    trackEvent("map_click", {
      ...buildShopBase(shop, clickTarget || "google_maps"),
      mapUrl: mapUrl || shop.mapUrl || "",
    });
  }

  function trackFilterChange(payload) {
    trackEvent("filter_change", payload);
  }

  // 掛載至全域，供 app.js 呼叫
  window.ramenTracking = { trackShopClick, trackMapClick, trackFilterChange };
})();
