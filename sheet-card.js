// sheet-card.js
// v0.3.6 + event bus + fire-dom-event support
// - badge outside <ha-card> via wrapper
// - portal overlay
// - launcher_style sub-blocks
// - badge JS template
// - open_button via HA state_changed
// - global event bus with sheet_id
// - Lovelace fire-dom-event / ll-custom support
//
// Supported triggers:
// 1) window.dispatchEvent(new CustomEvent("sheet-card:open",   { detail: "shopping" }))
// 2) window.dispatchEvent(new CustomEvent("sheet-card:close",  { detail: "shopping" }))
// 3) window.dispatchEvent(new CustomEvent("sheet-card:toggle", { detail: "shopping" }))
// 4) tap_action:
//      action: fire-dom-event
//      sheet_card:
//        action: open
//        id: shopping

const CARD_NAME = "sheet-card";
const VERSION = "0.3.6+event_bus_dom";

const PORTAL_CSS = `
[data-sheet-uid="__UID__"]{
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
}
[data-sheet-uid="__UID__"].visible{ display:block; }

[data-sheet-uid="__UID__"] #scrim{
  position:absolute;
  inset:0;
  opacity:0;
  transition: opacity var(--sheet-ms) ease;
}
[data-sheet-uid="__UID__"].opened #scrim{ opacity:1; }

[data-sheet-uid="__UID__"] #panel{
  position:absolute;
  background: var(--ha-card-background, var(--card-background-color, #fff));
  border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
  box-shadow: 0 10px 35px rgba(0,0,0,0.35);
  overflow: hidden;
  display:flex;
  flex-direction:column;
  transform: translate3d(0,0,0);
  transition: transform var(--sheet-ms) var(--sheet-ease);
  will-change: transform;
  touch-action: none;
}

[data-sheet-uid="__UID__"] .handle-wrap{
  display:flex;
  justify-content:center;
  align-items:center;
  padding:10px 0 6px 0;
}
[data-sheet-uid="__UID__"] .handle{ background: rgba(127,127,127,0.5); }

[data-sheet-uid="__UID__"].edge-top .handle,
[data-sheet-uid="__UID__"].edge-bottom .handle{
  width:44px;height:5px;border-radius:999px;
}

[data-sheet-uid="__UID__"].edge-left .handle-wrap,
[data-sheet-uid="__UID__"].edge-right .handle-wrap{
  position:absolute; top:50%; transform: translateY(-50%);
  padding:0; width:22px; height:64px;
}
[data-sheet-uid="__UID__"].edge-left .handle-wrap { right: 8px; left: auto; }
[data-sheet-uid="__UID__"].edge-right .handle-wrap { left: 8px; right: auto; }

[data-sheet-uid="__UID__"].edge-left .handle,
[data-sheet-uid="__UID__"].edge-right .handle{
  width:5px;height:44px;border-radius:999px;
}

[data-sheet-uid="__UID__"] .panel-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:10px 10px 10px 14px;
  border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
  position: sticky;
  top: 0;
  background: inherit;
  z-index:1;
}
[data-sheet-uid="__UID__"] .panel-title{
  font-size:14px;font-weight:700;line-height:1.2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
[data-sheet-uid="__UID__"] .panel-body{
  overflow:auto;
  -webkit-overflow-scrolling: touch;
}

[data-sheet-uid="__UID__"].edge-right #panel{ top: var(--sheet-inset); bottom: var(--sheet-inset); right: var(--sheet-inset); left:auto; }
[data-sheet-uid="__UID__"].edge-left  #panel{ top: var(--sheet-inset); bottom: var(--sheet-inset); left: var(--sheet-inset); right:auto; }
[data-sheet-uid="__UID__"].edge-bottom #panel{ left: var(--sheet-inset); right: var(--sheet-inset); bottom: var(--sheet-inset); top:auto; }
[data-sheet-uid="__UID__"].edge-top    #panel{ left: var(--sheet-inset); right: var(--sheet-inset); top: var(--sheet-inset); bottom:auto; }

[data-sheet-uid="__UID__"].edge-right #panel{ transform: translateX(calc(100% + var(--sheet-inset))); }
[data-sheet-uid="__UID__"].edge-left  #panel{ transform: translateX(calc(-100% - var(--sheet-inset))); }
[data-sheet-uid="__UID__"].edge-bottom #panel{ transform: translateY(calc(100% + var(--sheet-inset))); }
[data-sheet-uid="__UID__"].edge-top    #panel{ transform: translateY(calc(-100% - var(--sheet-inset))); }

[data-sheet-uid="__UID__"].opened.edge-right #panel,
[data-sheet-uid="__UID__"].opened.edge-left  #panel,
[data-sheet-uid="__UID__"].opened.edge-bottom #panel,
[data-sheet-uid="__UID__"].opened.edge-top    #panel{
  transform: translate3d(0,0,0);
}

[data-sheet-uid="__UID__"].edge-right #panel,
[data-sheet-uid="__UID__"].edge-left  #panel{
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
[data-sheet-uid="__UID__"].edge-bottom #panel{ padding-bottom: env(safe-area-inset-bottom); }
[data-sheet-uid="__UID__"].edge-top    #panel{ padding-top: env(safe-area-inset-top); }
`;

const DEFAULTS = {
  title: "Sheet",
  hint: "",
  icon: "",
  edge: "right",
  width: 420,
  height: "60vh",
  radius: 20,
  inset: 8,

  panel_background: "",
  panel_backdrop_filter: "",
  scrim: true,
  scrim_opacity: 0.35,
  scrim_blur: 0,
  scrim_color: "0,0,0",
  scrim_style: "",

  close_on_esc: true,
  close_on_scrim: true,
  auto_close_on_navigation: true,

  show_header: true,
  show_close: true,
  show_handle: true,

  drag_to_close: true,
  drag_handle_only: false,
  drag_threshold: 0.28,
  drag_velocity: 900,

  content_padding: 0,
  transition_ms: 240,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  open_on: "card",

  launcher_style: "",
  launcher_class: "",
  panel_style: "",

  launcher_mode: "default",
  launcher_size: 45,
  launcher_radius: 10,
  launcher_show_chevron: true,

  badge_template: "",
  badge_style: "",

  open_button: "",
  sheet_id: "",

  card: { type: "entities", entities: [] },
};

function toCssSize(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return `${v}px`;
  return String(v).trim();
}

function clampNumber(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function evalBadgeTemplate(template, ctx) {
  if (!template) return "";
  let body = String(template).trim();
  const m = body.match(/^\[\[\[\s*([\s\S]*?)\s*\]\]\]$/);
  if (m) body = m[1];

  try {
    const fn = new Function("hass", "config", "states", "entity", `"use strict";\n${body}`);
    const hass = ctx?.hass || null;
    const states = hass?.states || {};
    const entity = (entityId) => states?.[entityId];
    const out = fn(hass, ctx?.config || {}, states, entity);
    if (out === null || out === undefined) return "";
    return String(out);
  } catch (_) {
    return "";
  }
}

function parseLauncherStyle(input) {
  const raw = String(input || "").trim();
  const blocks = new Map();
  if (!raw) return { base: "", blocks };

  const re = /([.#]?[a-zA-Z0-9_-]+(?:\s*[.#]?[a-zA-Z0-9_-]+)*)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (selector && body) blocks.set(selector, body);
  }

  const base = raw.replace(re, "").trim();
  return { base, blocks };
}

function cssJoin(a, b) {
  const aa = String(a || "").trim();
  const bb = String(b || "").trim();
  if (aa && bb) return `${aa};${bb}`;
  return aa || bb || "";
}

function setStyleText(el, cssText) {
  if (!el) return;
  const t = String(cssText || "").trim();
  if (!t) el.removeAttribute("style");
  else el.setAttribute("style", t);
}

class SheetCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: `custom:${CARD_NAME}`,
      title: "Sheet",
      icon: "mdi:menu",
      edge: "right",
      width: 420,
      radius: 20,
      inset: 8,
      launcher_mode: "default",
      badge_template: '[[[ return "3" ]]]',
      open_button: "",
      sheet_id: "",
      card: { type: "entities", entities: [] },
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._config = null;
    this._hass = null;
    this._helpers = null;
    this._cardEl = null;

    this._open = false;
    this._closing = false;
    this._closeTimer = null;

    this._uid = Math.random().toString(36).slice(2, 10);
    this._els = {};

    this._portalActive = false;
    this._portalOriginalParent = null;
    this._portalNextSibling = null;
    this._portalStyleEl = null;

    this._launcherBlocks = new Map();

    this._openButtonUnsub = null;
    this._openButtonLastPressedRaw = null;
    this._openButtonRetry = null;

    this._onSheetOpenEvent = (ev) => this._handleSheetBusEvent("open", ev);
    this._onSheetCloseEvent = (ev) => this._handleSheetBusEvent("close", ev);
    this._onSheetToggleEvent = (ev) => this._handleSheetBusEvent("toggle", ev);

    this._onLlCustomEvent = (ev) => this._handleLovelaceDomEvent(ev);
    this._onFireDomEvent = (ev) => this._handleLovelaceDomEvent(ev);

    this._onNavClose = () => {
      if (this._cfg("auto_close_on_navigation") === false) return;
      if (this._open) this.close();
    };
    this._onPopStateClose = () => this._onNavClose();

    this._drag = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startT: 0,
      axis: "x",
      closingDir: 1,
      size: 1,
    };

    this._onKeyDown = (ev) => {
      if (!this._open) return;
      if (ev.key === "Escape" && this._cfg("close_on_esc") !== false) this.close();
    };

    this._onOverlayClick = (ev) => {
      if (!this._open) return;
      if (this._cfg("close_on_scrim") === false) return;
      if (ev.target?.id === "scrim") this.close();
    };

    this._onOpenFromCard = () => {
      if (this._cfg("open_on") === "icon") return;
      this.open();
    };

    this._onOpenFromIcon = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.open();
    };

    this._onCloseClick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.close();
    };

    this._onPointerDown = (ev) => this._dragStart(ev);
    this._onPointerMove = (ev) => this._dragMove(ev);
    this._onPointerUp = (ev) => this._dragEnd(ev);
    this._onPointerCancel = (ev) => this._dragEnd(ev);
  }

  setConfig(config) {
    if (!config || !config.card) throw new Error("sheet-card: Missing required `card:` config.");
    this._config = Object.freeze({ ...DEFAULTS, ...config });
    this._open = false;
    this._closing = false;
    this._openButtonLastPressedRaw = null;

    this._ensureBaseRender();
    this._buildOrUpdateInnerCard();
    this._render();

    this._stopOpenButtonWatcher();
    this._startOpenButtonWatcher();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._cardEl) this._cardEl.hass = hass;
    if (this._config?.badge_template) this._renderBadge();
  }

  connectedCallback() {
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("location-changed", this._onNavClose);
    window.addEventListener("popstate", this._onPopStateClose);

    window.addEventListener("sheet-card:open", this._onSheetOpenEvent);
    window.addEventListener("sheet-card:close", this._onSheetCloseEvent);
    window.addEventListener("sheet-card:toggle", this._onSheetToggleEvent);

    window.addEventListener("ll-custom", this._onLlCustomEvent);
    window.addEventListener("fire-dom-event", this._onFireDomEvent);
    document.addEventListener("ll-custom", this._onLlCustomEvent);
    document.addEventListener("fire-dom-event", this._onFireDomEvent);

    this._startOpenButtonWatcher();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("location-changed", this._onNavClose);
    window.removeEventListener("popstate", this._onPopStateClose);

    window.removeEventListener("sheet-card:open", this._onSheetOpenEvent);
    window.removeEventListener("sheet-card:close", this._onSheetCloseEvent);
    window.removeEventListener("sheet-card:toggle", this._onSheetToggleEvent);

    window.removeEventListener("ll-custom", this._onLlCustomEvent);
    window.removeEventListener("fire-dom-event", this._onFireDomEvent);
    document.removeEventListener("ll-custom", this._onLlCustomEvent);
    document.removeEventListener("fire-dom-event", this._onFireDomEvent);

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
    this._closing = false;

    this._stopOpenButtonWatcher();
    this._portalDetach();
  }

  getCardSize() {
    return 1;
  }

  _cfg(key) {
    return this._config?.[key];
  }

  _el(id) {
    return this._els?.[id] || this.shadowRoot?.getElementById(id) || null;
  }

  _getSheetBusId() {
    return String(this._cfg("sheet_id") || "").trim();
  }

  _extractEventId(ev) {
    const d = ev?.detail;
    if (typeof d === "string") return d.trim();
    if (d && typeof d === "object" && typeof d.id === "string") return d.id.trim();
    return "";
  }

  _handleSheetBusEvent(action, ev) {
    const myId = this._getSheetBusId();
    if (!myId) return;

    const targetId = this._extractEventId(ev);
    if (!targetId || targetId !== myId) return;

    if (action === "open") {
      if (!this._open) this.open();
      return;
    }
    if (action === "close") {
      if (this._open) this.close();
      return;
    }
    if (action === "toggle") {
      if (this._open) this.close();
      else this.open();
    }
  }

  _handleLovelaceDomEvent(ev) {
    const myId = this._getSheetBusId();
    if (!myId) return;

    const d = ev?.detail;
    if (!d || typeof d !== "object") return;

    const sc = d.sheet_card;
    if (!sc || typeof sc !== "object") return;

    const targetId = String(sc.id || "").trim();
    if (!targetId || targetId !== myId) return;

    const action = String(sc.action || "open").trim().toLowerCase();

    try { ev.stopPropagation?.(); } catch (_) {}

    if (action === "open") {
      if (!this._open) this.open();
      return;
    }
    if (action === "close") {
      if (this._open) this.close();
      return;
    }
    if (action === "toggle") {
      if (this._open) this.close();
      else this.open();
    }
  }

  _resolveHass() {
    if (this._hass) return this._hass;

    try {
      let node = this;
      for (let i = 0; i < 40 && node; i++) {
        if (node.hass) {
          this._hass = node.hass;
          return this._hass;
        }
        if (node.parentNode) {
          node = node.parentNode;
          continue;
        }
        const root = node.getRootNode?.();
        node = root?.host || null;
      }
    } catch (_) {}

    try {
      const ha = document.querySelector("home-assistant");
      if (ha?.hass) return (this._hass = ha.hass);

      const main = ha?.shadowRoot?.querySelector("home-assistant-main");
      if (main?.hass) return (this._hass = main.hass);

      const lovelace = main?.shadowRoot?.querySelector("ha-panel-lovelace");
      if (lovelace?.hass) return (this._hass = lovelace.hass);

      const root = lovelace?.shadowRoot?.querySelector("hui-root");
      if (root?.hass) return (this._hass = root.hass);
    } catch (_) {}

    return null;
  }

  _startOpenButtonWatcher() {
    const id = String(this._cfg("open_button") || "").trim();
    if (!id) return;

    this._stopOpenButtonWatcher();

    const trySubscribe = () => {
      const hass = this._resolveHass() || document.querySelector("home-assistant")?.hass || null;
      const conn = hass?.connection || null;

      const cur = hass?.states?.[id];
      const curRaw = cur?.attributes?.last_pressed ?? cur?.state;
      if (this._openButtonLastPressedRaw === null && curRaw !== undefined && curRaw !== null) {
        this._openButtonLastPressedRaw = String(curRaw);
      }

      if (!conn?.subscribeEvents) return false;

      this._openButtonUnsub = conn.subscribeEvents((ev) => {
        const ent = ev?.data?.entity_id;
        if (ent !== id) return;

        const raw = ev?.data?.new_state?.attributes?.last_pressed ?? ev?.data?.new_state?.state;
        if (raw === undefined || raw === null) return;

        const rawStr = String(raw);

        if (this._openButtonLastPressedRaw === null) {
          this._openButtonLastPressedRaw = rawStr;
          return;
        }

        if (rawStr !== this._openButtonLastPressedRaw) {
          this._openButtonLastPressedRaw = rawStr;
          if (!this._open) this.open();
        }
      }, "state_changed");

      return true;
    };

    const ok = trySubscribe();
    if (ok) return;

    let attempts = 0;
    this._openButtonRetry = window.setInterval(() => {
      attempts++;
      if (trySubscribe() || attempts > 40) {
        if (this._openButtonRetry) {
          clearInterval(this._openButtonRetry);
          this._openButtonRetry = null;
        }
      }
    }, 250);
  }

  _stopOpenButtonWatcher() {
    if (this._openButtonRetry) {
      clearInterval(this._openButtonRetry);
      this._openButtonRetry = null;
    }

    if (this._openButtonUnsub) {
      try {
        const u = this._openButtonUnsub;
        this._openButtonUnsub = null;
        const ret = (typeof u === "function") ? u() : null;
        void ret;
      } catch (_) {
        this._openButtonUnsub = null;
      }
    }

    this._openButtonLastPressedRaw = null;
  }

  _ensurePortalStyle() {
    if (this._portalStyleEl) return;
    const style = document.createElement("style");
    style.setAttribute("data-sheet-uid", this._uid);
    style.textContent = PORTAL_CSS.replaceAll("__UID__", this._uid);
    document.head.appendChild(style);
    this._portalStyleEl = style;
  }

  _portalAttach() {
    const overlay = this._el("overlay");
    if (!overlay || this._portalActive) return;

    this._ensurePortalStyle();

    this._portalOriginalParent = overlay.parentElement;
    this._portalNextSibling = overlay.nextSibling;

    document.body.appendChild(overlay);
    this._portalActive = true;
  }

  _portalDetach() {
    const overlay = this._el("overlay");
    if (!overlay || !this._portalActive) return;

    const parent = this._portalOriginalParent;
    if (parent) {
      if (this._portalNextSibling && this._portalNextSibling.parentNode === parent) {
        parent.insertBefore(overlay, this._portalNextSibling);
      } else {
        parent.appendChild(overlay);
      }
    }

    this._portalOriginalParent = null;
    this._portalNextSibling = null;
    this._portalActive = false;
  }

  async _loadHelpers() {
    if (this._helpers) return this._helpers;
    if (!window.loadCardHelpers) throw new Error("sheet-card: window.loadCardHelpers() not found.");
    this._helpers = await window.loadCardHelpers();
    return this._helpers;
  }

  async _buildOrUpdateInnerCard() {
    if (!this._config) return;
    const helpers = await this._loadHelpers();
    const cardConfig = this._config.card;

    this._cardEl = helpers.createCardElement(cardConfig);
    const hass = this._resolveHass();
    if (hass) this._cardEl.hass = hass;

    this._cardEl.addEventListener("ll-rebuild", () => {
      this._cardEl = null;
      this._buildOrUpdateInnerCard();
      this._render();
    });
  }

  open() {
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
    this._closing = false;

    this._portalAttach();
    this._open = true;

    const overlay = this._el("overlay");
    if (overlay) overlay.style.pointerEvents = "auto";

    this._render();
    requestAnimationFrame(() => {
      this._el("overlay")?.classList.add("opened");
    });
  }

  close() {
    if (!this._open || this._closing) return;
    this._closing = true;

    const overlay = this._el("overlay");
    const panel = this._el("panel");

    if (overlay) overlay.style.pointerEvents = "none";

    if (panel) {
      panel.style.transition = "";
      panel.style.transform = "";
    }

    overlay?.classList.remove("opened");

    const ms = clampNumber(this._cfg("transition_ms"), 0, 2000, 240);

    if (this._closeTimer) clearTimeout(this._closeTimer);
    this._closeTimer = window.setTimeout(() => {
      this._open = false;
      overlay?.classList.remove("visible");

      this._render();
      this._portalDetach();

      if (overlay) overlay.style.pointerEvents = "auto";
      this._closing = false;
      this._closeTimer = null;
    }, ms);
  }

  _ensureBaseRender() {
    if (!this.shadowRoot) return;
    if (this.shadowRoot.getElementById("root")) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }

        .launcher-wrap{
          position: relative;
          display: inline-block;
          overflow: visible;
        }

        ha-card.launcher{
          cursor: pointer;
          overflow: visible;
          position: relative;
          border-radius: var(--ha-card-border-radius, 12px);
        }

        .launcher-inner{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:12px 14px;
        }

        .launcher-left{
          display:flex;
          align-items:center;
          gap:12px;
          min-width:0;
        }

        ha-icon.launcher-icon{ opacity:0.95; }

        .launcher-text{ min-width:0; }
        .launcher-title{
          font-size:14px;
          font-weight:600;
          line-height:1.2;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .launcher-hint{
          font-size:12px;
          opacity:0.7;
          margin-top:3px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        ha-icon-button.open-btn{ opacity:0.85; }

        ha-card.launcher.icon-mode .launcher-inner{
          padding:0;
          width: var(--launcher-size);
          height: var(--launcher-size);
          display:flex;
          align-items:center;
          justify-content:center;
        }
        ha-card.launcher.icon-mode .launcher-left{ gap:0; }
        ha-card.launcher.icon-mode ha-icon.launcher-icon{
          --mdc-icon-size: 22px;
        }
        ha-card.launcher.icon-mode .launcher-text{ display:none !important; }
        ha-card.launcher.icon-mode ha-icon-button.open-btn{ display:none !important; }

        .badge{
          position:absolute;
          top:-6px;
          right:-6px;
          min-width:18px;
          height:18px;
          padding:0 6px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:700;
          line-height:1;
          background: var(--error-color, #db4437);
          color: var(--text-primary-color, #fff);
          border: 2px solid var(--ha-card-background, var(--card-background-color, #fff));
          box-sizing:border-box;
          user-select:none;
          pointer-events:none;
          z-index: 10;
        }
        .badge.hidden{ display:none; }

        #overlay{
          position: fixed;
          inset:0;
          z-index:9999;
          display:none;
          pointer-events:auto;
        }
        #overlay.visible{ display:block; }

        #scrim{
          position:absolute;
          inset:0;
          opacity:0;
          transition: opacity var(--sheet-ms) ease;
        }
        #overlay.opened #scrim{ opacity:1; }

        #panel{
          position:absolute;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          box-shadow: 0 10px 35px rgba(0,0,0,0.35);
          overflow: hidden;
          display:flex;
          flex-direction:column;
          transform: translate3d(0,0,0);
          transition: transform var(--sheet-ms) var(--sheet-ease);
          will-change: transform;
          touch-action:none;
        }

        .handle-wrap{
          display:flex;
          justify-content:center;
          align-items:center;
          padding:10px 0 6px 0;
        }
        .handle{ background: rgba(127,127,127,0.5); }

        #overlay.edge-top .handle,
        #overlay.edge-bottom .handle{
          width:44px;height:5px;border-radius:999px;
        }

        #overlay.edge-left .handle-wrap,
        #overlay.edge-right .handle-wrap{
          position:absolute; top:50%; transform: translateY(-50%);
          padding:0; width:22px; height:64px;
        }
        #overlay.edge-left .handle-wrap { right: 8px; left: auto; }
        #overlay.edge-right .handle-wrap { left: 8px; right: auto; }

        #overlay.edge-left .handle,
        #overlay.edge-right .handle{
          width:5px;height:44px;border-radius:999px;
        }

        .panel-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          padding:10px 10px 10px 14px;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          position: sticky;
          top: 0;
          background: inherit;
          z-index:1;
        }
        .panel-title{
          font-size:14px;font-weight:700;line-height:1.2;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        }
        .panel-body{
          overflow:auto;
          -webkit-overflow-scrolling: touch;
        }

        #overlay.edge-right #panel{ top: var(--sheet-inset); bottom: var(--sheet-inset); right: var(--sheet-inset); left:auto; }
        #overlay.edge-left  #panel{ top: var(--sheet-inset); bottom: var(--sheet-inset); left: var(--sheet-inset); right:auto; }
        #overlay.edge-bottom #panel{ left: var(--sheet-inset); right: var(--sheet-inset); bottom: var(--sheet-inset); top:auto; }
        #overlay.edge-top    #panel{ left: var(--sheet-inset); right: var(--sheet-inset); top: var(--sheet-inset); bottom:auto; }

        #overlay.edge-right #panel{ transform: translateX(calc(100% + var(--sheet-inset))); }
        #overlay.edge-left  #panel{ transform: translateX(calc(-100% - var(--sheet-inset))); }
        #overlay.edge-bottom #panel{ transform: translateY(calc(100% + var(--sheet-inset))); }
        #overlay.edge-top    #panel{ transform: translateY(calc(-100% - var(--sheet-inset))); }

        #overlay.opened.edge-right #panel,
        #overlay.opened.edge-left  #panel,
        #overlay.opened.edge-bottom #panel,
        #overlay.opened.edge-top    #panel{
          transform: translate3d(0,0,0);
        }

        #overlay.edge-right #panel,
        #overlay.edge-left  #panel{
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
        #overlay.edge-bottom #panel{ padding-bottom: env(safe-area-inset-bottom); }
        #overlay.edge-top    #panel{ padding-top: env(safe-area-inset-top); }
      </style>

      <div id="root">
        <div class="launcher-wrap" id="launcherWrap">
          <ha-card class="launcher" id="launcher">
            <div class="launcher-inner" id="launcherInner">
              <div class="launcher-left">
                <ha-icon class="launcher-icon" id="launcherIcon"></ha-icon>
                <div class="launcher-text">
                  <div class="launcher-title" id="launcherTitle"></div>
                  <div class="launcher-hint" id="launcherHint"></div>
                </div>
              </div>
              <ha-icon-button class="open-btn" id="openBtn" title="Open"></ha-icon-button>
            </div>
          </ha-card>

          <div class="badge hidden" id="badge"></div>
        </div>

        <div id="overlay">
          <div id="scrim"></div>
          <div id="panel">
            <div class="handle-wrap" id="handleWrap"><div class="handle"></div></div>
            <div class="panel-header" id="header">
              <div class="panel-title" id="panelTitle"></div>
              <ha-icon-button id="closeBtn" title="Close"></ha-icon-button>
            </div>
            <div class="panel-body" id="panelBody"></div>
          </div>
        </div>
      </div>
    `;

    this._els = {
      launcherWrap: this._el("launcherWrap"),
      launcher: this._el("launcher"),
      launcherInner: this._el("launcherInner"),
      launcherIcon: this._el("launcherIcon"),
      launcherTitle: this._el("launcherTitle"),
      launcherHint: this._el("launcherHint"),
      openBtn: this._el("openBtn"),
      badge: this._el("badge"),
      overlay: this._el("overlay"),
      scrim: this._el("scrim"),
      panel: this._el("panel"),
      handleWrap: this._el("handleWrap"),
      header: this._el("header"),
      panelTitle: this._el("panelTitle"),
      closeBtn: this._el("closeBtn"),
      panelBody: this._el("panelBody"),
    };

    if (this._els.overlay) this._els.overlay.setAttribute("data-sheet-uid", this._uid);

    this._el("launcher")?.addEventListener("click", this._onOpenFromCard);
    this._el("openBtn")?.addEventListener("click", this._onOpenFromIcon);
    this._el("closeBtn")?.addEventListener("click", this._onCloseClick);
    this._el("overlay")?.addEventListener("click", this._onOverlayClick);

    const panel = this._el("panel");
    panel?.addEventListener("pointerdown", this._onPointerDown);
    panel?.addEventListener("pointermove", this._onPointerMove);
    panel?.addEventListener("pointerup", this._onPointerUp);
    panel?.addEventListener("pointercancel", this._onPointerCancel);
  }

  _renderBadge() {
    const badgeEl = this._el("badge");
    if (!badgeEl || !this._config) return;

    const tpl = String(this._cfg("badge_template") || "").trim();
    if (!tpl) {
      badgeEl.classList.add("hidden");
      badgeEl.textContent = "";
      badgeEl.removeAttribute("style");
      return;
    }

    const raw = evalBadgeTemplate(tpl, { hass: this._hass || this._resolveHass(), config: this._config });
    const text = String(raw || "").trim();

    if (!text) {
      badgeEl.classList.add("hidden");
      badgeEl.textContent = "";
      badgeEl.removeAttribute("style");
      return;
    }

    badgeEl.textContent = text;
    badgeEl.classList.remove("hidden");

    const b1 = this._launcherBlocks.get(".badge") || "";
    const b2 = String(this._cfg("badge_style") || "");
    const merged = cssJoin(b1, b2);
    if (merged.trim()) badgeEl.setAttribute("style", merged);
    else badgeEl.removeAttribute("style");
  }

  _render() {
    if (!this._config || !this.shadowRoot) return;

    const cfg = this._config;
    const edge = (cfg.edge ?? DEFAULTS.edge).toLowerCase();

    const title = cfg.title ?? DEFAULTS.title;
    const hint = cfg.hint ?? DEFAULTS.hint;
    const icon = (cfg.icon ?? DEFAULTS.icon).trim();

    const inset = toCssSize(cfg.inset ?? DEFAULTS.inset) || "0px";
    const radius = toCssSize(cfg.radius ?? DEFAULTS.radius) || "0px";
    const width = toCssSize(cfg.width ?? DEFAULTS.width);
    const height = toCssSize(cfg.height ?? DEFAULTS.height);

    const ms = clampNumber(cfg.transition_ms ?? DEFAULTS.transition_ms, 0, 2000, 240);
    const ease = String(cfg.easing ?? DEFAULTS.easing);

    const scrimEnabled = cfg.scrim !== false;
    const scrimOpacity = clampNumber(cfg.scrim_opacity ?? DEFAULTS.scrim_opacity, 0, 1, 0.35);
    const scrimBlur = clampNumber(cfg.scrim_blur ?? DEFAULTS.scrim_blur, 0, 20, 0);
    const scrimColor = String(cfg.scrim_color ?? DEFAULTS.scrim_color);

    const showHeader = cfg.show_header !== false;
    const showClose = cfg.show_close !== false;
    const showHandle = cfg.show_handle !== false;

    const contentPadding = clampNumber(cfg.content_padding ?? DEFAULTS.content_padding, 0, 80, 0);

    const launcherMode = String(cfg.launcher_mode ?? DEFAULTS.launcher_mode).toLowerCase();
    const launcherSize = clampNumber(cfg.launcher_size ?? DEFAULTS.launcher_size, 28, 200, 45);
    const launcherRadius = clampNumber(cfg.launcher_radius ?? DEFAULTS.launcher_radius, 0, 80, 10);

    const { base: launcherBase, blocks } = parseLauncherStyle(cfg.launcher_style || "");
    this._launcherBlocks = blocks;

    const launcher = this._el("launcher");
    const launcherClass = String(cfg.launcher_class ?? "").trim();
    launcher.className =
      `launcher${launcherClass ? " " + launcherClass : ""}` +
      (launcherMode === "icon" ? " icon-mode" : "");

    launcher.style.cssText = launcherBase || "";
    launcher.style.setProperty("--launcher-size", `${launcherSize}px`);

    if (launcherMode === "icon") {
      if (!/border-radius\s*:/.test(launcherBase)) launcher.style.borderRadius = `${launcherRadius}px`;
    }

    setStyleText(this._el("launcherIcon"), blocks.get(".launcher-icon") || "");
    setStyleText(this._el("launcherInner"), blocks.get(".launcher-inner") || "");
    setStyleText(this._el("launcherWrap"), blocks.get(".launcher-wrap") || "");

    const titleEl = this._el("launcherTitle");
    const hintEl = this._el("launcherHint");
    const iconEl = this._el("launcherIcon");
    const openBtn = this._el("openBtn");

    if (launcherMode === "icon") {
      titleEl.textContent = "";
      hintEl.textContent = "";
      hintEl.style.display = "none";
    } else {
      titleEl.textContent = title;
      hintEl.textContent = hint;
      hintEl.style.display = hint ? "block" : "none";
    }

    if (icon) {
      iconEl.style.display = "block";
      iconEl.setAttribute("icon", icon);
    } else {
      iconEl.style.display = "none";
    }

    const showChevron = (cfg.launcher_show_chevron ?? DEFAULTS.launcher_show_chevron) !== false;
    if (launcherMode === "icon") {
      openBtn.style.display = "none";
    } else {
      openBtn.style.display = showChevron ? "inline-flex" : "none";
      openBtn.setAttribute("icon", "mdi:chevron-right");
    }

    const overlay = this._el("overlay");
    overlay.className = "";
    overlay.classList.add(`edge-${edge}`);
    if (this._open) overlay.classList.add("visible");

    overlay.style.setProperty("--sheet-inset", inset);
    overlay.style.setProperty("--sheet-ms", `${ms}ms`);
    overlay.style.setProperty("--sheet-ease", ease);

    const scrim = this._el("scrim");
    scrim.style.display = scrimEnabled ? "block" : "none";
    scrim.style.background = `rgba(${scrimColor},${scrimOpacity})`;
    scrim.style.backdropFilter = scrimBlur > 0 ? `blur(${scrimBlur}px)` : "none";
    const scrimStyle = String(cfg.scrim_style ?? DEFAULTS.scrim_style).trim();
    if (scrimStyle) scrim.style.cssText = cssJoin(scrim.style.cssText, scrimStyle);

    const panel = this._el("panel");
    panel.style.borderRadius = radius;

    const panelBg = String(cfg.panel_background ?? "").trim();
    panel.style.background = panelBg || "var(--ha-card-background, var(--card-background-color, #fff))";

    const panelBackdrop = String(cfg.panel_backdrop_filter ?? "").trim();
    panel.style.backdropFilter = panelBackdrop || "none";

    const panelStyle = String(cfg.panel_style ?? "").trim();
    if (panelStyle) panel.style.cssText = cssJoin(panel.style.cssText, panelStyle);

    if (edge === "left" || edge === "right") {
      if (!width || width === "100%") panel.style.width = "calc(100vw - (2 * var(--sheet-inset)))";
      else panel.style.width = `min(${width}, calc(100vw - (2 * var(--sheet-inset))))`;
      panel.style.height = "auto";
    } else {
      if (!height || height === "100%") panel.style.height = "calc(100vh - (2 * var(--sheet-inset)))";
      else panel.style.height = `min(${height}, calc(100vh - (2 * var(--sheet-inset))))`;
      panel.style.width = "auto";
    }

    const header = this._el("header");
    header.style.display = showHeader ? "flex" : "none";

    const closeBtn = this._el("closeBtn");
    closeBtn.style.display = showClose ? "inline-flex" : "none";
    closeBtn.setAttribute("icon", "mdi:close");

    const handleWrap = this._el("handleWrap");
    handleWrap.style.display = showHandle ? "flex" : "none";

    this._el("panelTitle").textContent = title;

    const body = this._el("panelBody");
    body.style.padding = contentPadding > 0 ? `${contentPadding}px` : "0px";
    body.innerHTML = "";
    if (this._cardEl) body.appendChild(this._cardEl);

    this._renderBadge();
  }

  _dragStart(ev) {
    if (!this._open) return;
    if (this._cfg("drag_to_close") === false) return;

    const panel = this._el("panel");
    const handleWrap = this._el("handleWrap");
    if (!panel) return;

    if (this._cfg("drag_handle_only") === true) {
      if (!handleWrap || !handleWrap.contains(ev.target)) return;
    }

    panel.setPointerCapture(ev.pointerId);

    const edge = (this._cfg("edge") ?? "right").toLowerCase();
    const axis = (edge === "left" || edge === "right") ? "x" : "y";
    let closingDir = 1;
    if (edge === "left" || edge === "top") closingDir = -1;

    const rect = panel.getBoundingClientRect();
    const size = axis === "x" ? rect.width : rect.height;

    this._drag.active = true;
    this._drag.pointerId = ev.pointerId;
    this._drag.startX = ev.clientX;
    this._drag.startY = ev.clientY;
    this._drag.lastX = ev.clientX;
    this._drag.lastY = ev.clientY;
    this._drag.startT = performance.now();
    this._drag.axis = axis;
    this._drag.closingDir = closingDir;
    this._drag.size = Math.max(1, size);

    panel.style.transition = "none";
  }

  _dragMove(ev) {
    if (!this._drag.active) return;
    if (ev.pointerId !== this._drag.pointerId) return;

    const panel = this._el("panel");
    if (!panel) return;

    const dx = ev.clientX - this._drag.startX;
    const dy = ev.clientY - this._drag.startY;

    this._drag.lastX = ev.clientX;
    this._drag.lastY = ev.clientY;

    let delta = this._drag.axis === "x" ? dx : dy;
    delta = delta * this._drag.closingDir;

    const dampNeg = -Math.min(24, Math.abs(delta)) * 0.2;
    const effective = delta >= 0 ? delta : dampNeg;

    if (this._drag.axis === "x") panel.style.transform = `translateX(${effective * this._drag.closingDir}px)`;
    else panel.style.transform = `translateY(${effective * this._drag.closingDir}px)`;

    ev.preventDefault();
  }

  _dragEnd(ev) {
    if (!this._drag.active) return;
    if (ev.pointerId !== this._drag.pointerId) return;

    const panel = this._el("panel");
    if (!panel) return;

    const endT = performance.now();
    const dt = Math.max(1, endT - this._drag.startT);

    const dx = this._drag.lastX - this._drag.startX;
    const dy = this._drag.lastY - this._drag.startY;

    let delta = this._drag.axis === "x" ? dx : dy;
    const closingDelta = delta * this._drag.closingDir;

    const velocity = (closingDelta / dt) * 1000;
    const thresholdFrac = clampNumber(this._cfg("drag_threshold"), 0.05, 0.95, 0.28);
    const thresholdPx = this._drag.size * thresholdFrac;
    const velocityPxS = clampNumber(this._cfg("drag_velocity"), 100, 4000, 900);

    const ms = clampNumber(this._cfg("transition_ms"), 0, 2000, 240);
    const ease = String(this._cfg("easing") ?? DEFAULTS.easing);
    panel.style.transition = `transform ${ms}ms ${ease}`;

    const shouldClose = closingDelta > thresholdPx || velocity > velocityPxS;

    try { panel.releasePointerCapture(ev.pointerId); } catch (_) {}

    this._drag.active = false;
    this._drag.pointerId = null;

    if (shouldClose) this.close();
    else panel.style.transform = "";
  }
}

try {
  if (!customElements.get(CARD_NAME)) customElements.define(CARD_NAME, SheetCard);
} catch (e) {
  console.error("sheet-card: define failed", e);
}

try {
  window.customCards = window.customCards || [];
  const exists = window.customCards.some((c) => c?.type === `custom:${CARD_NAME}`);
  if (!exists) {
    window.customCards.push({
      type: `custom:${CARD_NAME}`,
      name: "Sheet Card (slide-in panel)",
      description: "Edge sheets with launcher modes + JS badge + portal overlay + event bus + fire-dom-event.",
      preview: false,
      version: VERSION,
    });
  }
} catch (e) {
  console.error("sheet-card: customCards metadata failed", e);
}