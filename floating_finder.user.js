// ==UserScript==
// @name         Floating DevTools Button Finder (Exact + Pro)
// @namespace    devtools.floating.finder.exact.pro
// @version      2.1
// @description  Permanent floating finder with drag, resize, search, theme, hotkeys, persistence
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    if (window.__FLOAT_EXACT_PRO__) return;
    window.__FLOAT_EXACT_PRO__ = true;

    /* ---------- STORAGE ---------- */
    const store = {
        get(k, d) { 
            try { 
                return JSON.parse(localStorage.getItem(k)) ?? d; 
            } catch { 
                return d; 
            } 
        },
        set(k, v) { 
            localStorage.setItem(k, JSON.stringify(v)); 
        }
    };

    const state = store.get("ff_state", {
        top: 12, right: 12, width: 360, height: 420,
        minimized: false, theme: "dark", visible: true
    });

    /* ---------- UI ---------- */
    const panel = document.createElement("div");
    panel.style.cssText = `
        position:fixed;
        top:${state.top}px;
        right:${state.right}px;
        width:${state.width}px;
        height:${state.height}px;
        max-width:calc(100vw - 24px);
        max-height:calc(100vh - 24px);
        z-index:999999;
        border:1px solid;
        font-family:monospace;
        font-size:12px;
        padding:8px;
        resize:both;
        box-sizing:border-box;
        border-radius:6px;
        overflow:hidden;
        display:${state.visible ? 'block' : 'none'};
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:space-between;
        cursor:move;
        font-weight:bold;
        margin-bottom:6px;
        user-select:none;
    `;
    header.innerHTML = `
        <span>FLOATING FINDER</span>
        <span>
            <button id="themeBtn">🌓</button>
            <button id="minBtn">—</button>
            <button id="closeBtn">✕</button>
        </span>
    `;

    const controls = document.createElement("div");
    controls.innerHTML = `
        <input id="search" placeholder="Search…" style="width:100%;margin-bottom:6px;padding:4px;">
        <button id="scanImgs" style="width:100%;margin-bottom:6px;padding:6px;">🖼 Scan IMAGES</button>
        <button id="scanAll" style="width:100%;margin-bottom:6px;padding:6px;">🔍 Scan ALL BUTTONS</button>
    `;

    const out = document.createElement("div");
    out.style.cssText = `
        overflow:auto;
        max-height:calc(100% - 120px);
        margin-top:10px;
        border-top:1px solid;
        padding-top:5px;
    `;

    panel.append(header, controls, out);
    document.body.appendChild(panel);

    /* ---------- PLUS BUTTON ---------- */
    const plus = document.createElement("div");
    plus.textContent = "+";
    plus.style.cssText = `
        position:fixed;
        bottom:20px;
        right:20px;
        width:36px;
        height:36px;
        background:#0f0;
        color:#000;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:22px;
        font-weight:bold;
        cursor:pointer;
        z-index:1000000;
        user-select:none;
        box-shadow:0 2px 10px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(plus);

    plus.addEventListener("click", () => {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
        state.visible = panel.style.display !== "none";
        store.set("ff_state", state);
    });

    /* ---------- THEME ---------- */
    function applyTheme() {
        const dark = state.theme === "dark";
        panel.style.background = dark ? "#111" : "#f4f4f4";
        panel.style.color = dark ? "#0f0" : "#111";
        panel.style.borderColor = dark ? "#0f0" : "#333";
        
        panel.querySelectorAll("button").forEach(el => {
            el.style.background = dark ? "#222" : "#fff";
            el.style.color = dark ? "#0f0" : "#111";
            el.style.border = dark ? "1px solid #555" : "1px solid #ccc";
            el.style.borderRadius = "4px";
            el.style.cursor = "pointer";
        });
        
        panel.querySelectorAll("input").forEach(el => {
            el.style.background = dark ? "#222" : "#fff";
            el.style.color = dark ? "#0f0" : "#111";
            el.style.border = dark ? "1px solid #555" : "1px solid #ccc";
        });
    }
    applyTheme();

    /* ---------- DRAG ---------- */
    let dragging = false, ox = 0, oy = 0;
    
    header.addEventListener("mousedown", e => {
        dragging = true;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
        e.preventDefault();
    });
    
    document.addEventListener("mousemove", e => {
        if (!dragging) return;
        panel.style.left = (e.clientX - ox) + "px";
        panel.style.top = (e.clientY - oy) + "px";
        panel.style.right = "auto";
    });
    
    document.addEventListener("mouseup", () => {
        dragging = false;
    });

    /* ---------- SAVE SIZE/POS ---------- */
    new ResizeObserver(() => {
        store.set("ff_state", {
            ...state,
            width: panel.offsetWidth,
            height: panel.offsetHeight,
            top: panel.offsetTop,
            right: window.innerWidth - panel.offsetLeft - panel.offsetWidth
        });
    }).observe(panel);

    /* ---------- ROW ---------- */
    function row(text, click) {
        const d = document.createElement("div");
        d.style.cssText = `
            padding:8px 6px;
            border-bottom:1px solid;
            cursor:pointer;
            word-break:break-word;
            line-height:1.4;
            transition:background 0.2s;
        `;
        d.textContent = text;
        d.onclick = click;
        
        d.addEventListener("mouseenter", () => {
            d.style.background = state.theme === "dark" ? "#222" : "#f0f0f0";
        });
        d.addEventListener("mouseleave", () => {
            d.style.background = "";
        });
        
        return d;
    }

    /* ---------- SCANS ---------- */
    function scanImages() {
        out.innerHTML = "";
        const images = document.querySelectorAll("img");
        
        if (images.length === 0) {
            out.appendChild(row("No images found on this page", () => {}));
            return;
        }
        
        images.forEach((img, i) => {
            img.style.outline = "3px solid red";
            const name = img.alt?.trim() || "(no alt)";
            const src = img.src ? ` [src: ${img.src.substring(0, 30)}...]` : "";
            out.appendChild(row(`${i}. IMG: '${name}'${src}`, () => {
                img.click();
                img.style.outline = "3px solid #0f0";
                setTimeout(() => img.style.outline = "", 1000);
            }));
        });
    }

    function scanAll() {
        out.innerHTML = "";
        const selectors = [
            "button",
            "a",
            "input[type='button']",
            "input[type='submit']",
            "[onclick]",
            "[role='button']"
        ];
        
        const allElements = document.querySelectorAll(selectors.join(","));
        const clickableElements = [];
        
        allElements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            const label = el.innerText?.trim() || el.value || el.alt || el.href || el.title || el.placeholder || "";
            
            if (label || tag === "button" || tag === "a") {
                clickableElements.push({el, tag, label});
            }
        });
        
        if (clickableElements.length === 0) {
            out.appendChild(row("No clickable elements found", () => {}));
            return;
        }
        
        clickableElements.forEach((item, i) => {
            const {el, tag, label} = item;
            el.style.outline = "3px solid blue";
            
            out.appendChild(row(`${i}. ${tag.toUpperCase()}: '${label.substring(0, 100)}'`, () => {
                el.click();
                el.style.outline = "3px solid #0f0";
                setTimeout(() => el.style.outline = "", 1000);
            }));
        });
    }

    /* ---------- SEARCH ---------- */
    const searchInput = panel.querySelector("#search");
    searchInput.addEventListener("input", e => {
        const q = e.target.value.toLowerCase().trim();
        const rows = out.querySelectorAll("div");
        
        if (q === "") {
            rows.forEach(r => r.style.display = "");
            return;
        }
        
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            r.style.display = text.includes(q) ? "" : "none";
        });
    });

    /* ---------- BUTTONS ---------- */
    controls.querySelector("#scanImgs").addEventListener("click", scanImages);
    controls.querySelector("#scanAll").addEventListener("click", scanAll);

    header.querySelector("#themeBtn").addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        store.set("ff_state", state);
        applyTheme();
    });

    header.querySelector("#minBtn").addEventListener("click", () => {
        state.minimized = !state.minimized;
        controls.style.display = out.style.display = state.minimized ? "none" : "";
        store.set("ff_state", state);
    });

    header.querySelector("#closeBtn").addEventListener("click", () => {
        panel.style.display = "none";
        state.visible = false;
        store.set("ff_state", state);
    });

    /* ---------- HOTKEY ---------- */
    document.addEventListener("keydown", e => {
        if (e.altKey && e.key.toLowerCase() === "b") {
            panel.style.display = panel.style.display === "none" ? "block" : "none";
            state.visible = panel.style.display !== "none";
            store.set("ff_state", state);
        }
    });

    /* ---------- CLEANUP ON CLICK ---------- */
    document.addEventListener("click", (e) => {
        // Clear outlines when clicking outside
        if (!panel.contains(e.target) && !plus.contains(e.target)) {
            document.querySelectorAll("[style*='outline']").forEach(el => {
                if (el.style.outline.includes("red") || el.style.outline.includes("blue")) {
                    el.style.outline = "";
                }
            });
        }
    });

    /* ---------- INITIAL SCAN ---------- */
    if (state.visible) {
        setTimeout(() => {
            scanAll();
        }, 500);
    }

    // Save position on move
    let saveTimeout;
    panel.addEventListener("mousemove", () => {
        if (dragging) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                store.set("ff_state", {
                    ...state,
                    top: panel.offsetTop,
                    right: window.innerWidth - panel.offsetLeft - panel.offsetWidth
                });
            }, 500);
        }
    });

})();
