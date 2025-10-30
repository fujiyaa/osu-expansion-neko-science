// ==UserScript==
// @name         osu-expansion-neko-science
// @namespace    https://github.com/fujiyaa/osu-expansion-neko-science
// @version      1.0.1
// @description  Расширение для осу очень нужное
// @author       Fujiya
// @match        https://osu.ppy.sh/*
// @grant        window.onurlchange
// @downloadURL  https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/inspector.user.js
// @updateURL    https://github.com/fujiyaa/osu-expansion-neko-science/raw/main/inspector.user.js
// ==/UserScript==

(function() {
  'use strict';

  const WS_URL = 'ws://127.0.0.1:8010/ws/chat';
  let USERNAME = 'Guest' + Math.floor(100 + Math.random() * 900);
  const HEARTBEAT_INTERVAL = 25000;
  const BOX_ID = 'neko-chat-box';
  const EXT_VERSION = '1.0.1';
  let latestVersion = EXT_VERSION;

  // === Цвета и маппинг ников ===
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

  // === Сохраняем позицию и размер ===
  let savedPos = { left: null, top: null, width: '20%', height: '40%' };

  function initChat() {
    let existingBox = document.querySelector('#' + BOX_ID);
    if (existingBox) return;

    const box = document.createElement('div');
    box.id = BOX_ID;
    Object.assign(box.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: savedPos.width,
      height: savedPos.height,
      background: 'rgb(42,34,38)',
      borderRadius: '10px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
      left: savedPos.left,
      top: savedPos.top,
    });

    const header = document.createElement('div');
    header.textContent = '🧊 Чат (NekoScience)';
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

      // === Кнопка настроек ===
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

// === Панель настроек ===
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
    Ник:
    <input type="text" id="nick-input" placeholder="${USERNAME}" style="margin-left:8px; padding:4px; font-size:14px; width:120px; border-radius:4px; border:none;">
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

// === Кнопка сброса ===
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

// === Открытие/закрытие панели ===
let panelOpen = false;
settingsBtn.addEventListener('click', () => {
  if (!panelOpen) {
    // закрываем updatePanel, если открыта
    updatePanel.style.height = '0';
    updatePanelOpen = false;
  }
  panelOpen = !panelOpen;
  settingsPanel.style.height = panelOpen ? settingsPanel.scrollHeight + 'px' : '0';
});

// === Логика настроек ===
const nickInput = settingsPanel.querySelector('#nick-input');
// Всегда тёмный фон и светлый текст
nickInput.style.background = 'rgb(50,40,45)';
nickInput.style.color = '#fff';
nickInput.style.border = 'none';
nickInput.style.padding = '4px';
nickInput.style.borderRadius = '1px';

const themeToggle = settingsPanel.querySelector('#theme-toggle');
const fontSlider = settingsPanel.querySelector('#font-size-slider');

// === Загрузка сохранённых настроек и применение стилей ===
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
    // Применяем сразу стили
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

// Сохранение настроек при изменении
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

// Сброс настроек
resetBtn.addEventListener('click', () => {
  USERNAME = 'Fujiya';
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
});

// === Кнопка обновления ===
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
  display: 'none' // изначально скрыта
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

// === Панель обновления ===
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
  <div style="font-size:14px; margin-bottom:8px;">Здесь будут обновления чата</div>
`;
box.appendChild(updatePanel);

// === Открытие/закрытие панели обновления ===
let updatePanelOpen = false;
updateBtn.addEventListener('click', () => {
  if (!updatePanelOpen) {
    // закрываем settingsPanel, если открыта
    settingsPanel.style.height = '0';
    panelOpen = false;
  }
  updatePanelOpen = !updatePanelOpen;
  updatePanel.style.height = updatePanelOpen ? updatePanel.scrollHeight + 'px' : '0';

});
    // === CSS для скроллбара и анимации ===
    const style = document.createElement('style');
    style.textContent = `
      #log::-webkit-scrollbar { width: 4px; }
      #log::-webkit-scrollbar-thumb { background-color: #555; border-radius: 2px; }
      #log::-webkit-scrollbar-track { background-color: #222; }

      .chat-message {
        opacity: 0;
        transform: translateY(10px);
        animation: fadeInUp 0.3s forwards;
      }

      @keyframes fadeInUp {
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);

    // === Drag ===
    let dragging=false, offsetX=0, offsetY=0;
    header.addEventListener('mousedown', e => {
      dragging=true;
      offsetX = e.clientX - box.offsetLeft;
      offsetY = e.clientY - box.offsetTop;
    });
    document.addEventListener('mouseup', ()=>dragging=false);
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

    // === Resize ===
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
    });
    document.addEventListener('mouseup', ()=>resizing=false);

    // === Logging messages ===
    function logMessage(username,text){
      const line = document.createElement('div');
      line.classList.add('chat-message');
      line.style.marginBottom='4px';
      line.style.display='block';
      line.style.whiteSpace='pre-wrap';
      line.style.wordBreak='break-word';

      const nameSpan = document.createElement('span');
      nameSpan.textContent=username+': ';
      nameSpan.style.fontWeight='bold';
      nameSpan.style.color=getNickColor(username);
      line.appendChild(nameSpan);

      const textNode=document.createTextNode(text);
      line.appendChild(textNode);

      log.appendChild(line);
      log.scrollTop=log.scrollHeight;
    }

    // === WebSocket ===
    const ws = new WebSocket(WS_URL);
    let heartbeat;

    ws.onopen = function(){
      logMessage('System','🟢 Connected');
      ws.send(JSON.stringify({
          type: 'auth',
          username: USERNAME,
          version: EXT_VERSION
      }));
      heartbeat=setInterval(()=>{
        if(ws.readyState===WebSocket.OPEN){
          ws.send(JSON.stringify({type:'heartbeat'}));
        }
      },HEARTBEAT_INTERVAL);
    };

      ws.onmessage = function(e){
          try{
              const msg = JSON.parse(e.data);

              if(msg.type === 'update_available'){
                  logMessage('System', `⚠️ ${msg.message}`);
                  latestVersion = msg.latest_version;

                  updatePanel.innerHTML = `
      <div style="font-weight:bold; font-size:18px; margin-top:10px; margin-bottom:8px;">🔄 Обновление</div>
      <div style="font-size:14px; margin-bottom:4px;">Текущая версия: ${EXT_VERSION}</div>
      <div style="font-size:14px; margin-bottom:8px;">Доступна новая версия: ${latestVersion}</div>
      <div style="font-size:14px; margin-bottom:8px;">Здесь будут обновления чата</div>
    `;

                  updateBtn.style.display = 'block';
                  updateBtn.classList.add('pulse'); // включаем пульсацию
                  return;
              }

              if(msg.type === 'heartbeat') return;
              if(msg.type === 'message') logMessage(msg.username, msg.message);
          } catch {
              logMessage('System', e.data);
          }
      };
    ws.onclose = ()=>{ logMessage('System','🔴 Disconnected'); clearInterval(heartbeat); };
    ws.onerror = ()=>{ logMessage('System','⚠️ Connection error'); };

    // === Cooldown on Enter ===
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

    // === Send Button ===
    const sendButton=document.createElement('span');
    sendButton.textContent='📨';
    Object.assign(sendButton.style,{
      fontSize:'32px', position:'absolute', right:'4px', bottom:'4px',
      cursor:'pointer', zIndex:1000000, userSelect:'none'
    });
    box.appendChild(sendButton);
    sendButton.addEventListener('click', ()=>{
      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));
      input.focus();
    });
  }

  // === Проверяем каждые 500ms, чтобы SPA не удалял чат ===
  setInterval(() => {
    initChat();
  }, 500);

})();


