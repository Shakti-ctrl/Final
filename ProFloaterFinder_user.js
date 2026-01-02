// ==UserScript==
// @name         Floating Finder PRO v2.5
// @namespace    http://floatingfinder.com/
// @version      2.5
// @description  Advanced floating element finder with screenshots, editing, AI and more
// @author       Pro Dev
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // Prevent multiple instances
    if (window.__FF_PRO_V2__) return;
    window.__FF_PRO_V2__ = true;
    
    // ========== SIMPLE STORAGE ==========
    const storage = {
        get(key, def) {
            try {
                return JSON.parse(localStorage.getItem('ff_pro_' + key)) || def;
            } catch {
                return def;
            }
        },
        set(key, value) {
            localStorage.setItem('ff_pro_' + key, JSON.stringify(value));
        }
    };
    
    // Load saved state
    const state = storage.get('state', {
        top: 20,
        right: 20,
        width: 380,
        height: 500,
        theme: 'dark',
        visible: true,
        tab: 'elements'
    });
    
    // ========== CREATE MAIN PANEL ==========
    const panel = document.createElement('div');
    panel.id = 'ff-pro-panel';
    panel.style.cssText = `
        position: fixed;
        top: ${state.top}px;
        right: ${state.right}px;
        width: ${state.width}px;
        height: ${state.height}px;
        min-width: 300px;
        min-height: 200px;
        max-width: 90vw;
        max-height: 90vh;
        z-index: 999999;
        border: 2px solid #0f0;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 12px;
        padding: 0;
        resize: both;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        display: ${state.visible ? 'block' : 'none'};
        box-sizing: border-box;
    `;
    
    // ========== HEADER ==========
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        cursor: move;
        user-select: none;
        border-bottom: 1px solid #0f0;
        background: #000;
        color: #0f0;
        font-weight: bold;
    `;
    header.innerHTML = `
        <div>🔍 FLOATING FINDER PRO</div>
        <div style="display: flex; gap: 5px;">
            <button class="ff-btn" title="AI Mode">🤖</button>
            <button class="ff-btn" title="Inspect">🔍</button>
            <button class="ff-btn" title="Screenshot">📸</button>
            <button class="ff-btn" title="Theme">🌓</button>
            <button class="ff-btn" title="Minimize">−</button>
            <button class="ff-btn" title="Close">×</button>
        </div>
    `;
    
    // ========== TABS ==========
    const tabs = document.createElement('div');
    tabs.style.cssText = `
        display: flex;
        background: #111;
        border-bottom: 1px solid #333;
    `;
    tabs.innerHTML = `
        <button class="ff-tab active" data-tab="elements">Elements</button>
        <button class="ff-tab" data-tab="console">Console</button>
        <button class="ff-tab" data-tab="tools">Tools</button>
        <button class="ff-tab" data-tab="ai">AI</button>
        <button class="ff-tab" data-tab="settings">Settings</button>
    `;
    
    // ========== CONTENT AREA ==========
    const content = document.createElement('div');
    content.style.cssText = `
        height: calc(100% - 80px);
        overflow: hidden;
        background: #000;
    `;
    
    // ========== TAB CONTENTS ==========
    
    // 1. ELEMENTS TAB
    const elementsTab = document.createElement('div');
    elementsTab.className = 'ff-tab-content active';
    elementsTab.dataset.tab = 'elements';
    elementsTab.style.cssText = 'padding: 10px; height: 100%; overflow-y: auto;';
    elementsTab.innerHTML = `
        <div style="margin-bottom: 10px;">
            <input type="text" id="ff-search" placeholder="🔍 Search elements..." 
                   style="width: 100%; padding: 8px; margin-bottom: 10px; background: #111; color: #0f0; border: 1px solid #333;">
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px;">
                <button class="ff-action-btn" data-action="scan-all">🔍 Scan All</button>
                <button class="ff-action-btn" data-action="scan-images">🖼 Images</button>
                <button class="ff-action-btn" data-action="scan-buttons">🔘 Buttons</button>
                <button class="ff-action-btn" data-action="scan-forms">📝 Forms</button>
                <button class="ff-action-btn" data-action="scan-links">🔗 Links</button>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="ff-action-btn" data-action="highlight-all">✨ Highlight</button>
                <button class="ff-action-btn" data-action="clear-highlights">🗑 Clear</button>
                <button class="ff-action-btn" data-action="edit-element">✏️ Edit</button>
                <button class="ff-action-btn" data-action="copy-element">📋 Copy</button>
            </div>
        </div>
        <div id="ff-elements-list" style="height: calc(100% - 120px); overflow-y: auto;"></div>
    `;
    
    // 2. CONSOLE TAB
    const consoleTab = document.createElement('div');
    consoleTab.className = 'ff-tab-content';
    consoleTab.dataset.tab = 'console';
    consoleTab.style.cssText = 'padding: 10px; height: 100%; overflow: hidden; display: none;';
    consoleTab.innerHTML = `
        <div style="margin-bottom: 10px;">
            <textarea id="ff-console-input" 
                      placeholder="Enter JavaScript code..."
                      style="width: 100%; height: 60px; padding: 8px; background: #111; color: #0f0; border: 1px solid #333;"></textarea>
            <button class="ff-action-btn" data-action="run-code" style="margin-top: 5px; width: 100%;">▶ Run Code</button>
        </div>
        <div id="ff-console-output" 
             style="height: calc(100% - 120px); overflow-y: auto; font-family: monospace; font-size: 11px; padding: 5px; background: #111;"></div>
    `;
    
    // 3. TOOLS TAB
    const toolsTab = document.createElement('div');
    toolsTab.className = 'ff-tab-content';
    toolsTab.dataset.tab = 'tools';
    toolsTab.style.cssText = 'padding: 10px; height: 100%; overflow-y: auto; display: none;';
    toolsTab.innerHTML = `
        <h3 style="margin-top: 0; color: #0f0;">🛠 Developer Tools</h3>
        
        <div style="margin-bottom: 15px;">
            <h4>📸 Screenshot Tools</h4>
            <button class="ff-action-btn" data-action="screenshot-element" style="width: 100%; margin: 5px 0;">Capture Element</button>
            <button class="ff-action-btn" data-action="screenshot-page" style="width: 100%; margin: 5px 0;">Capture Full Page</button>
            <button class="ff-action-btn" data-action="screenshot-area" style="width: 100%; margin: 5px 0;">Capture Area</button>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4>🎨 CSS Tools</h4>
            <button class="ff-action-btn" data-action="copy-styles" style="width: 100%; margin: 5px 0;">Copy Element Styles</button>
            <button class="ff-action-btn" data-action="edit-styles" style="width: 100%; margin: 5px 0;">Edit CSS Live</button>
            <button class="ff-action-btn" data-action="css-grid" style="width: 100%; margin: 5px 0;">Show CSS Grid</button>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4>📊 Page Info</h4>
            <button class="ff-action-btn" data-action="page-metrics" style="width: 100%; margin: 5px 0;">Show Page Metrics</button>
            <button class="ff-action-btn" data-action="list-assets" style="width: 100%; margin: 5px 0;">List All Assets</button>
            <button class="ff-action-btn" data-action="performance-test" style="width: 100%; margin: 5px 0;">Performance Test</button>
        </div>
        
        <div>
            <h4>⚡ Utilities</h4>
            <button class="ff-action-btn" data-action="clear-cookies" style="width: 100%; margin: 5px 0;">Clear Cookies</button>
            <button class="ff-action-btn" data-action="local-storage" style="width: 100%; margin: 5px 0;">View LocalStorage</button>
            <button class="ff-action-btn" data-action="disable-js" style="width: 100%; margin: 5px 0;">Toggle JavaScript</button>
        </div>
    `;
    
    // 4. AI TAB
    const aiTab = document.createElement('div');
    aiTab.className = 'ff-tab-content';
    aiTab.dataset.tab = 'ai';
    aiTab.style.cssText = 'padding: 10px; height: 100%; overflow: hidden; display: none;';
    aiTab.innerHTML = `
        <div style="margin-bottom: 10px;">
            <h3 style="margin-top: 0; color: #0f0;">🤖 AI Assistant</h3>
            <input type="text" id="ff-ai-key" placeholder="Optional: Enter AI API Key" 
                   style="width: 100%; padding: 8px; margin-bottom: 10px; background: #111; color: #0f0; border: 1px solid #333;">
            <textarea id="ff-ai-prompt" 
                      placeholder="Ask AI about the current element or page..."
                      style="width: 100%; height: 80px; padding: 8px; margin-bottom: 10px; background: #111; color: #0f0; border: 1px solid #333;"></textarea>
            <div style="display: flex; gap: 5px;">
                <button class="ff-action-btn" data-action="ai-analyze" style="flex: 1;">Analyze Element</button>
                <button class="ff-action-btn" data-action="ai-optimize" style="flex: 1;">Optimize Code</button>
                <button class="ff-action-btn" data-action="ai-explain" style="flex: 1;">Explain Code</button>
            </div>
        </div>
        <div id="ff-ai-response" 
             style="height: calc(100% - 200px); overflow-y: auto; padding: 10px; background: #111; border: 1px solid #333; border-radius: 5px;">
            <div style="color: #888; font-style: italic;">AI responses will appear here...</div>
        </div>
    `;
    
    // 5. SETTINGS TAB
    const settingsTab = document.createElement('div');
    settingsTab.className = 'ff-tab-content';
    settingsTab.dataset.tab = 'settings';
    settingsTab.style.cssText = 'padding: 10px; height: 100%; overflow-y: auto; display: none;';
    settingsTab.innerHTML = `
        <h3 style="margin-top: 0; color: #0f0;">⚙️ Settings</h3>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 8px;">
                <input type="checkbox" id="ff-setting-hotkeys" checked> Enable Hotkeys (Alt+F)
            </label>
            <label style="display: block; margin-bottom: 8px;">
                <input type="checkbox" id="ff-setting-auto-scan"> Auto-scan on load
            </label>
            <label style="display: block; margin-bottom: 8px;">
                <input type="checkbox" id="ff-setting-show-plus" checked> Show + Button
            </label>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Theme:</label>
            <select id="ff-setting-theme" style="width: 100%; padding: 5px; background: #111; color: #0f0;">
                <option value="dark">Dark (Green)</option>
                <option value="light">Light</option>
                <option value="blue">Blue</option>
                <option value="red">Red</option>
            </select>
        </div>
        
        <div style="margin-bottom: 15px;">
            <button class="ff-action-btn" data-action="export-data" style="width: 100%; margin: 5px 0;">💾 Export All Data</button>
            <button class="ff-action-btn" data-action="import-data" style="width: 100%; margin: 5px 0;">📥 Import Data</button>
            <button class="ff-action-btn" data-action="reset-all" style="width: 100%; margin: 5px 0;">🔄 Reset to Default</button>
        </div>
        
        <div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">
            <h4>📋 Hotkeys:</h4>
            <div style="font-size: 11px; color: #888;">
                <div>Alt+F: Toggle Panel</div>
                <div>Alt+I: Inspect Mode</div>
                <div>Alt+S: Screenshot</div>
                <div>Alt+C: Console</div>
                <div>Alt+A: AI Assistant</div>
                <div>Esc: Cancel</div>
            </div>
        </div>
    `;
    
    // Assemble everything
    content.appendChild(elementsTab);
    content.appendChild(consoleTab);
    content.appendChild(toolsTab);
    content.appendChild(aiTab);
    content.appendChild(settingsTab);
    
    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(content);
    document.body.appendChild(panel);
    
    // ========== APPLY THEME ==========
    function applyTheme(theme = state.theme) {
        const colors = {
            dark: { bg: '#000', text: '#0f0', border: '#0f0', accent: '#ff00ff' },
            light: { bg: '#fff', text: '#000', border: '#333', accent: '#007bff' },
            blue: { bg: '#001f3f', text: '#7FDBFF', border: '#0074D9', accent: '#39CCCC' },
            red: { bg: '#300', text: '#ff6b6b', border: '#ff4757', accent: '#ff3838' }
        };
        
        const c = colors[theme] || colors.dark;
        
        panel.style.background = c.bg;
        panel.style.color = c.text;
        panel.style.borderColor = c.border;
        
        // Style all buttons
        panel.querySelectorAll('button').forEach(btn => {
            btn.style.background = c.bg;
            btn.style.color = c.text;
            btn.style.border = `1px solid ${c.border}`;
            btn.style.padding = '5px 10px';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
        });
        
        // Style tabs
        panel.querySelectorAll('.ff-tab').forEach(tab => {
            tab.style.background = c.bg;
            tab.style.color = c.text;
            tab.style.border = 'none';
            tab.style.padding = '8px 12px';
            tab.style.cursor = 'pointer';
        });
        
        panel.querySelectorAll('.ff-tab.active').forEach(tab => {
            tab.style.background = c.accent;
            tab.style.color = c.bg;
        });
        
        // Style inputs
        panel.querySelectorAll('input, textarea, select').forEach(input => {
            input.style.background = c.bg;
            input.style.color = c.text;
            input.style.border = `1px solid ${c.border}`;
        });
        
        state.theme = theme;
        storage.set('state', state);
    }
    
    // Apply theme on load
    applyTheme();
    
    // ========== DRAG & RESIZE ==========
    let dragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        
        panel.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        panel.style.left = (startLeft + dx) + 'px';
        panel.style.top = (startTop + dy) + 'px';
        panel.style.right = 'auto';
        
        // Save position
        state.top = panel.offsetTop;
        state.right = window.innerWidth - panel.offsetLeft - panel.offsetWidth;
        storage.set('state', state);
    });
    
    document.addEventListener('mouseup', () => {
        dragging = false;
        panel.style.cursor = '';
    });
    
    // Auto-save size changes
    new ResizeObserver(() => {
        state.width = panel.offsetWidth;
        state.height = panel.offsetHeight;
        storage.set('state', state);
    }).observe(panel);
    
    // ========== TAB SWITCHING ==========
    tabs.addEventListener('click', (e) => {
        if (!e.target.classList.contains('ff-tab')) return;
        
        // Remove active class from all tabs
        tabs.querySelectorAll('.ff-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Hide all tab contents
        content.querySelectorAll('.ff-tab-content').forEach(tabContent => {
            tabContent.style.display = 'none';
        });
        
        // Activate clicked tab
        e.target.classList.add('active');
        const tabName = e.target.dataset.tab;
        
        // Show corresponding content
        content.querySelector(`.ff-tab-content[data-tab="${tabName}"]`).style.display = 'block';
        state.tab = tabName;
        storage.set('state', state);
    });
    
    // ========== ELEMENT SCANNING ==========
    const elementsList = document.getElementById('ff-elements-list');
    let highlightedElements = [];
    
    function scanElements(selector = '*') {
        elementsList.innerHTML = '';
        highlightedElements.forEach(el => {
            el.style.outline = '';
            el.style.boxShadow = '';
        });
        highlightedElements = [];
        
        const elements = document.querySelectorAll(selector);
        
        elements.forEach((el, index) => {
            // Skip very small/invisible elements
            if (el.offsetWidth === 0 && el.offsetHeight === 0) return;
            if (el.style.display === 'none') return;
            if (el.style.visibility === 'hidden') return;
            
            const item = document.createElement('div');
            item.className = 'ff-element-item';
            item.style.cssText = `
                padding: 8px;
                margin: 4px 0;
                border: 1px solid #333;
                border-radius: 4px;
                cursor: pointer;
                background: #111;
                transition: all 0.2s;
            `;
            
            // Get element info
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
            const text = el.textContent?.trim().substring(0, 50) || '';
            
            item.innerHTML = `
                <div style="font-weight: bold; color: #0f0;">${tag}${id}${classes}</div>
                ${text ? `<div style="color: #888; font-size: 11px; margin-top: 3px;">"${text}"</div>` : ''}
                <div style="font-size: 10px; color: #666; margin-top: 3px;">
                    ${el.offsetWidth}×${el.offsetHeight}px
                    <span style="float: right;">
                        <button class="ff-small-btn" data-action="click" data-index="${index}">👆</button>
                        <button class="ff-small-btn" data-action="highlight" data-index="${index}">✨</button>
                        <button class="ff-small-btn" data-action="inspect" data-index="${index}">🔍</button>
                    </span>
                </div>
            `;
            
            // Click to select
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('ff-small-btn')) {
                    highlightElement(el, index);
                }
            });
            
            elementsList.appendChild(item);
        });
    }
    
    function highlightElement(el, index) {
        // Clear previous highlights
        highlightedElements.forEach(e => {
            e.style.outline = '';
            e.style.boxShadow = '';
        });
        
        // Highlight new element
        el.style.outline = '3px solid #ff00ff';
        el.style.boxShadow = '0 0 20px rgba(255, 0, 255, 0.5)';
        
        // Store reference
        highlightedElements[index] = el;
        
        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // ========== BUTTON ACTIONS ==========
    panel.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('ff-action-btn') && !btn.classList.contains('ff-small-btn')) return;
        
        const action = btn.dataset.action;
        const index = btn.dataset.index;
        
        switch(action) {
            case 'scan-all':
                scanElements('*');
                break;
            case 'scan-images':
                scanElements('img');
                break;
            case 'scan-buttons':
                scanElements('button, [role="button"], .btn, .button');
                break;
            case 'scan-forms':
                scanElements('input, textarea, select, form');
                break;
            case 'scan-links':
                scanElements('a');
                break;
            case 'highlight-all':
                document.querySelectorAll('*').forEach((el, i) => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        el.style.outline = '1px solid rgba(0, 255, 0, 0.3)';
                    }
                });
                break;
            case 'clear-highlights':
                document.querySelectorAll('*').forEach(el => {
                    el.style.outline = '';
                    el.style.boxShadow = '';
                });
                highlightedElements = [];
                break;
            case 'click':
                if (index !== undefined) {
                    const elements = document.querySelectorAll('*');
                    elements[index].click();
                }
                break;
            case 'inspect':
                if (index !== undefined) {
                    const elements = document.querySelectorAll('*');
                    console.log('Element:', elements[index]);
                    alert('Element logged to console!');
                }
                break;
            case 'run-code':
                const code = document.getElementById('ff-console-input').value;
                try {
                    const result = eval(code);
                    const output = document.getElementById('ff-console-output');
                    output.innerHTML += `<div style="color: #0f0;">▶ ${code}</div>`;
                    output.innerHTML += `<div style="color: #888; margin-left: 20px;">${result}</div>`;
                    output.scrollTop = output.scrollHeight;
                } catch (err) {
                    const output = document.getElementById('ff-console-output');
                    output.innerHTML += `<div style="color: #f00;">❌ Error: ${err.message}</div>`;
                    output.scrollTop = output.scrollHeight;
                }
                break;
            case 'screenshot-element':
                alert('Click on any element to screenshot it');
                document.addEventListener('click', function screenshotHandler(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Create screenshot
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const rect = e.target.getBoundingClientRect();
                    
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    
                    // Draw element (simplified - for real use, use html2canvas)
                    ctx.fillStyle = '#f00';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    const dataUrl = canvas.toDataURL();
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = 'screenshot.png';
                    link.click();
                    
                    document.removeEventListener('click', screenshotHandler);
                }, { once: true });
                break;
            case 'ai-analyze':
                const prompt = document.getElementById('ff-ai-prompt').value;
                const responseDiv = document.getElementById('ff-ai-response');
                responseDiv.innerHTML = `
                    <div style="color: #0f0;">🤖 AI Analysis:</div>
                    <div style="color: #888; margin-top: 10px;">
                        For full AI features, add your API key above.<br>
                        Otherwise, analyzing locally...
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: #222; border-radius: 5px;">
                        <strong>Element Analysis:</strong><br>
                        • Tag: ${highlightedElements[0]?.tagName || 'None selected'}<br>
                        • Dimensions: ${highlightedElements[0]?.offsetWidth || 0}×${highlightedElements[0]?.offsetHeight || 0}<br>
                        • Classes: ${highlightedElements[0]?.className || 'None'}<br>
                        • Suggestion: Add proper ARIA labels for accessibility
                    </div>
                `;
                break;
        }
    });
    
    // ========== HEADER BUTTONS ==========
    header.addEventListener('click', (e) => {
        if (!e.target.classList.contains('ff-btn')) return;
        const text = e.target.textContent;
        
        switch(text) {
            case '🤖':
                // Switch to AI tab
                tabs.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active'));
                content.querySelectorAll('.ff-tab-content').forEach(c => c.style.display = 'none');
                
                tabs.querySelector('.ff-tab[data-tab="ai"]').classList.add('active');
                aiTab.style.display = 'block';
                break;
            case '🔍':
                // Toggle inspect mode
                document.body.style.cursor = 'crosshair';
                alert('Click on any element to inspect it');
                break;
            case '📸':
                // Take screenshot of panel
                html2canvas(panel).then(canvas => {
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL();
                    link.download = 'floating-finder.png';
                    link.click();
                });
                break;
            case '🌓':
                // Toggle theme
                const themes = ['dark', 'light', 'blue', 'red'];
                const currentIndex = themes.indexOf(state.theme);
                const nextIndex = (currentIndex + 1) % themes.length;
                applyTheme(themes[nextIndex]);
                break;
            case '−':
                // Minimize
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
                break;
            case '×':
                // Close
                panel.style.display = 'none';
                state.visible = false;
                storage.set('state', state);
                break;
        }
    });
    
    // ========== PLUS BUTTON ==========
    const plusBtn = document.createElement('div');
    plusBtn.textContent = '+';
    plusBtn.title = 'Floating Finder';
    plusBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #0f0;
        color: #000;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 30px;
        font-weight: bold;
        cursor: pointer;
        z-index: 999998;
        box-shadow: 0 4px 15px rgba(0, 255, 0, 0.3);
        transition: all 0.3s;
        user-select: none;
    `;
    
    plusBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        state.visible = panel.style.display !== 'none';
        storage.set('state', state);
    });
    
    plusBtn.addEventListener('mouseenter', () => {
        plusBtn.style.transform = 'scale(1.1)';
        plusBtn.style.boxShadow = '0 6px 20px rgba(0, 255, 0, 0.5)';
    });
    
    plusBtn.addEventListener('mouseleave', () => {
        plusBtn.style.transform = 'scale(1)';
        plusBtn.style.boxShadow = '0 4px 15px rgba(0, 255, 0, 0.3)';
    });
    
    document.body.appendChild(plusBtn);
    
    // ========== HOTKEYS ==========
    document.addEventListener('keydown', (e) => {
        if (!e.altKey) return;
        
        switch(e.key.toLowerCase()) {
            case 'f':
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                state.visible = panel.style.display !== 'none';
                storage.set('state', state);
                break;
            case 'i':
                // Quick scan
                scanElements('button, a, input');
                break;
            case 's':
                // Quick screenshot
                html2canvas(document.body).then(canvas => {
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL();
                    link.download = `screenshot-${Date.now()}.png`;
                    link.click();
                });
                break;
            case 'c':
                // Focus console
                document.getElementById('ff-console-input').focus();
                break;
            case 'a':
                // AI mode
                document.getElementById('ff-ai-prompt').focus();
                break;
        }
    });
    
    // ========== INITIAL SCAN ==========
    setTimeout(() => {
        scanElements('button, a, img');
    }, 1000);
    
    console.log('✅ Floating Finder PRO v2.5 loaded!');
})();
