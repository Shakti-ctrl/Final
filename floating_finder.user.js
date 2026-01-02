// ==UserScript==
// @name         Floating Finder PRO
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Floating dev tools finder
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    if (window.__FLOAT_EXACT_PRO__) return;
    window.__FLOAT_EXACT_PRO__ = true;

    /* ---------- STORAGE ---------- */
    const store = {
        get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
        set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
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
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        cursor:move;font-weight:bold;margin-bottom:6px;
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
        <input id="search" placeholder="Search…" style="width:100%;margin-bottom:6px;">
        <button id="scanImgs" style="width:100%;margin-bottom:6px;">🖼 Scan IMAGES (alt=name)</button>
        <button id="scanAll" style="width:100%;margin-bottom:6px;">🔍 Scan ALL BUTTONS</button>
    `;

    const out = document.createElement("div");
    out.style.cssText = `overflow:auto;max-height:100%;`;

    panel.append(header, controls, out);
    document.body.appendChild(panel);

    /* ---------- THEME ---------- */
    function applyTheme() {
        const dark = state.theme === "dark";
        panel.style.background = dark ? "#111" : "#f4f4f4";
        panel.style.color = dark ? "#0f0" : "#111";
        panel.style.borderColor = dark ? "#0f0" : "#333";
        panel.querySelectorAll("button,input").forEach(el => {
            el.style.background = dark ? "#222" : "#fff";
            el.style.color = dark ? "#0f0" : "#111";
            el.style.border = "1px solid #555";
        });
    }
    applyTheme();

    /* ---------- DRAG ---------- */
    let dragging = false, ox = 0, oy = 0;
    header.addEventListener("pointerdown", e => {
        dragging = true;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
        panel.setPointerCapture(e.pointerId);
    });
    header.addEventListener("pointermove", e => {
        if (!dragging) return;
        panel.style.left = (e.clientX - ox) + "px";
        panel.style.top  = (e.clientY - oy) + "px";
        panel.style.right = "auto";
    });
    header.addEventListener("pointerup", () => dragging = false);

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
            padding:6px 4px;
            border-bottom:1px solid;
            cursor:pointer;
            word-break:break-all;
        `;
        d.textContent = text;
        d.onclick = click;
        return d;
    }

    /* ---------- SCANS ---------- */
    function scanImages() {
        out.innerHTML = "";
        document.querySelectorAll("img").forEach((img, i) => {
            img.style.outline = "3px solid red";
            const name = img.alt?.trim() || "(no alt)";
            out.appendChild(row(`${i} ${img.outerHTML.split(">")[0]}> '${name}'`, () => img.click()));
        });
    }

    function scanAll() {
        out.innerHTML = "";
        document.querySelectorAll("button,a,input[type='button'],input[type='submit'],div,span,img")
            .forEach((el, i) => {
                const label = el.innerText?.trim() || el.alt || el.value || el.href || el.src;
                const clickable = el.tagName === "BUTTON" || el.tagName === "A" || el.onclick ||
                    el.getAttribute("onclick") || el.style.cursor === "pointer" || el.role === "button";
                if (!clickable || !label) return;
                el.style.outline = "3px solid red";
                out.appendChild(row(`${i} ${el.outerHTML.split(">")[0]}> '${label}'`, () => el.click()));
            });
    }

    /* ---------- SEARCH ---------- */
    controls.querySelector("#search").addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        out.querySelectorAll("div").forEach(r => {
            r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none";
        });
    });

    /* ---------- BUTTONS ---------- */
    controls.querySelector("#scanImgs").onclick = scanImages;
    controls.querySelector("#scanAll").onclick = scanAll;

    header.querySelector("#themeBtn").onclick = () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        store.set("ff_state", state);
        applyTheme();
    };

    header.querySelector("#minBtn").onclick = () => {
        state.minimized = !state.minimized;
        controls.style.display = out.style.display = state.minimized ? "none" : "";
        store.set("ff_state", state);
    };

    header.querySelector("#closeBtn").onclick = () => {
        panel.style.display = "none";
        state.visible = false;
        store.set("ff_state", state);
    };

    /* ---------- HOTKEY ---------- */
    document.addEventListener("keydown", e => {
        if (e.altKey && e.key.toLowerCase() === "b") {
            panel.style.display = panel.style.display === "none" ? "" : "none";
            state.visible = panel.style.display !== "none";
            store.set("ff_state", state);
        }
    });

    /* ---------- + BUTTON ---------- */
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
    `;
    document.body.appendChild(plus);

    plus.addEventListener("click", () => {
        panel.style.display = panel.style.display === "none" ? "" : "none";
        state.visible = panel.style.display !== "none";
        store.set("ff_state", state);
    });

    if (!state.visible) panel.style.display = "none";
})();
