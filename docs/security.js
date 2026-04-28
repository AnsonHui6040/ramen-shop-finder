(() => {
  const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

  function isSafeExternalUrl(rawUrl) {
    if (!rawUrl) return false;

    try {
      const url = new URL(rawUrl, window.location.origin);
      return ALLOWED_PROTOCOLS.has(url.protocol);
    } catch {
      return false;
    }
  }

  function hardenLink(link) {
    const href = link.getAttribute("href") || "";

    if (!isSafeExternalUrl(href)) {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.setAttribute("title", "此連結格式不安全，已被停用");
      return;
    }

    if (link.target === "_blank") {
      link.rel = "noopener noreferrer";
    }
  }

  function hardenExistingLinks(root = document) {
    root.querySelectorAll?.("a[href]").forEach(hardenLink);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link) return;

    if (!isSafeExternalUrl(link.getAttribute("href"))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches("a[href]")) hardenLink(node);
        hardenExistingLinks(node);
      });
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => hardenExistingLinks());
  } else {
    hardenExistingLinks();
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
