// ==UserScript==
// @name         osu-expansion-neko-science
// @namespace    https://github.com/fujiyaa/osu-expansion-neko-science
// @version      0.3.3-beta
// @description  Расширение для осу очень нужное
// @author       Fujiya
// @match        https://osu.ppy.sh/*
// @grant        window.onurlchange
// @downloadURL  https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/inspector.user.js
// @updateURL    https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/inspector.user.js
// ==/UserScript==

// Что нового в 0.3.2 -> 0.3.3:
// - Видео и картинки отображаются в чате
// - HTML теги теперь не присылаются в чат (пока что)
 
(function() {
    'use strict';

    const RESET_ON_START = true;
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



    const WS_URL = 'wss://myangelfujiya.ru/neko-science/ws/chat';

    let USERNAME = 'Guest' + Math.floor(100 + Math.random() * 900);
    const HEARTBEAT_INTERVAL = 25000;
    const BOX_ID = 'neko-chat-box';
    const EXT_VERSION = '0.3.3-beta';
    let latestVersion = EXT_VERSION;

    const AVATAR_URL_TG = "https://raw.githubusercontent.com/fujiyaa/osu-expansion-neko-science/refs/heads/main/chat_icons/server-avatar.png"

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
        header.textContent = 'чат (neko-science)';
        Object.assign(header.style, {
            background: 'rgb(70,57,63)',
            color: '#fff',
            padding: '6px 10px',
            cursor: 'move',
            fontWeight: 'bold',
            fontSize: '18px',
            flexShrink: 0
        });

        const log = document.createElement('div');
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
        input.maxLength = 100;

        box.append(header, log, input);
        document.body.appendChild(box);

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
      <div style="font-weight:bold; font-size:18px; margin-top:10px; margin-bottom:8px;">Настройки</div>
      <label style="display:block; margin-bottom:8px;">
        Нeконейм:
        <input type="text" id="nick-input" placeholder="${USERNAME}" style="margin-left:8px; padding:4px; font-size:14px; width:120px; border-radius:4px; border:none;">
      </label>
      <label style="display:block; margin-bottom:10px; line-height:1.4;">
  Чтобы получить значок <strong>osu!</strong>, вставь в поле выше код, который появится после авторизации:
  <a href="https://myangelfujiya.ru/neko-science/auth-start" target="_blank" style="color:#ff66aa; text-decoration:none; font-weight:500;">
    myangelfujiya.ru/neko-science/auth-start
  </a>
</label><label style="display:block; margin-bottom:8px; cursor:pointer;">
    <input type="checkbox" id="sound-toggle" style="margin-right:6px;">
    Включить звуки
  </label>
      <label style="display:block; margin-bottom:8px; cursor:pointer;">
        <input type="checkbox" id="theme-toggle" style="margin-right:6px;">
        Светлая тема
      </label>
      <label style="display:block; margin-bottom:10px;">
        Размер шрифта:
        <input type="range" id="font-size-slider" min="12" max="24" value="16" style="width:100%; margin-top:4px;">
      </label>
    `;
        box.appendChild(settingsPanel);

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

        // YouTube
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
        const IMG_SCALE = 0.1
        // Изображения
        if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(href)) {
            return `<img src="${href}"
                         style="max-width:auto; max-height:12em; border-radius:6px; box-shadow:0 0 2px rgba(0,0,0,0.3); vertical-align:top; cursor:default;"
                         loading="lazy"
                         onerror="this.style.display='none';"><a href="${href}" target="_blank" rel="noopener noreferrer" style="font-size:0.85em; color:#66b3ff;">🔗</a>`;
        }

        // Ссылки
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#66b3ff; text-decoration:underline;">${url}</a>`;
    });
}

function logMessage(username, text, avatarUrl, tooltipText) {
    const line = document.createElement('div');
    line.classList.add('chat-message');
    Object.assign(line.style, {
        display: 'flex',
        alignItems: 'flex-start', // основной контейнер
        gap: '6px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        marginBottom: '4px'
    });

    // Аватар
    const avatar = document.createElement('img');
    avatar.src = avatarUrl || 'https://raw.githubusercontent.com/fujiyaa/osu-expansion-neko-science/refs/heads/main/chat_icons/guest-avatar.png';
    Object.assign(avatar.style, {
        alignItems: 'flex-start',
        width: '1.2em',
        height: '1.2em',
        borderRadius: '50%',
        cursor: 'pointer',
        boxShadow: '0 0 2px rgba(0,0,0,0.4)',
        flexShrink: 0,
        verticalAlign: 'middle'
    });
    avatar.addEventListener('mouseenter', () => { tooltip.textContent = tooltipText || username; tooltip.style.opacity = '1'; });
    avatar.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

    // Контейнер для ник + текст + медиа в одной строке
    const content = document.createElement('div');
    Object.assign(content.style, {
        alignItems: 'flex-start',
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: 'row',
        gap: '4px'
    });

    // Ник
    const nameSpan = document.createElement('span');
    nameSpan.textContent = username + ':';
    nameSpan.style.fontWeight = 'bold';
    nameSpan.style.color = getNickColor(username);

    // Текст + медиа
    const textSpan = document.createElement('span');
    textSpan.innerHTML = makeLinksClickable(text);

    content.appendChild(nameSpan);
    content.appendChild(textSpan);

    line.appendChild(avatar);
    line.appendChild(content);

    log.appendChild(line);
    log.scrollTop = log.scrollHeight;

    if (soundToggle.checked) {
        soundChat.play().catch(e => console.error("Audio play failed:", e));
    }
}



        const ws = new WebSocket(WS_URL);
        let heartbeat;
        ws.onopen = function(){
            logMessage('Сервер','✅ Подключено', AVATAR_URL_TG);
            ws.send(JSON.stringify({ type: 'auth', username: USERNAME, version: EXT_VERSION }));
            heartbeat=setInterval(()=>{
                if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'heartbeat'}));
            },HEARTBEAT_INTERVAL);
        };

        ws.onmessage = function(e) {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'update_available') {
                    logMessage('Сервер', `⚠️ ${msg.message}`, AVATAR_URL_TG);
                    latestVersion = msg.latest_version;
                    updatePanel.innerHTML = `
        <div style="font-weight:bold; font-size:18px; margin-top:10px; margin-bottom:8px;">🔄 Обновление</div>
        <div style="font-size:14px; margin-bottom:4px;">Текущая версия: ${EXT_VERSION}</div>
        <div style="font-size:14px; margin-bottom:8px;">Доступна новая версия: ${latestVersion}</div>
        <div style="font-weight:bold; font-size:18px; margin:0 0 16px 0;">
          <a href="https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/osu-expansion-neko-science.user.js" target="_blank" style="color:#4ea1f3; text-decoration:underline;">Установить сейчас</a>
        </div>
        <div style="font-size:14px; margin-bottom:28px;">Подсказка: дождись загрузки страницы со скриптом, нажми "Перезаписать". После этого обнови текущую страницу.</div>
      `;
                    updateBtn.style.display = 'block';
                    updateBtn.classList.add('pulse');
                    return;
                }
                if (msg.type === 'heartbeat') return;
                if (msg.type === 'message') {
                    logMessage(msg.username, msg.message, msg.avatar, msg.tooltip);
                }
            } catch {
                logMessage('System', e.data);
            }
        };
        ws.onclose = ()=>{ logMessage('Сервер','❌ Отключено', AVATAR_URL_TG); clearInterval(heartbeat); };
        ws.onerror = ()=>{ logMessage('Сервер','⚠️ Нет связи', AVATAR_URL_TG); };

        let cooldown=false;
        input.addEventListener('keydown', e=>{
            if(e.key==='Enter'){
                if(cooldown || input.value.trim()==='') return e.preventDefault();
                ws.send(JSON.stringify({type:'message',username:USERNAME,message:input.value.trim(),timestamp:new Date().toISOString()}));
                input.value='';
                cooldown=true;
                input.style.transition='';
                input.style.background='rgb(0,102,51)';
                setTimeout(()=>{
                    input.style.transition='background 0.5s';
                    input.style.background='rgb(70,57,63)';
                    cooldown=false;
                },1000);
            }
        });

        const sendButton=document.createElement('span');
        sendButton.textContent='📨';
        Object.assign(sendButton.style,{
            fontSize:'32px', position:'absolute', right:'4px', bottom:'4px',
            cursor:'pointer', zIndex:1000000, userSelect:'none'
        });
        box.appendChild(sendButton);
        sendButton.addEventListener('click', ()=>{ input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'})); input.focus(); });
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

    setInterval(checkChatBox, 500);


})();
