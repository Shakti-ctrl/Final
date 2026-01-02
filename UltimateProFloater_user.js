// ==UserScript==
// @name         Floating DevTools Window Manager PRO
// @namespace    http://devtools.pro/
// @version      3.0
// @description  Advanced floating window with tabs, console, snippets, element finder
// @author       Pro Dev
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    if (window.__DEVTOOLS_WINDOW_MANAGER__) return;
    window.__DEVTOOLS_WINDOW_MANAGER__ = true;
    
    // ========== STORAGE ==========
    const store = {
        get(k, d) { 
            try { 
                return JSON.parse(localStorage.getItem('dtwm_' + k)) ?? d; 
            } catch { 
                return d; 
            } 
        },
        set(k, v) { 
            localStorage.setItem('dtwm_' + k, JSON.stringify(v)); 
        }
    };
    
    const state = store.get('state', {
        top: 20, right: 20, width: 420, height: 500,
        theme: 'dark', visible: true, activeTab: 'console',
        snippets: [],
        windowState: 'normal', // normal, minimized, maximized
        pinned: false
    });
    
    // ========== CREATE WINDOW ==========
    const window = document.createElement('div');
    window.id = 'dtwm-window';
    window.style.cssText = `
        position: fixed;
        top: ${state.top}px;
        right: ${state.right}px;
        width: ${state.width}px;
        height: ${state.height}px;
        min-width: 300px;
        min-height: 200px;
        max-width: 95vw;
        max-height: 95vh;
        z-index: 2147483647;
        font-family: 'Segoe UI', 'Consolas', monospace;
        font-size: 12px;
        resize: both;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        display: ${state.visible ? 'block' : 'none'};
        box-sizing: border-box;
        backdrop-filter: blur(10px);
        border: 1px solid;
    `;
    
    // ========== WINDOW HEADER (Title Bar) ==========
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        cursor: move;
        user-select: none;
        border-bottom: 1px solid;
        height: 36px;
        background: rgba(0,0,0,0.9);
    `;
    
    // Window title with icon
    const titleLeft = document.createElement('div');
    titleLeft.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    titleLeft.innerHTML = `
        <span style="color: #0f0;">⚡</span>
        <span style="font-weight: bold;">DevTools Manager</span>
        <span style="font-size: 10px; opacity: 0.7;">v3.0</span>
    `;
    
    // Window controls (like Windows)
    const titleRight = document.createElement('div');
    titleRight.style.cssText = 'display: flex; align-items: center; gap: 2px;';
    titleRight.innerHTML = `
        <button class="dtwm-win-btn" title="Pin Window" id="dtwm-pin">📌</button>
        <button class="dtwm-win-btn" title="Minimize" id="dtwm-min">−</button>
        <button class="dtwm-win-btn" title="Maximize" id="dtwm-max">□</button>
        <button class="dtwm-win-btn" title="Close" id="dtwm-close">×</button>
    `;
    
    titleBar.appendChild(titleLeft);
    titleBar.appendChild(titleRight);
    
    // ========== TAB BAR ==========
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
        display: flex;
        background: rgba(30,30,30,0.9);
        border-bottom: 1px solid #444;
        overflow-x: auto;
        height: 32px;
        flex-shrink: 0;
    `;
    
    // Tab buttons
    const tabs = [
        { id: 'console', icon: '💻', label: 'Console', title: 'JavaScript Console' },
        { id: 'elements', icon: '🔍', label: 'Elements', title: 'Element Finder' },
        { id: 'snippets', icon: '📝', label: 'Snippets', title: 'Code Snippets' },
        { id: 'network', icon: '📡', label: 'Network', title: 'Network Monitor' },
        { id: 'storage', icon: '💾', label: 'Storage', title: 'Storage Viewer' },
        { id: 'tools', icon: '🛠', label: 'Tools', title: 'Developer Tools' }
    ];
    
    tabs.forEach(tab => {
        const tabBtn = document.createElement('button');
        tabBtn.className = 'dtwm-tab';
        tabBtn.dataset.tab = tab.id;
        tabBtn.title = tab.title;
        tabBtn.innerHTML = `${tab.icon} ${tab.label}`;
        tabBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: transparent;
            color: #aaa;
            cursor: pointer;
            white-space: nowrap;
            border-right: 1px solid #444;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 5px;
            height: 100%;
        `;
        
        if (tab.id === state.activeTab) {
            tabBtn.style.background = '#007acc';
            tabBtn.style.color = '#fff';
        }
        
        tabBar.appendChild(tabBtn);
    });
    
    // ========== CONTENT AREA ==========
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
        height: calc(100% - 68px);
        overflow: hidden;
        position: relative;
    `;
    
    // Create all tab contents
    const tabContents = {};
    
    // 1. CONSOLE TAB
    tabContents.console = document.createElement('div');
    tabContents.console.className = 'dtwm-tab-content';
    tabContents.console.dataset.tab = 'console';
    tabContents.console.style.cssText = 'height: 100%; padding: 0; display: flex; flex-direction: column;';
    tabContents.console.innerHTML = `
        <div style="padding: 10px; border-bottom: 1px solid #444; background: rgba(0,0,0,0.5);">
            <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                <button class="dtwm-action-btn" data-action="console-clear" title="Clear Console">🗑 Clear</button>
                <button class="dtwm-action-btn" data-action="console-copy" title="Copy Output">📋 Copy</button>
                <button class="dtwm-action-btn" data-action="console-save" title="Save Output">💾 Save</button>
                <button class="dtwm-action-btn" data-action="console-eval" title="Evaluate Selection">▶ Eval</button>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="dtwm-small-btn" title="console.log()">log()</button>
                <button class="dtwm-small-btn" title="console.error()">error()</button>
                <button class="dtwm-small-btn" title="console.warn()">warn()</button>
                <button class="dtwm-small-btn" title="console.table()">table()</button>
                <button class="dtwm-small-btn" title="document.querySelector()">$()</button>
                <button class="dtwm-small-btn" title="document.querySelectorAll()">$$()</button>
            </div>
        </div>
        
        <div style="flex: 1; display: flex;">
            <!-- Input Area -->
            <div style="width: 100%; display: flex; flex-direction: column;">
                <div style="position: relative; flex: 1;">
                    <textarea id="dtwm-console-input" 
                              placeholder="Enter JavaScript code here... (Shift+Enter to run)"
                              style="width: 100%; height: 100%; padding: 10px; 
                                     background: rgba(30,30,30,0.9); color: #0f0; 
                                     border: none; resize: none; font-family: 'Consolas', monospace;
                                     font-size: 13px; box-sizing: border-box;"></textarea>
                    <button id="dtwm-console-run" 
                            style="position: absolute; bottom: 10px; right: 10px; 
                                   padding: 5px 15px; background: #0f0; color: #000; 
                                   border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        ▶ Run
                    </button>
                </div>
                
                <!-- Output Area -->
                <div style="height: 200px; min-height: 150px; max-height: 300px; 
                           border-top: 1px solid #444; display: flex; flex-direction: column;">
                    <div style="padding: 5px 10px; background: rgba(0,0,0,0.5); 
                               display: flex; justify-content: space-between; font-size: 11px;">
                        <span>Console Output:</span>
                        <span id="dtwm-console-count">0 messages</span>
                    </div>
                    <div id="dtwm-console-output" 
                         style="flex: 1; overflow-y: auto; padding: 5px; 
                                background: rgba(20,20,20,0.9); font-family: 'Consolas', monospace;
                                font-size: 12px;"></div>
                </div>
            </div>
        </div>
    `;
    
    // 2. ELEMENTS TAB (Improved Finder)
    tabContents.elements = document.createElement('div');
    tabContents.elements.className = 'dtwm-tab-content';
    tabContents.elements.dataset.tab = 'elements';
    tabContents.elements.style.cssText = 'height: 100%; padding: 0; display: none; flex-direction: column;';
    tabContents.elements.innerHTML = `
        <div style="padding: 10px; border-bottom: 1px solid #444; background: rgba(0,0,0,0.5);">
            <div style="display: flex; gap: 5px; margin-bottom: 8px; flex-wrap: wrap;">
                <input type="text" id="dtwm-elements-search" 
                       placeholder="🔍 Search elements by tag, class, id..." 
                       style="flex: 1; min-width: 200px; padding: 6px; 
                              background: rgba(30,30,30,0.9); color: #fff; border: 1px solid #555;">
                <button class="dtwm-action-btn" data-action="elements-clear">🗑 Clear</button>
                <button class="dtwm-action-btn" data-action="elements-copy">📋 Copy</button>
            </div>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="dtwm-small-btn" data-scan="img">🖼 Images</button>
                <button class="dtwm-small-btn" data-scan="button">🔘 Buttons</button>
                <button class="dtwm-small-btn" data-scan="a">🔗 Links</button>
                <button class="dtwm-small-btn" data-scan="input">📝 Inputs</button>
                <button class="dtwm-small-btn" data-scan="div">⬜ Divs</button>
                <button class="dtwm-small-btn" data-scan="*">🌐 All</button>
                <button class="dtwm-small-btn" data-action="highlight-toggle">✨ Highlight</button>
                <button class="dtwm-small-btn" data-action="inspect-mode">🔍 Inspect</button>
            </div>
        </div>
        
        <div id="dtwm-elements-list" 
             style="flex: 1; overflow-y: auto; padding: 5px; 
                    background: rgba(20,20,20,0.9);"></div>
    `;
    
    // 3. SNIPPETS TAB (Powerful snippet manager)
    tabContents.snippets = document.createElement('div');
    tabContents.snippets.className = 'dtwm-tab-content';
    tabContents.snippets.dataset.tab = 'snippets';
    tabContents.snippets.style.cssText = 'height: 100%; padding: 0; display: none; flex-direction: column;';
    tabContents.snippets.innerHTML = `
        <div style="padding: 10px; border-bottom: 1px solid #444; background: rgba(0,0,0,0.5);">
            <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                <input type="text" id="dtwm-snippet-name" 
                       placeholder="Snippet name" 
                       style="flex: 1; padding: 6px; background: rgba(30,30,30,0.9); 
                              color: #fff; border: 1px solid #555;">
                <button class="dtwm-action-btn" data-action="snippet-save">💾 Save</button>
                <button class="dtwm-action-btn" data-action="snippet-new">➕ New</button>
                <button class="dtwm-action-btn" data-action="snippet-import">📥 Import</button>
                <button class="dtwm-action-btn" data-action="snippet-export">📤 Export</button>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="dtwm-small-btn" data-action="snippet-run-all">▶ Run All</button>
                <button class="dtwm-small-btn" data-action="snippet-category">📂 Categories</button>
                <button class="dtwm-small-btn" data-action="snippet-share">🔗 Share</button>
            </div>
        </div>
        
        <div style="display: flex; height: calc(100% - 90px);">
            <!-- Snippets List -->
            <div style="width: 40%; border-right: 1px solid #444; overflow-y: auto;">
                <div id="dtwm-snippets-list" style="padding: 5px;"></div>
            </div>
            
            <!-- Snippet Editor -->
            <div style="width: 60%; display: flex; flex-direction: column;">
                <textarea id="dtwm-snippet-editor" 
                          placeholder="Write your JavaScript snippet here..."
                          style="flex: 1; padding: 10px; background: rgba(30,30,30,0.9); 
                                 color: #0f0; border: none; resize: none; 
                                 font-family: 'Consolas', monospace; font-size: 13px;"></textarea>
                <div style="padding: 8px; background: rgba(0,0,0,0.5); border-top: 1px solid #444;">
                    <button class="dtwm-action-btn" data-action="snippet-run" style="background: #0f0; color: #000;">▶ Run Snippet</button>
                    <button class="dtwm-action-btn" data-action="snippet-test">🧪 Test</button>
                    <button class="dtwm-action-btn" data-action="snippet-delete" style="background: #f00;">🗑 Delete</button>
                </div>
            </div>
        </div>
    `;
    
    // 4. NETWORK TAB (Basic monitor)
    tabContents.network = document.createElement('div');
    tabContents.network.className = 'dtwm-tab-content';
    tabContents.network.dataset.tab = 'network';
    tabContents.network.style.cssText = 'height: 100%; padding: 0; display: none; flex-direction: column;';
    tabContents.network.innerHTML = `
        <div style="padding: 10px; border-bottom: 1px solid #444; background: rgba(0,0,0,0.5);">
            <div style="display: flex; gap: 5px;">
                <button class="dtwm-action-btn" data-action="network-start">▶ Start</button>
                <button class="dtwm-action-btn" data-action="network-stop">⏹ Stop</button>
                <button class="dtwm-action-btn" data-action="network-clear">🗑 Clear</button>
                <button class="dtwm-action-btn" data-action="network-copy">📋 Copy</button>
            </div>
        </div>
        <div id="dtwm-network-log" 
             style="flex: 1; overflow-y: auto; padding: 5px; 
                    background: rgba(20,20,20,0.9); font-family: 'Consolas', monospace;
                    font-size: 11px;"></div>
    `;
    
    // 5. TOOLS TAB (Various dev tools)
    tabContents.tools = document.createElement('div');
    tabContents.tools.className = 'dtwm-tab-content';
    tabContents.tools.dataset.tab = 'tools';
    tabContents.tools.style.cssText = 'height: 100%; padding: 10px; display: none; overflow-y: auto;';
    tabContents.tools.innerHTML = `
        <div style="margin-bottom: 15px;">
            <h4 style="margin-top: 0; color: #0f0;">📸 Screenshot</h4>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="dtwm-tool-btn" data-tool="screenshot-element">Capture Element</button>
                <button class="dtwm-tool-btn" data-tool="screenshot-page">Full Page</button>
                <button class="dtwm-tool-btn" data-tool="screenshot-area">Select Area</button>
                <button class="dtwm-tool-btn" data-tool="screenshot-window">This Window</button>
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4 style="color: #0f0;">🎨 CSS Tools</h4>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="dtwm-tool-btn" data-tool="css-viewer">CSS Viewer</button>
                <button class="dtwm-tool-btn" data-tool="color-picker">Color Picker</button>
                <button class="dtwm-tool-btn" data-tool="grid-overlay">Grid Overlay</button>
                <button class="dtwm-tool-btn" data-tool="flexbox-overlay">Flexbox Overlay</button>
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4 style="color: #0f0;">⚡ Performance</h4>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="dtwm-tool-btn" data-tool="perf-metrics">Metrics</button>
                <button class="dtwm-tool-btn" data-tool="memory-usage">Memory</button>
                <button class="dtwm-tool-btn" data-tool="fps-monitor">FPS Monitor</button>
                <button class="dtwm-tool-btn" data-tool="page-speed">Page Speed</button>
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4 style="color: #0f0;">🔧 Utilities</h4>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="dtwm-tool-btn" data-tool="clear-cache">Clear Cache</button>
                <button class="dtwm-tool-btn" data-tool="disable-js">Toggle JS</button>
                <button class="dtwm-tool-btn" data-tool="view-source">View Source</button>
                <button class="dtwm-tool-btn" data-tool="cookie-editor">Cookie Editor</button>
            </div>
        </div>
        
        <div>
            <h4 style="color: #0f0;">📊 Page Info</h4>
            <div id="dtwm-page-info" style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; font-size: 11px;">
                Loading page information...
            </div>
        </div>
    `;
    
    // Assemble window
    contentArea.appendChild(tabContents.console);
    contentArea.appendChild(tabContents.elements);
    contentArea.appendChild(tabContents.snippets);
    contentArea.appendChild(tabContents.network);
    contentArea.appendChild(tabContents.tools);
    
    window.appendChild(titleBar);
    window.appendChild(tabBar);
    window.appendChild(contentArea);
    document.body.appendChild(window);
    
    // ========== THEME SYSTEM ==========
    function applyTheme(theme = state.theme) {
        const themes = {
            dark: {
                bg: 'rgba(30,30,30,0.95)',
                text: '#fff',
                border: '#444',
                accent: '#007acc',
                success: '#0f0',
                error: '#f00',
                warning: '#ff0'
            },
            light: {
                bg: 'rgba(255,255,255,0.95)',
                text: '#000',
                border: '#ccc',
                accent: '#007acc',
                success: '#090',
                error: '#c00',
                warning: '#c90'
            },
            hacker: {
                bg: 'rgba(0,20,0,0.95)',
                text: '#0f0',
                border: '#0f0',
                accent: '#0f0',
                success: '#0f0',
                error: '#f00',
                warning: '#ff0'
            }
        };
        
        const t = themes[theme] || themes.dark;
        
        // Apply to window
        window.style.background = t.bg;
        window.style.color = t.text;
        window.style.borderColor = t.border;
        
        // Apply to all buttons
        window.querySelectorAll('button').forEach(btn => {
            if (btn.classList.contains('dtwm-win-btn')) {
                btn.style.background = 'transparent';
                btn.style.color = t.text;
                btn.style.border = 'none';
                btn.style.padding = '4px 8px';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '14px';
            }
            
            if (btn.classList.contains('dtwm-action-btn')) {
                btn.style.background = t.accent;
                btn.style.color = '#fff';
                btn.style.border = 'none';
                btn.style.padding = '6px 12px';
                btn.style.borderRadius = '4px';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '11px';
            }
            
            if (btn.classList.contains('dtwm-small-btn') || btn.classList.contains('dtwm-tool-btn')) {
                btn.style.background = 'rgba(128,128,128,0.2)';
                btn.style.color = t.text;
                btn.style.border = `1px solid ${t.border}`;
                btn.style.padding = '4px 8px';
                btn.style.borderRadius = '3px';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '11px';
            }
        });
        
        // Apply to active tab
        window.querySelectorAll('.dtwm-tab').forEach(tab => {
            if (tab.dataset.tab === state.activeTab) {
                tab.style.background = t.accent;
                tab.style.color = '#fff';
            } else {
                tab.style.background = 'transparent';
                tab.style.color = t.text;
            }
        });
        
        // Apply to inputs
        window.querySelectorAll('input, textarea, select').forEach(input => {
            input.style.background = 'rgba(0,0,0,0.3)';
            input.style.color = t.text;
            input.style.border = `1px solid ${t.border}`;
        });
        
        state.theme = theme;
        store.set('state', state);
    }
    
    // Apply theme on load
    applyTheme();
    
    // ========== WINDOW DRAG & RESIZE ==========
    let isDragging = false;
    let dragStartX, dragStartY;
    let windowStartX, windowStartY;
    
    titleBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = window.getBoundingClientRect();
        windowStartX = rect.left;
        windowStartY = rect.top;
        
        window.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        
        window.style.left = (windowStartX + dx) + 'px';
        window.style.top = (windowStartY + dy) + 'px';
        window.style.right = 'auto';
        
        // Save position
        state.top = window.offsetTop;
        state.right = window.innerWidth - window.offsetLeft - window.offsetWidth;
        store.set('state', state);
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        window.style.cursor = '';
    });
    
    // Touch support for mobile
    titleBar.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        
        const rect = window.getBoundingClientRect();
        windowStartX = rect.left;
        windowStartY = rect.top;
        
        e.preventDefault();
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        
        window.style.left = (windowStartX + dx) + 'px';
        window.style.top = (windowStartY + dy) + 'px';
        window.style.right = 'auto';
        
        // Save position
        state.top = window.offsetTop;
        state.right = window.innerWidth - window.offsetLeft - window.offsetWidth;
        store.set('state', state);
        
        e.preventDefault();
    }, { passive: false });
    
    document.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // Auto-save size changes
    new ResizeObserver(() => {
        state.width = window.offsetWidth;
        state.height = window.offsetHeight;
        store.set('state', state);
    }).observe(window);
    
    // ========== WINDOW CONTROLS ==========
    titleRight.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('dtwm-win-btn')) return;
        
        const action = btn.id.replace('dtwm-', '');
        
        switch(action) {
            case 'pin':
                state.pinned = !state.pinned;
                btn.style.color = state.pinned ? '#0f0' : '';
                btn.title = state.pinned ? 'Unpin Window' : 'Pin Window';
                break;
                
            case 'min':
                // Minimize to taskbar (create minimized version)
                window.style.height = '36px';
                contentArea.style.display = 'none';
                tabBar.style.display = 'none';
                state.windowState = 'minimized';
                break;
                
            case 'max':
                if (state.windowState === 'maximized') {
                    // Restore
                    window.style.width = state.width + 'px';
                    window.style.height = state.height + 'px';
                    window.style.top = state.top + 'px';
                    window.style.right = state.right + 'px';
                    state.windowState = 'normal';
                    btn.textContent = '□';
                } else {
                    // Maximize
                    state.width = window.offsetWidth;
                    state.height = window.offsetHeight;
                    state.top = window.offsetTop;
                    state.right = window.offsetRight;
                    
                    window.style.width = '95vw';
                    window.style.height = '95vh';
                    window.style.top = '2.5vh';
                    window.style.left = '2.5vw';
                    window.style.right = 'auto';
                    state.windowState = 'maximized';
                    btn.textContent = '❐';
                }
                break;
                
            case 'close':
                window.style.display = 'none';
                state.visible = false;
                store.set('state', state);
                break;
        }
    });
    
    // ========== TAB SWITCHING ==========
    tabBar.addEventListener('click', (e) => {
        const tab = e.target;
        if (!tab.classList.contains('dtwm-tab')) return;
        
        // Remove active class from all tabs
        tabBar.querySelectorAll('.dtwm-tab').forEach(t => {
            t.style.background = 'transparent';
            t.style.color = '';
        });
        
        // Hide all tab contents
        Object.values(tabContents).forEach(content => {
            content.style.display = 'none';
        });
        
        // Activate clicked tab
        tab.style.background = '#007acc';
        tab.style.color = '#fff';
        const tabId = tab.dataset.tab;
        
        // Show corresponding content
        if (tabContents[tabId]) {
            tabContents[tabId].style.display = 'flex';
            state.activeTab = tabId;
            store.set('state', state);
        }
    });
    
    // ========== CONSOLE FUNCTIONALITY ==========
    const consoleInput = document.getElementById('dtwm-console-input');
    const consoleOutput = document.getElementById('dtwm-console-output');
    const consoleRunBtn = document.getElementById('dtwm-console-run');
    let consoleHistory = [];
    let historyIndex = -1;
    
    // Run JavaScript code
    function runConsoleCode(code) {
        if (!code.trim()) return;
        
        // Add to history
        consoleHistory.push(code);
        historyIndex = consoleHistory.length;
        
        try {
            // Execute the code
            const result = eval(`(() => { ${code} })()`);
            
            // Display input
            const inputDiv = document.createElement('div');
            inputDiv.style.cssText = 'color: #0f0; margin-bottom: 2px;';
            inputDiv.innerHTML = `<span style="color: #888;">▶</span> ${code}`;
            consoleOutput.appendChild(inputDiv);
            
            // Display output
            if (result !== undefined) {
                const outputDiv = document.createElement('div');
                outputDiv.style.cssText = 'color: #88f; margin-left: 20px; margin-bottom: 10px;';
                outputDiv.textContent = String(result);
                consoleOutput.appendChild(outputDiv);
            }
            
            // Add copy button
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋';
            copyBtn.title = 'Copy result';
            copyBtn.style.cssText = `
                background: transparent;
                border: 1px solid #555;
                color: #aaa;
                padding: 2px 6px;
                margin-left: 10px;
                cursor: pointer;
                font-size: 10px;
                border-radius: 3px;
            `;
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(String(result));
                copyBtn.textContent = '✅';
                setTimeout(() => copyBtn.textContent = '📋', 1000);
            };
            
            if (result !== undefined) {
                outputDiv.appendChild(copyBtn);
            }
            
        } catch (error) {
            // Display error
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'color: #f00; margin-left: 20px; margin-bottom: 10px;';
            errorDiv.textContent = `Error: ${error.message}`;
            consoleOutput.appendChild(errorDiv);
        }
        
        // Scroll to bottom
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        
        // Update message count
        const count = consoleOutput.children.length;
        document.getElementById('dtwm-console-count').textContent = `${count} messages`;
        
        // Clear input
        consoleInput.value = '';
    }
    
    consoleRunBtn.addEventListener('click', () => {
        runConsoleCode(consoleInput.value);
    });
    
    consoleInput.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key === 'Enter') {
            runConsoleCode(consoleInput.value);
            e.preventDefault();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            runConsoleCode(consoleInput.value);
            e.preventDefault();
        }
        // History navigation
        else if (e.key === 'ArrowUp') {
            if (consoleHistory.length > 0) {
                if (historyIndex > 0) historyIndex--;
                if (historyIndex >= 0) {
                    consoleInput.value = consoleHistory[historyIndex];
                }
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (consoleHistory.length > 0) {
                if (historyIndex < consoleHistory.length - 1) {
                    historyIndex++;
                    consoleInput.value = consoleHistory[historyIndex];
                } else if (historyIndex === consoleHistory.length - 1) {
                    historyIndex++;
                    consoleInput.value = '';
                }
            }
            e.preventDefault();
        }
    });
    
    // Console action buttons
    tabContents.console.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('dtwm-action-btn') && 
            !btn.classList.contains('dtwm-small-btn')) return;
        
        const action = btn.dataset.action || btn.textContent;
        
        switch(action) {
            case 'console-clear':
                consoleOutput.innerHTML = '';
                document.getElementById('dtwm-console-count').textContent = '0 messages';
                break;
                
            case 'console-copy':
                navigator.clipboard.writeText(consoleOutput.textContent);
                btn.textContent = '✅ Copied';
                setTimeout(() => btn.textContent = '📋 Copy', 1000);
                break;
                
            case 'console-save':
                const blob = new Blob([consoleOutput.textContent], {type: 'text/plain'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `console-${Date.now()}.txt`;
                a.click();
                break;
                
            case 'console-eval':
                const selection = window.getSelection().toString();
                if (selection) {
                    runConsoleCode(selection);
                } else {
                    alert('Select some text first!');
                }
                break;
                
            case 'log()':
                consoleInput.value = `console.log('Hello World');`;
                break;
                
            case 'error()':
                consoleInput.value = `console.error('Error message');`;
                break;
                
            case 'warn()':
                consoleInput.value = `console.warn('Warning message');`;
                break;
                
            case 'table()':
                consoleInput.value = `console.table([{name: 'John', age: 30}, {name: 'Jane', age: 25}]);`;
                break;
                
            case '$()':
                consoleInput.value = `document.querySelector('');`;
                break;
                
            case '$$()':
                consoleInput.value = `document.querySelectorAll('');`;
                break;
        }
    });
    
    // ========== ELEMENTS FINDER ==========
    const elementsList = document.getElementById('dtwm-elements-list');
    let highlightedElements = [];
    
    function scanElements(selector = '*') {
        elementsList.innerHTML = '';
        highlightedElements = [];
        
        const elements = document.querySelectorAll(selector);
        let count = 0;
        
        elements.forEach((el, index) => {
            // Skip invisible elements
            if (el.offsetWidth === 0 && el.offsetHeight === 0) return;
            if (el.style.display === 'none' || el.style.visibility === 'hidden') return;
            
            count++;
            const item = document.createElement('div');
            item.className = 'dtwm-element-item';
            item.dataset.index = index;
            item.style.cssText = `
                padding: 8px;
                margin: 4px 0;
                border: 1px solid #444;
                border-radius: 4px;
                background: rgba(40,40,40,0.5);
                cursor: pointer;
                transition: all 0.2s;
                font-size: 11px;
            `;
            
            // Element info
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
            const text = el.textContent?.trim().substring(0, 100) || '';
            const size = `${el.offsetWidth}×${el.offsetHeight}`;
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: #0f0; font-weight: bold;">${tag}${id}${classes}</span>
                    <span style="color: #888; font-size: 10px;">${size}</span>
                </div>
                ${text ? `<div style="color: #ccc; font-size: 10px; margin-bottom: 3px; 
                           overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${text}"</div>` : ''}
                <div style="display: flex; gap: 3px; justify-content: flex-end;">
                    <button class="dtwm-icon-btn" title="Click" data-action="click">👆</button>
                    <button class="dtwm-icon-btn" title="Highlight" data-action="highlight">✨</button>
                    <button class="dtwm-icon-btn" title="Inspect" data-action="inspect">🔍</button>
                    <button class="dtwm-icon-btn" title="Copy HTML" data-action="copy">📋</button>
                    <button class="dtwm-icon-btn" title="Edit" data-action="edit">✏️</button>
                </div>
            `;
            
            elementsList.appendChild(item);
            highlightedElements[index] = el;
        });
        
        // Update count
        const searchInput = document.getElementById('dtwm-elements-search');
        if (searchInput.value) {
            elementsList.insertAdjacentHTML('afterbegin', 
                `<div style="color: #888; padding: 5px; font-size: 10px; border-bottom: 1px solid #444;">
                    Found ${count} elements for "${searchInput.value}"
                </div>`);
        }
    }
    
    // Element search
    const elementsSearch = document.getElementById('dtwm-elements-search');
    elementsSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query) {
            try {
                scanElements(query);
            } catch (err) {
                elementsList.innerHTML = `<div style="color: #f00; padding: 10px;">Invalid selector: ${query}</div>`;
            }
        }
    });
    
    // Element actions
    elementsList.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('dtwm-icon-btn') && 
            !btn.classList.contains('dtwm-small-btn')) return;
        
        const action = btn.dataset.action || btn.dataset.scan;
        const item = btn.closest('.dtwm-element-item');
        const index = item ? parseInt(item.dataset.index) : null;
        
        if (action === 'click' && index !== null) {
            highlightedElements[index].click();
        } 
        else if (action === 'highlight' && index !== null) {
            // Toggle highlight
            const el = highlightedElements[index];
            if (el.style.outline === '2px solid #0f0') {
                el.style.outline = '';
                el.style.boxShadow = '';
            } else {
                el.style.outline = '2px solid #0f0';
                el.style.boxShadow = '0 0 10px rgba(0,255,0,0.5)';
            }
        }
        else if (action === 'inspect' && index !== null) {
            console.log('Element:', highlightedElements[index]);
            alert('Element logged to console!');
        }
        else if (action === 'copy' && index !== null) {
            navigator.clipboard.writeText(highlightedElements[index].outerHTML);
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 1000);
        }
        else if (action === 'edit' && index !== null) {
            const el = highlightedElements[index];
            el.contentEditable = true;
            el.style.outline = '2px dashed #0f0';
            el.focus();
            setTimeout(() => {
                el.contentEditable = false;
                el.style.outline = '';
            }, 5000);
        }
        else if (btn.dataset.scan) {
            // Scan specific element type
            scanElements(btn.dataset.scan);
        }
    });
    
    // ========== SNIPPETS MANAGER ==========
    let snippets = store.get('snippets', []);
    
    function renderSnippetsList() {
        const list = document.getElementById('dtwm-snippets-list');
        list.innerHTML = '';
        
        snippets.forEach((snippet, index) => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 8px;
                margin: 2px 0;
                border: 1px solid #444;
                border-radius: 4px;
                background: rgba(50,50,50,0.5);
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            
            item.innerHTML = `
                <div>
                    <div style="font-weight: bold; color: #0f0;">${snippet.name}</div>
                    <div style="font-size: 10px; color: #888;">${snippet.code.substring(0, 50)}...</div>
                </div>
                <button class="dtwm-icon-btn" data-snippet-index="${index}" title="Run">▶</button>
            `;
            
            item.addEventListener('click', () => {
                document.getElementById('dtwm-snippet-name').value = snippet.name;
                document.getElementById('dtwm-snippet-editor').value = snippet.code;
            });
            
            list.appendChild(item);
        });
    }
    
    // Initial render
    renderSnippetsList();
    
    // Snippet actions
    tabContents.snippets.addEventListener('click', (e) => {
        const btn = e.target;
        const action = btn.dataset.action;
        const snippetIndex = btn.dataset.snippetIndex;
        
        if (action === 'snippet-save') {
            const name = document.getElementById('dtwm-snippet-name').value || `Snippet ${Date.now()}`;
            const code = document.getElementById('dtwm-snippet-editor').value;
            
            if (code.trim()) {
                snippets.push({ name, code, created: Date.now() });
                store.set('snippets', snippets);
                renderSnippetsList();
                alert('Snippet saved!');
            }
        }
        else if (action === 'snippet-run') {
            const code = document.getElementById('dtwm-snippet-editor').value;
            if (code.trim()) {
                try {
                    eval(code);
                } catch (err) {
                    console.error('Snippet error:', err);
                }
            }
        }
        else if (action === 'snippet-delete') {
            const name = document.getElementById('dtwm-snippet-name').value;
            if (name && confirm(`Delete "${name}"?`)) {
                snippets = snippets.filter(s => s.name !== name);
                store.set('snippets', snippets);
                renderSnippetsList();
                document.getElementById('dtwm-snippet-name').value = '';
                document.getElementById('dtwm-snippet-editor').value = '';
            }
        }
        else if (snippetIndex !== undefined) {
            // Run snippet from list
            const snippet = snippets[parseInt(snippetIndex)];
            if (snippet) {
                try {
                    eval(snippet.code);
                } catch (err) {
                    console.error('Snippet error:', err);
                }
            }
        }
    });
    
    // ========== FLOATING BUTTON ==========
    const floatBtn = document.createElement('div');
    floatBtn.id = 'dtwm-float-btn';
    floatBtn.innerHTML = '⚡';
    floatBtn.title = 'DevTools Manager';
    floatBtn.style.cssText = `
        position: fixed;
        bottom: 25px;
        right: 25px;
        width: 55px;
        height: 55px;
        background: linear-gradient(135deg, #007acc, #0f0);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        z-index: 2147483646;
        box-shadow: 0 5px 25px rgba(0,122,204,0.5);
        user-select: none;
        transition: all 0.3s;
    `;
    
    floatBtn.addEventListener('click', () => {
        window.style.display = window.style.display === 'none' ? 'block' : 'none';
        state.visible = window.style.display !== 'none';
        store.set('state', state);
    });
    
    floatBtn.addEventListener('mouseenter', () => {
        floatBtn.style.transform = 'scale(1.1) rotate(90deg)';
        floatBtn.style.boxShadow = '0 8px 30px rgba(0,122,204,0.7)';
    });
    
    floatBtn.addEventListener('mouseleave', () => {
        floatBtn.style.transform = 'scale(1) rotate(0deg)';
        floatBtn.style.boxShadow = '0 5px 25px rgba(0,122,204,0.5)';
    });
    
    document.body.appendChild(floatBtn);
    
    // ========== HOTKEYS ==========
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey) {
            switch(e.key.toLowerCase()) {
                case 'd':
                    window.style.display = window.style.display === 'none' ? 'block' : 'none';
                    state.visible = window.style.display !== 'none';
                    store.set('state', state);
                    e.preventDefault();
                    break;
                    
                case 'c':
                    // Focus console input
                    consoleInput.focus();
                    e.preventDefault();
                    break;
                    
                case 'e':
                    // Switch to elements tab
                    document.querySelector('.dtwm-tab[data-tab="elements"]').click();
                    e.preventDefault();
                    break;
                    
                case 's':
                    // Switch to snippets tab
                    document.querySelector('.dtwm-tab[data-tab="snippets"]').click();
                    e.preventDefault();
                    break;
            }
        }
    });
    
    // ========== INITIAL SCAN ==========
    setTimeout(() => {
        scanElements('button, a, input');
        
        // Load page info
        const pageInfo = document.getElementById('dtwm-page-info');
        if (pageInfo) {
            pageInfo.innerHTML = `
                <div>URL: ${window.location.href}</div>
                <div>Title: ${document.title}</div>
                <div>Elements: ${document.querySelectorAll('*').length}</div>
                <div>Images: ${document.querySelectorAll('img').length}</div>
                <div>Scripts: ${document.querySelectorAll('script').length}</div>
            `;
        }
    }, 1000);
    
    console.log('✅ Floating DevTools Window Manager PRO loaded!');
})();
