// ==UserScript==
// @name         osu-expansion-neko-science
// @namespace    https://github.com/fujiyaa/osu-expansion-neko-science
// @version      0.4.4-beta
// @description  Расширение для осу очень нужное
// @author       Fujiya
// @match        https://osu.ppy.sh/*
// @grant        window.onurlchange
// @downloadURL  https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/inspector.user.js
// @updateURL    https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/inspector.user.js
// ==/UserScript==

// Что нового в 0.4.3 -> 0.4.4:
// - Фикс зависания сайта из-за расширения

(function() {
    'use strict';

    const EXT_VERSION = '0.4.4-beta';

    let RESET_ON_START = localStorage.getItem('chat_resetOnStart') === 'true'; // поменять на false на один запуск, если чат остался за пределами окна

    const PREFIX = 'neko-chat-box-';
    const STORAGE_ID_KEY = 'neko_chat_last_id';
    const POS_KEY = 'neko_chat_box_pos';

    if (RESET_ON_START) {
        localStorage.removeItem(STORAGE_ID_KEY);
        localStorage.removeItem(POS_KEY);
    }

    let lastId = parseInt(localStorage.getItem(STORAGE_ID_KEY) || '0', 10);
    let savedPos = JSON.parse(localStorage.getItem(POS_KEY) || 'null') ||
        { left: null, top: null, width: '20%', height: '40%' };

    let USERNAME = 'Guest' + Math.floor(100 + Math.random() * 900);
    const HEARTBEAT_INTERVAL = 25000;
    const BOX_ID = 'neko-chat-box';
    let latestVersion = EXT_VERSION;
    const WS_URL = 'wss://myangelfujiya.ru/chat/ws';
    //const WS_URL = 'ws://127.0.0.1:8000/chat/ws'; dev server

    let wsConnection = null;
    const chatHistory = [];

    let sendButton;
    let input;
    let log;
    let lastMessageTime = null;
    let lastUserCount = 0;

    let justifyText = false
    let snowEnabled = true;


    const AVATAR_URL_SERVER = "https://raw.githubusercontent.com/fujiyaa/osu-expansion-neko-science/refs/heads/main/chat_icons/server-avatar.png"
    const soundChat = new Audio("https://fujiyaa.github.io/forum/extras/default_chat.mp3");
    soundChat.volume = 0.2;


    const nickColors = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4','#46f0f0','#f032e6','#bcf60c','#fabebe'];
    const nickMap = {};
    let availableColors = [...nickColors];

    function getNickColor(nick) {
        if (nick === 'System') return 'red';
        if (nickMap[nick]) return nickMap[nick];
        if (availableColors.length === 0) availableColors = [...nickColors];
        const idx = Math.floor(Math.random() * availableColors.length);
        const color = availableColors[idx];
        nickMap[nick] = color;
        availableColors.splice(idx, 1);
        return color;
    }

    function initChat() {
        let existingBox = document.querySelector('#' + BOX_ID);
        if (existingBox) return;

        (function() {
            const SNOWFLAKE_COUNT = 80;
            const SNOWFLAKE_MIN_SPEED = 0.3;
            const SNOWFLAKE_MAX_SPEED = 0.5;
            const SNOWFLAKE_RADIUS = 5.0;
            const ACCUMULATION_LIMIT = 20;

            const canvas = document.createElement('canvas');
            canvas.id = 'snowCanvas';
            document.body.appendChild(canvas);

            Object.assign(canvas.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '0'
            });
            const ctx = canvas.getContext('2d');
            let w = canvas.width = window.innerWidth;
            let h = canvas.height = window.innerHeight;

            const snowLayer = document.createElement('canvas');
            const snowCtx = snowLayer.getContext('2d');
            snowLayer.width = w;
            snowLayer.height = h;

            let accumulation = new Array(w).fill(0);

            let snowflakes = [];
            for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
                const speed = SNOWFLAKE_MIN_SPEED + Math.random() * (SNOWFLAKE_MAX_SPEED - SNOWFLAKE_MIN_SPEED);

                snowflakes.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    speed: speed,
                    radius: SNOWFLAKE_RADIUS * (speed / SNOWFLAKE_MAX_SPEED),
                    drift: 0
                });
            }

            let mouseX = 0;
            let lastMouseX = 0;

            //window.addEventListener('mousemove', e => {
            //    mouseX = e.clientX;
            //});

            window.addEventListener('resize', () => {
                w = canvas.width = window.innerWidth;
                h = canvas.height = window.innerHeight;

                snowLayer.width = w;
                snowLayer.height = h;

                accumulation = new Array(w).fill(0);
                updateSnowLayer();
            });


            function updateSnowLayer() {
                snowCtx.clearRect(0, 0, w, h);
                snowCtx.fillStyle = 'rgba(255,255,255,0.7)';
                snowCtx.beginPath();

                for (let i = 0; i < w; i++) {
                    let height = accumulation[i];
                    if (height > 0) {
                        snowCtx.rect(i, h - height, 1, height);
                    }
                }

                snowCtx.fill();
            }

            function drawSnow() {
                if (!snowEnabled) {
                    requestAnimationFrame(drawSnow);
                    return;
                }

                ctx.clearRect(0, 0, w, h);

                let deltaX = mouseX - lastMouseX;

                snowflakes.forEach(flake => {
                    flake.drift = -deltaX * 0.05;

                    let idx = Math.floor(flake.x);
                    if (idx < 0) idx = 0;
                    if (idx >= w) idx = w - 1;

                    let normalizedY = flake.y / (h - accumulation[idx]);
                    normalizedY = Math.min(1, normalizedY);

                    let minSpeedFactor = 0.3;
                    let speedFactor = minSpeedFactor + (1 - minSpeedFactor) * Math.exp(-3 * normalizedY);
                    let vy = flake.speed * speedFactor;

                    flake.x += flake.drift;
                    flake.y += vy;

                    if (flake.x < 0) flake.x += w;
                    if (flake.x > w) flake.x -= w;

                    if (flake.y >= h - accumulation[idx]) {
                        accumulation[idx] = Math.min(accumulation[idx] + 0.7, ACCUMULATION_LIMIT);
                        if (idx > 0) accumulation[idx - 1] = Math.min(accumulation[idx - 1] + 0.3, ACCUMULATION_LIMIT);
                        if (idx < w - 1) accumulation[idx + 1] = Math.min(accumulation[idx + 1] + 0.3, ACCUMULATION_LIMIT);

                        updateSnowLayer();
                        flake.y = 0;
                        flake.x = Math.random() * w;
                    }

                    ctx.beginPath();
                    ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                    ctx.fill();
                });

                ctx.drawImage(snowLayer, 0, 0);

                lastMouseX = mouseX;
                requestAnimationFrame(drawSnow);
            }

            drawSnow();

        })();

        const elements = document.querySelectorAll('.osu-page--forum, .osu-page--forum-topic');

        elements.forEach(el => {
            const style = getComputedStyle(el);
            let bg = style.backgroundColor;

            let rgba;
            if (bg.startsWith('rgb(')) {
                rgba = bg.replace('rgb(', 'rgba(').replace(')', ', 0.9)');
            } else if (bg.startsWith('rgba(')) {
                rgba = bg.replace(/rgba\(([^)]+),\s*([0-9.]+)\)/, 'rgba($1, 0.9)');
            } else {
                rgba = bg;
                console.warn('damn', el, '???', bg);
            }

            Object.assign(el.style, {
                zIndex: '1',
                backgroundColor: rgba
            });
        });

        lastId++;
        localStorage.setItem(STORAGE_ID_KEY, lastId);
        const boxId = PREFIX + lastId;

        const box = document.createElement('div');
        box.id = boxId;
        Object.assign(box.style, {
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: 'rgb(42,34,38)',
            borderRadius: '10px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif',
            overflow: 'hidden',
            left: savedPos.left || 'auto',
            top: savedPos.top || 'auto',
            right: savedPos.left ? 'auto' : '10px',
            bottom: savedPos.top ? 'auto' : '10px',
            width: savedPos.width,
            height: savedPos.height,
        });

        const header = document.createElement('div');
        header.classList.add('chat-element-resize-ready');
        header.classList.add('chat-element-resize-ready');
        header.textContent = 'chat ';
        Object.assign(header.style, {
            background: 'rgb(70,57,63)',
            color: '#fff',
            padding: '6px 10px',
            cursor: 'move',
            fontWeight: 'bold',
            fontSize: '18px',
            flexShrink: 0
        });

        let userCount = document.createElement('span');
        userCount.classList.add('chat-element-resize-ready');
        userCount.classList.add('chat-user-count');
        Object.assign(userCount.style, {
            marginLeft: '10px',
            fontSize: '14px',
            fontWeight: 'normal',
            color: '#ccc'
        });
        userCount.textContent = `${lastUserCount} online`;
        header.appendChild(userCount);

        let log = document.createElement('div');
        log.id = 'log';
        Object.assign(log.style, {
            flex: 1,
            padding: '8px',
            overflowY: 'auto',
            fontSize: '16px',
            color: '#fff',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
        });

        const input = document.createElement('input');
        Object.assign(input.style, {
            border: 'none',
            padding: '8px',
            outline: 'none',
            fontSize: '16px',
            color: '#fff',
            background: 'rgb(70,57,63)',
            width: '100%',
            boxSizing: 'border-box',
            flexShrink: 0,
            paddingRight: '48px'
        });
        input.placeholder = 'Написать...';
        input.maxLength = 300;

        box.append(header, log, input);
        document.body.appendChild(box);
        // Overlay для увеличения изображений
        const imageOverlay = document.createElement('div');
        imageOverlay.id = 'neko-image-overlay';
        Object.assign(imageOverlay.style, {
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.85)',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000001',
            cursor: 'zoom-out'
        });

        const overlayImg = document.createElement('img');
        Object.assign(overlayImg.style, {
            maxWidth: '90vw',
            maxHeight: '90vh',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(0,0,0,0.6)',
            objectFit: 'contain'
        });

        imageOverlay.appendChild(overlayImg);
        document.body.appendChild(imageOverlay);

        imageOverlay.addEventListener('click', () => {
            imageOverlay.style.display = 'none';
            overlayImg.src = '';
        });


        const settingsBtn = document.createElement('span');
        settingsBtn.textContent = '⚙️';
        Object.assign(settingsBtn.style, {
            position: 'absolute',
            right: '8px',
            top: '4px',
            cursor: 'pointer',
            fontSize: '20px',
            userSelect: 'none',
            color: '#fff',
            transition: 'transform 0.2s',
            zIndex: 10
        });
        settingsBtn.addEventListener('mouseenter', () => settingsBtn.style.transform = 'rotate(30deg)');
        settingsBtn.addEventListener('mouseleave', () => settingsBtn.style.transform = 'rotate(0deg)');
        header.style.position = 'relative';
        header.appendChild(settingsBtn);

        const settingsPanel = document.createElement('div');
        Object.assign(settingsPanel.style, {
            height: '0',
            background: 'rgb(55,45,50)',
            overflow: 'hidden',
            transition: 'height 0.4s ease',
            color: '#fff',
            padding: '0 10px',
            boxSizing: 'border-box',
            fontFamily: 'Arial, sans-serif',
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.1)'
        });
        settingsPanel.innerHTML = `
        <style>
        .toggle-label {
  display: block;
  margin-bottom: 10px; /* одинаковый отступ */
  cursor: pointer;
  line-height: 1.4;
}
.toggle-label input[type="checkbox"] {
  margin-right: 6px;
}
</style>

     <div style="font-weight:bold; font-size:18px; margin-top:10px; margin-bottom:8px;">Настройки</div>

<label class="toggle-label">
  Нeконейм:
  <input type="text" id="nick-input" placeholder="${USERNAME}" style="margin-left:8px; padding:4px; font-size:14px; width:180px; border-radius:1px; border:none;">
</label>

<label class="toggle-label">
  <strong>Авторизация:</strong>
  <a href="https://myangelfujiya.ru/chat/auth" target="_blank" style="color:#ff66aa; text-decoration:none; font-weight:500;">myangelfujiya.ru/chat/auth</a>
</label>

<label class="toggle-label">
  <input type="checkbox" id="sound-toggle">
  Включить звуки
</label>

<label class="toggle-label">
  <input type="checkbox" id="theme-toggle">
  Светлая тема
</label>

<label class="toggle-label">
  <input type="checkbox" id="snow-toggle">
  Снег
</label>

<label class="toggle-label">
  <input type="checkbox" id="reset-on-start-toggle">
  Сброс положения - если выключено, всегда сохраняет положение и размер, но может оставить чат за пределами окна
</label>

<label class="toggle-label">
  <input type="checkbox" id="justify-text-toggle">
  Выравнивание текста по ширине - лучше не включать
</label>

<label class="toggle-label">
  Размер шрифта:
  <input type="range" id="font-size-slider" min="12" max="32" value="18" style="width:80%; margin-top:4px;">
</label>



    `;
        box.appendChild(settingsPanel);


        const resetToggle = settingsPanel.querySelector('#reset-on-start-toggle');
        const justifyToggle = settingsPanel.querySelector('#justify-text-toggle');


        const savedReset = localStorage.getItem('chat_resetOnStart');
        RESET_ON_START = savedReset !== null ? savedReset === 'true' : false;
        resetToggle.checked = RESET_ON_START;

        const savedJustify = localStorage.getItem('chat_justifyText');
        justifyText = savedJustify !== null ? savedJustify === 'true' : false;
        justifyToggle.checked = justifyText;


        resetToggle.addEventListener('change', () => {
            RESET_ON_START = resetToggle.checked;
            localStorage.setItem('chat_resetOnStart', RESET_ON_START);
        });

        justifyToggle.addEventListener('change', () => {
            justifyText = justifyToggle.checked;
            localStorage.setItem('chat_justifyText', justifyText);
        });


        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Сбросить';
        Object.assign(resetBtn.style, {
            padding: '4px 8px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            background: 'rgb(180,50,50)',
            color: '#fff'
        });
        settingsPanel.appendChild(resetBtn);

        const updateBtn = document.createElement('span');
        updateBtn.textContent = '🔄';
        Object.assign(updateBtn.style, {
            position: 'absolute',
            right: '40px',
            top: '4px',
            cursor: 'pointer',
            fontSize: '20px',
            userSelect: 'none',
            color: '#fff',
            transition: 'transform 0.2s',
            zIndex: 10,
            display: 'none'
        });
        updateBtn.addEventListener('mouseenter', () => updateBtn.style.transform = 'rotate(30deg)');
        updateBtn.addEventListener('mouseleave', () => updateBtn.style.transform = 'rotate(0deg)');
        header.appendChild(updateBtn);

        const pulseStyle = document.createElement('style');
        pulseStyle.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      .pulse {
        animation: pulse 1s infinite;
      }
    `;
        document.head.appendChild(pulseStyle);

        const snowToggle = settingsPanel.querySelector('#snow-toggle');
        const savedSnow = localStorage.getItem('chat_snow');

        snowToggle.checked = savedSnow !== null ? savedSnow === 'true' : true;
        snowEnabled = snowToggle.checked;

        const snowCanvas = document.getElementById('snowCanvas');
        if (snowCanvas) snowCanvas.style.display = snowEnabled ? 'block' : 'none';

        snowToggle.addEventListener('change', () => {
            snowEnabled = snowToggle.checked;
            localStorage.setItem('chat_snow', snowEnabled);
            if (snowCanvas) snowCanvas.style.display = snowEnabled ? 'block' : 'none';
        });

        const soundToggle = settingsPanel.querySelector('#sound-toggle');

        const savedSound = localStorage.getItem('chat_sounds');
        soundToggle.checked = savedSound !== null ? savedSound === 'true' : false;


        soundToggle.addEventListener('change', () => {
            localStorage.setItem('chat_sounds', soundToggle.checked);
        });


        const updatePanel = document.createElement('div');
        Object.assign(updatePanel.style, {
            height: '0',
            background: 'rgb(60,50,55)',
            overflow: 'hidden',
            transition: 'height 0.4s ease',
            color: '#fff',
            padding: '0 10px',
            boxSizing: 'border-box',
            fontFamily: 'Arial, sans-serif',
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.1)'
        });
        updatePanel.innerHTML = `
      <div style="font-weight:bold; font-size:18px; margin-top:10px; margin-bottom:8px;">🔄 Обновление</div>
      <div style="font-size:14px; margin-bottom:4px;">Текущая версия: ${EXT_VERSION}</div>
      <div style="font-size:14px; margin-bottom:8px;">Доступна новая версия: ${latestVersion}</div>
      <div style="font-size:12px; margin:0;">
        <a href="https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/osu-expansion-neko-science.user.js" target="_blank" style="color:#4ea1f3; text-decoration:underline;">
          Установить сейчас
        </a>
      </div>
    `;
        box.appendChild(updatePanel);

        let panelOpen = false;
        let updatePanelOpen = false;

        const nickInput = settingsPanel.querySelector('#nick-input');
        nickInput.style.background = 'rgb(50,40,45)';
        nickInput.style.color = '#fff';
        nickInput.style.border = 'none';
        nickInput.style.padding = '4px';
        nickInput.style.borderRadius = '1px';

        const themeToggle = settingsPanel.querySelector('#theme-toggle');
        const fontSlider = settingsPanel.querySelector('#font-size-slider');

        (function(){
            const savedUsername = localStorage.getItem('chat_username');
            if (savedUsername) {
                USERNAME = savedUsername;
                nickInput.value = USERNAME;
            }
            const savedDarkTheme = localStorage.getItem('chat_darkTheme');
            if (savedDarkTheme !== null) {
                const isLight = savedDarkTheme === 'true';
                themeToggle.checked = isLight;
                if (isLight) {
                    box.style.background = 'rgb(240,240,240)';
                    log.style.color = '#000';
                    input.style.background = 'rgb(220,220,220)';
                    input.style.color = '#000';
                } else {
                    box.style.background = 'rgb(42,34,38)';
                    log.style.color = '#fff';
                    input.style.background = 'rgb(70,57,63)';
                    input.style.color = '#fff';
                }
            }
            const savedFontSize = localStorage.getItem('chat_fontSize');
            if (savedFontSize) {
                fontSlider.value = savedFontSize;
                log.style.fontSize = savedFontSize + 'px';
                input.style.fontSize = savedFontSize + 'px';
                document.querySelectorAll('.chat-time').forEach(ts => {
                    ts.style.fontSize = savedFontSize + 'px';
                });
                document.querySelectorAll('.chat-element-resize-ready').forEach(ts => {
                    ts.style.fontSize = savedFontSize + 'px';
                });

                localStorage.setItem('chat_fontSize', fontSlider.value);
            }
        })();

        function updateSendButtonVisibility() {
            if (panelOpen || updatePanelOpen) sendButton.style.display = 'none';
            else sendButton.style.display = 'block';
        }

        settingsBtn.addEventListener('click', () => {
            if (!panelOpen) {
                updatePanel.style.height = '0';
                updatePanelOpen = false;
            }
            panelOpen = !panelOpen;
            settingsPanel.style.height = panelOpen ? settingsPanel.scrollHeight + 'px' : '0';
            updateSendButtonVisibility();
        });

        updateBtn.addEventListener('click', () => {
            if (!updatePanelOpen) {
                settingsPanel.style.height = '0';
                panelOpen = false;
            }
            updatePanelOpen = !updatePanelOpen;
            updatePanel.style.height = updatePanelOpen ? updatePanel.scrollHeight + 'px' : '0';
            updateSendButtonVisibility();
        });

        nickInput.addEventListener('change', () => {
            if (nickInput.value.trim() !== '') {
                USERNAME = nickInput.value.trim();
                localStorage.setItem('chat_username', USERNAME);
            }
        });

        themeToggle.addEventListener('change', () => {
            const dark = !themeToggle.checked;
            box.style.background = dark ? 'rgb(42,34,38)' : 'rgb(240,240,240)';
            log.style.color = dark ? '#fff' : '#000';
            input.style.background = dark ? 'rgb(70,57,63)' : 'rgb(220,220,220)';
            input.style.color = dark ? '#fff' : '#000';
            localStorage.setItem('chat_darkTheme', themeToggle.checked);
        });

        fontSlider.addEventListener('input', () => {
            log.style.fontSize = fontSlider.value + 'px';
            input.style.fontSize = fontSlider.value + 'px';
            document.querySelectorAll('.chat-time').forEach(ts => {
                ts.style.fontSize = fontSlider.value + 'px';
            });
            document.querySelectorAll('.chat-element-resize-ready').forEach(ts => {
                ts.style.fontSize = fontSlider.value + 'px';
            });

            localStorage.setItem('chat_fontSize', fontSlider.value);
        });

        resetBtn.addEventListener('click', () => {
            USERNAME = 'Guest' + Math.floor(100 + Math.random() * 900);
            nickInput.value = USERNAME;
            themeToggle.checked = false;
            fontSlider.value = 16;
            box.style.background = 'rgb(42,34,38)';
            log.style.color = '#fff';
            input.style.background = 'rgb(70,57,63)';
            input.style.color = '#fff';
            log.style.fontSize = '16px';
            input.style.fontSize = '16px';
            localStorage.setItem('chat_username', USERNAME);
            localStorage.setItem('chat_darkTheme', false);
            localStorage.setItem('chat_fontSize', 16);
            localStorage.setItem('chat_sounds', 'false');
            soundToggle.checked = false;
        });

        const style = document.createElement('style');
        style.textContent = `
      #log::-webkit-scrollbar { width: 4px; }
      #log::-webkit-scrollbar-thumb { background-color: #555; border-radius: 2px; }
      #log::-webkit-scrollbar-track { background-color: #222; }
      .chat-message { opacity: 0; transform: translateY(10px); animation: fadeInUp 0.3s forwards; }
      @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
    `;
        document.head.appendChild(style);

        let dragging=false, offsetX=0, offsetY=0;
        header.addEventListener('mousedown', e => {
            dragging=true;
            offsetX = e.clientX - box.offsetLeft;
            offsetY = e.clientY - box.offsetTop;
        });
        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                localStorage.setItem(POS_KEY, JSON.stringify(savedPos));
            }
        });
        document.addEventListener('mousemove', e => {
            if(dragging){
                const newLeft = e.clientX - offsetX;
                const newTop = e.clientY - offsetY;
                box.style.left = newLeft + 'px';
                box.style.top = newTop + 'px';
                box.style.right='auto';
                box.style.bottom='auto';
                savedPos.left = box.style.left;
                savedPos.top = box.style.top;
            }
        });

        const resizer = document.createElement('span');
        resizer.textContent = '◞︎';
        Object.assign(resizer.style,{
            fontSize:'28px', position:'absolute', right:'-2px', bottom:'-8px',
            cursor:'se-resize', zIndex:1000000, userSelect:'none'
        });
        box.appendChild(resizer);

        let resizing=false, startX, startY, startWidth, startHeight;
        resizer.addEventListener('mousedown', e=>{
            e.preventDefault();
            resizing=true;
            startX=e.clientX; startY=e.clientY;
            startWidth=box.offsetWidth; startHeight=box.offsetHeight;
        });
        document.addEventListener('mousemove', e=>{
            if(!resizing) return;
            const newWidth = Math.max(startWidth+(e.clientX-startX),200);
            const newHeight = Math.max(startHeight+(e.clientY-startY),150);
            box.style.width = newWidth + 'px';
            box.style.height = newHeight + 'px';
            savedPos.width = box.style.width;
            savedPos.height = box.style.height;
            localStorage.setItem(POS_KEY, JSON.stringify(savedPos));
        });
        document.addEventListener('mouseup', ()=>resizing=false);

        const tooltip = document.createElement('div');
        Object.assign(tooltip.style, {
            position: 'fixed',
            padding: '4px 8px',
            background: 'rgba(20,20,20,0.9)',
            color: '#fff',
            fontSize: '13px',
            borderRadius: '4px',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.2s',
            zIndex: '10000000'
        });
        document.body.appendChild(tooltip);

        document.addEventListener('mousemove', e => {
            tooltip.style.left = e.clientX + 10 + 'px';
            tooltip.style.top = e.clientY + 10 + 'px';
        });

        function makeLinksClickable(text) {
            const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

            return text.replace(urlRegex, url => {
                const href = url.startsWith('http') ? url : 'https://' + url;

                const chatContainer = document.getElementById('chat-container');
                const chatHeight = chatContainer ? chatContainer.clientHeight : 400;
                const maxImgHeight = chatHeight * 0.5;

                // YouTube видео
                const ytMatch = href.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                if (ytMatch) {
                    const videoId = ytMatch[1];
                    const embedUrl = `https://www.youtube.com/embed/${videoId}`;

                    return `<iframe width="288" height="162"
                        src="${embedUrl}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                        style="border-radius:6px; box-shadow:0 0 2px rgba(0,0,0,0.3); vertical-align:top;"></iframe><a href="${href}" target="_blank" rel="noopener noreferrer" style="font-size:0.85em; color:#66b3ff;">🔗</a>`;
                }

                // Изображения
                if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(href)) {
                    return `
<div style="display:flex; flex-wrap:wrap; align-items:flex-start; gap:6px; padding-top:0;">
    <!-- левый блок -->
    <div style="width:5ch; flex-shrink:0;"></div>

    <!-- картинка + ссылка -->
    <img src="${href}"
         loading="lazy"
         class="neko-chat-img"
         style="
            width:auto;
            height:auto;
            max-width:90%;
            max-height:${maxImgHeight}px;
            border-radius:6px;
            box-shadow:0 0 4px rgba(0,0,0,0.4);
            cursor:zoom-in;
            object-fit:contain;
         "
         onerror="this.style.display='none';"
         onclick="
            const overlay = document.getElementById('neko-image-overlay');
            const overlayImg = overlay.querySelector('img');
            overlayImg.src='${href}';
            overlay.style.display='flex';
         ">
    <a href="${href}" target="_blank" rel="noopener noreferrer"
       style="flex-shrink:0; color:#66b3ff; font-size:14px; text-decoration:none; white-space:nowrap; margin:0;">🔗</a>
</div>`;
                }

                // Обычная ссылка или текст
                return `<div style="margin-top:0;">${url.startsWith('http') ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#66b3ff; text-decoration:underline;">${url}</a>` : url}</div>`;
            });
        }


        function getLog() {
            let currentLog = document.querySelector('#log');
            if (!currentLog) {
                currentLog = document.createElement('div');
                currentLog.id = 'log';
                Object.assign(currentLog.style, {
                    flex: 1,
                    padding: '8px',
                    overflowY: 'auto',
                    fontSize: '16px',
                    color: '#fff',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                });
                box.appendChild(currentLog);
            }
            log = currentLog;
            return currentLog;
        }
        function getUserCount() {
            let currentCount = document.querySelector('.chat-user-count');

            if (!currentCount || !document.body.contains(currentCount)) {
                currentCount = document.createElement('span');
                currentCount.classList.add('chat-element-resize-ready', 'chat-user-count');
                Object.assign(currentCount.style, {
                    marginLeft: '10px',
                    fontSize: '14px',
                    fontWeight: 'normal',
                    color: '#ccc'
                });
                currentCount.textContent = '0 online';
                box.appendChild(currentCount);
            }

            return currentCount;
        }

        function logMessage(username, text, avatarUrl, tooltipText, timestamp = "", skipSound = false, restoring = false) {

            if (!restoring){
                chatHistory.push({ username, text, avatarUrl, tooltipText, timestamp });
            }

            const log = getLog();
            const savedFontSize = localStorage.getItem('chat_fontSize');

            const line = document.createElement('div');
            line.classList.add('chat-message');
            Object.assign(line.style, {
                display: 'block',
                marginBottom: '4px',
                lineHeight: '1.3em',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
            });

            const content = document.createElement('span');
            Object.assign(content.style, {
                display: 'inline-block',
                maxWidth: '100%',
                textAlign: justifyText ? 'justify' : 'left',
                textAlignLast: 'left',
                wordSpacing: justifyText ? '0.2em' : 'normal'
            });

            let timeSpan = document.createElement('span');
            timeSpan.classList.add('chat-time');

            if (timestamp) {
                let ts = timestamp;
                const hasTimezone = /Z$|[+-]\d\d:\d\d$/.test(ts);
                if (!hasTimezone) ts += 'Z';

                const date = new Date(ts);
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const formattedTime = `${hours}:${minutes}`;

                timeSpan.textContent = formattedTime;

                if (lastMessageTime === formattedTime) {
                    timeSpan.style.color = '#414141ff'; 
                } else {
                    timeSpan.style.color = '#d0d0d0ff';
                    lastMessageTime = formattedTime;
                }

                Object.assign(timeSpan.style, {
                    fontSize: `${savedFontSize || 16}px`,
                    marginRight: '6px',
                    verticalAlign: 'middle',
                    display: 'inline-block',
                    width: '5ch',
                    fontFamily: 'monospace'
                });
            }

            content.appendChild(timeSpan);


            const avatar = document.createElement('img');
            avatar.src = avatarUrl || 'https://raw.githubusercontent.com/fujiyaa/osu-expansion-neko-science/refs/heads/main/chat_icons/guest-avatar.png';
            Object.assign(avatar.style, {
                width: '1.2em',
                height: '1.2em',
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: '0 0 2px rgba(0,0,0,0.4)',
                marginRight: '4px',
                verticalAlign: 'middle'
            });
            avatar.addEventListener('mouseenter', () => { tooltip.textContent = tooltipText || username; tooltip.style.opacity = '1'; });
            avatar.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

            let nameNode;
            const isAuthorized =
                avatarUrl &&
                !avatarUrl.includes('guest-avatar') ||
                (tooltipText && tooltipText.toLowerCase().includes('verified'));

            if (isAuthorized && username !== "Сервер") {
                const link = document.createElement('a');
                link.href = `https://osu.ppy.sh/users/${encodeURIComponent(username)}`;
                link.target = '_blank';
                link.textContent = username + ' ';

                Object.assign(link.style, {
                    fontWeight: 'bold',
                    color: getNickColor(username),
                    marginRight: '4px',
                    verticalAlign: 'middle',
                    textDecoration: 'none',
                    cursor: 'pointer'
                });

                link.addEventListener('mouseenter', () => link.style.textDecoration = 'underline');
                link.addEventListener('mouseleave', () => link.style.textDecoration = 'none');

                nameNode = link;
            } else {
                const span = document.createElement('span');
                span.textContent = username + ':';

                Object.assign(span.style, {
                    fontWeight: 'bold',
                    color: getNickColor(username),
                    marginRight: '4px',
                    verticalAlign: 'middle'
                });

                nameNode = span;
            }

            let adjustedText = text;

            const firstSpace = text.indexOf(' ');
            const firstWord = firstSpace === -1 ? text : text.slice(0, firstSpace);
            if (firstWord.length > 15) {
                adjustedText = ' ' + text;
            }

            const textSpan = document.createElement('span');
            textSpan.innerHTML = makeLinksClickable(adjustedText);
            textSpan.style.verticalAlign = 'middle';

            content.appendChild(avatar);
            content.appendChild(nameNode);
            content.appendChild(textSpan);

            line.appendChild(content);
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;

            if (!skipSound && soundToggle.checked) {
                soundChat.play().catch(e => console.error("Audio play failed:", e));
            }

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    log.scrollTop = log.scrollHeight;
                });
            });
        }

        function restoreChatHistory() {
            const log = getLog();

            if (!chatHistory.length) return;
            log.innerHTML = '';
            chatHistory.forEach(msg => {
                logMessage(msg.username, msg.text, msg.avatarUrl, msg.tooltipText, msg.timestamp, true, true);
            });
        }

        function createWebSocketConnection() {
            if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
                //console.log("reusing existing WebSocket");
                getUserCount().textContent = `${lastUserCount} online`;
                restoreChatHistory();
                setupInputSender(wsConnection);
                setupSendButton();
                return wsConnection;
            }

            const ws = new WebSocket(WS_URL);
            const state = { heartbeat: null };

            ws.onopen = () => handleOpen(ws, state);
            ws.onclose = () => handleClose(state);
            ws.onmessage = handleMessage;
            ws.onerror = handleError;


            wsConnection = ws;
            return ws;
        }


        function handleOpen(ws, state) {
            logMessage('Сервер','✅ Подключено', AVATAR_URL_SERVER);

            ws.send(JSON.stringify({
                type: 'auth',
                username: USERNAME,
                version: EXT_VERSION
            }));

            setupInputSender(ws);
            setupSendButton();

            state.heartbeat = startHeartbeat(ws);
        }

        function handleMessage(e) {
            try {
                const msg = JSON.parse(e.data);

                console.log(msg)

                if (msg.type === 'heartbeat') return;
                if (msg.total_users !== undefined) {
                    lastUserCount = msg.total_users
                    getUserCount().textContent = `${msg.total_users} online`;
                }
                if (msg.type === 'online_refresh') {
                    getUserCount().textContent = `${msg.total_users} online`;
                    return;
                }
                if (msg.type === 'update_available') {
                    return showUpdateMessage(msg);
                }
                if (msg.type === 'error') {
                    return logMessage('Сервер', `⚠️ ${msg.message}`, AVATAR_URL_SERVER)
                }
                if (msg.type === 'history_bulk') {
                    msg.messages.forEach(m => {
                        logMessage(m.username, m.message, m.avatar, m.tooltip, m.timestamp, true);
                    });
                }
                if (msg.type === 'message') {
                    return logMessage(msg.username, msg.message, msg.avatar, msg.tooltip, msg.timestamp);
                }

            } catch {
                logMessage('System', e.data);
            }
        }

        function showUpdateMessage(msg) {
            logMessage('Сервер', `⚠️ ${msg.message}`, AVATAR_URL_SERVER);
            latestVersion = msg.latest_version;

            updatePanel.innerHTML = `
        <div style="font-weight:bold; font-size:18px; margin-top:10px; margin-bottom:8px;">🔄 Обновление</div>
        <div style="font-size:14px; margin-bottom:4px;">Текущая версия: ${EXT_VERSION}</div>
        <div style="font-size:14px; margin-bottom:8px;">Доступна новая версия: ${latestVersion}</div>
        <div style="font-weight:bold; font-size:18px; margin:0 0 16px 0;">
            <a href="https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/osu-expansion-neko-science.user.js"
               target="_blank"
               style="color:#4ea1f3; text-decoration:underline;">Установить сейчас</a>
        </div>
        <div style="font-size:14px; margin-bottom:28px;">
            Подсказка: дождись загрузки страницы со скриптом, нажми "Перезаписать". После этого обнови текущую страницу.
        </div>
    `;

            updateBtn.style.display = 'block';
            updateBtn.classList.add('pulse');
        }

        function startHeartbeat(ws) {
            return setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'heartbeat' }));
                }
            }, HEARTBEAT_INTERVAL);
        }

        function handleClose(state) {
            logMessage('Сервер','❌ Отключено', AVATAR_URL_SERVER);
            clearInterval(state.heartbeat);
            wsConnection = null;
        }

        function handleError() {
            logMessage('Сервер','⚠️ Нет связи', AVATAR_URL_SERVER);
        }

        function setupInputSender(ws) {
            if (!input) return;

            let cooldown = false;
            input.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                if (cooldown || input.value.trim() === '') return e.preventDefault();

                ws.send(JSON.stringify({
                    type: 'message',
                    username: USERNAME,
                    message: input.value.trim(),
                    timestamp: new Date().toISOString()
                }));

                input.value = '';
                cooldown = true;
                input.style.transition = '';
                input.style.background = 'rgb(0,102,51)';

                setTimeout(() => {
                    input.style.transition = 'background 0.5s';
                    input.style.background = 'rgb(70,57,63)';
                    cooldown = false;
                }, 1000);
            });
        }

        function setupSendButton() {
            sendButton = document.createElement('span');
            sendButton.textContent = '📨';
            Object.assign(sendButton.style, {
                fontSize: '32px',
                position: 'absolute',
                right: '4px',
                bottom: '4px',
                cursor: 'pointer',
                zIndex: 1000000,
                userSelect: 'none'
            });

            box.appendChild(sendButton);

            sendButton.addEventListener('click', () => {
                if (input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                if (input) input.focus();
            });
        }

        createWebSocketConnection();
    }

    function checkChatBox() {
        const expectedId = PREFIX + lastId;
        const existing = document.querySelector(`[id^="${PREFIX}"]`);

        if (!existing) {
            initChat();
            return;
        }

        if (existing.id !== expectedId) {
            existing.remove();
            initChat();
            return;
        }
    }

    setInterval(checkChatBox, 250);

})();

// Подвал
