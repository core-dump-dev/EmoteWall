// Основной скрипт EmoteWall
(() => {
  // Получаем конфиг
  const cfg = window.EmoteWallConfig;
  
  // Префикс для логов
  const LOG_PREFIX = "[EmoteWall]";
  
  // Утилиты для логирования
  const log = (...args) => {
    console.log(LOG_PREFIX, ...args);
    if (cfg.debugLog) addDebugLog(...args);
  };
  
  const warn = (...args) => {
    console.warn(LOG_PREFIX, ...args);
    if (cfg.debugLog) addDebugLog('⚠️', ...args);
  };
  
  const error = (...args) => {
    console.error(LOG_PREFIX, ...args);
    if (cfg.debugLog) addDebugLog('❌', ...args);
  };
  
  const info = (...args) => {
    console.info(LOG_PREFIX, ...args);
    if (cfg.debugLog) addDebugLog('ℹ️', ...args);
  };
  
  // Тестовые эмодзи для каждой платформы
  const TEST_EMOTES = {
    '7tv': ['peepoHappy', 'EZ', 'PartyParrot'],
    'bttv': ['FeelsBadMan', 'bttvNice', ':tf:'],
    'ffz': ['ZreknarF', 'LaterSooner', 'BeanieHipster'],
    'twitch': ['4Head', 'Kappa', 'SMOrc']
  };
  
  // Глобальные переменные
  const emoteWall = document.getElementById('emote-wall');
  const statsPanel = document.getElementById('stats-panel');
  const testPanel = document.getElementById('test-panel');
  const loadingIndicator = document.getElementById('loading');
  const loadingStatus = document.getElementById('loading-status');
  const debugLogContainer = document.getElementById('debug-log-container');
  
  let activeEmotes = new Map(); // Map для активных эмодзи (id -> элемент)
  let emoteQueue = []; // Очередь эмодзи для отображения
  let emoteCount = 0; // Счетчик всех эмодзи
  let lastSpawnTime = 0; // Время последнего появления
  let lastEmoteName = null; // Последнее показанное эмодзи
  let emoteCombo = 0; // Счетчик комбо для текущего эмодзи
  let emotesLoaded = 0; // Загруженные эмодзи
  
  // Коллекции для разных платформ
  let chatEmotes = new Map(); // 7TV канальные
  let globalEmotes = new Map(); // 7TV глобальные
  let bttvEmotes = new Map(); // BTTV эмодзи
  let ffzEmotes = new Map(); // FFZ эмодзи
  
  // Для спам-фильтра
  let lastEmoteTimes = new Map(); // Время последнего показа каждого эмодзи
  
  // Для статистики FPS
  let lastFrameTime = 0;
  let frameCount = 0;
  let fps = 0;
  
  // Для физики
  let physicsEmotes = new Map(); // Эмодзи с физикой (id -> {element, vx, vy})
  
  // Для тестового режима
  let testInterval = null;
  let testEmotesPool = []; // Пул эмодзи для тестового режима
  let collectedTestEmotes = new Set(); // Уже собранные эмодзи для тестового режима
  
  // === Функция для показа дебаг-логов списком ===
  function addDebugLog(...args) {
    if (!cfg.debugLog || !debugLogContainer) return;
    
    // Создаем элемент лога
    const logElement = document.createElement('div');
    logElement.className = 'debug-log';
    
    // Форматируем текст
    const logText = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    // Добавляем временную метку
    const timestamp = new Date().toLocaleTimeString();
    logElement.textContent = `${timestamp}: ${logText}`;
    
    // Добавляем в контейнер (в начало)
    debugLogContainer.insertBefore(logElement, debugLogContainer.firstChild);
    
    // Ограничиваем количество логов
    const maxLogs = 15;
    while (debugLogContainer.children.length > maxLogs) {
      debugLogContainer.removeChild(debugLogContainer.lastChild);
    }
    
    // Удаляем после анимации (10 секунд)
    setTimeout(() => {
      if (logElement.parentNode === debugLogContainer) {
        logElement.style.opacity = '0';
        logElement.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
          if (logElement.parentNode === debugLogContainer) {
            debugLogContainer.removeChild(logElement);
          }
        }, 300);
      }
    }, 10000);
  }
  
  // === Функция обновления статуса загрузки ===
  function updateLoadingStatus(text) {
    if (loadingStatus) {
      loadingStatus.textContent = text;
    }
  }
  
  // === Функция скрытия индикатора загрузки ===
  function hideLoadingIndicator() {
    if (loadingIndicator) {
      loadingIndicator.style.opacity = '0';
      setTimeout(() => {
        if (loadingIndicator.parentNode) {
          loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
      }, 300);
    }
  }
  
  // === Обновление статистики ===
  function updateStats() {
    if (cfg.debug) {
      document.getElementById('emote-count').textContent = activeEmotes.size;
      document.getElementById('total-count').textContent = emoteCount;
      document.getElementById('fps').textContent = fps;
      document.getElementById('test-pool').textContent = testEmotesPool.length;
      statsPanel.classList.add('show');
    } else {
      statsPanel.classList.remove('show');
    }
    
    // Показываем панель тестового режима если он активен
    if (cfg.testMode) {
      document.getElementById('test-interval').textContent = cfg.testInterval;
      testPanel.classList.add('show');
    } else {
      testPanel.classList.remove('show');
    }
  }
  
  // === Расчет FPS ===
  function updateFPS(currentTime) {
    frameCount++;
    
    if (currentTime - lastFrameTime >= 1000) {
      fps = Math.round(frameCount);
      frameCount = 0;
      lastFrameTime = currentTime;
    }
  }
  
  // === Получение Twitch User ID ===
  async function getTwitchUserId(username) {
    try {
      const res = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return Array.isArray(data) && data[0]?.id ? data[0].id : null;
    } catch (e) {
      error("Не удалось получить Twitch User ID:", e.message);
      return null;
    }
  }
  
  // === Загрузка эмодзи с разных платформ ===
  async function loadEmotes(twitchUserId, channelName) {
    emotesLoaded = 0;
    const promises = [];
    
    updateLoadingStatus("Загрузка эмодзи...");
    
    // Загрузка 7TV эмодзи
    if (cfg.enable7tv) {
      promises.push(load7TVEmotes(twitchUserId));
    }
    
    // Загрузка BTTV эмодзи
    if (cfg.enableBTTV) {
      promises.push(loadBTTVEmotes(channelName));
    }
    
    // Загрузка FFZ эмодзи
    if (cfg.enableFFZ) {
      promises.push(loadFFZEmotes(channelName));
    }
    
    // Ожидаем завершения всех загрузок
    await Promise.all(promises);
    
    info(`✅ Загружено ${emotesLoaded} эмодзи`);
    
    // Инициализируем тестовый пул
    initTestEmotesPool();
  }
  
  async function load7TVEmotes(twitchUserId) {
    try {
      updateLoadingStatus("Загрузка 7TV эмодзи...");
      
      // Глобальные 7TV эмодзи
      const globalRes = await fetch('https://7tv.io/v3/emote-sets/global');
      if (globalRes.ok) {
        const data = await globalRes.json();
        for (const emote of data.emotes || []) {
          const url = build7TVUrl(emote);
          if (url) {
            globalEmotes.set(emote.name, url);
            emotesLoaded++;
          }
        }
        log(`✅ Загружено ${data.emotes?.length || 0} глобальных 7TV эмодзи`);
      }
      
      // Канальные 7TV эмодзи
      if (twitchUserId) {
        const channelRes = await fetch(`https://7tv.io/v3/users/twitch/${twitchUserId}`);
        if (channelRes.ok) {
          const data = await channelRes.json();
          const emotes = data?.emote_set?.emotes || [];
          for (const emote of emotes) {
            const url = build7TVUrl(emote.data);
            if (url) {
              chatEmotes.set(emote.name, url);
              emotesLoaded++;
            }
          }
          log(`✅ Загружено ${emotes.length} канальных 7TV эмодзи`);
        }
      }
    } catch (e) {
      error("Ошибка загрузки 7TV:", e.message);
    }
  }
  
  function build7TVUrl(emoteData) {
    if (!emoteData?.host?.files?.length) return null;
    const webpFiles = emoteData.host.files.filter(f => f.format === 'WEBP');
    if (webpFiles.length === 0) return null;
    webpFiles.sort((a, b) => a.width - b.width);
    const best = webpFiles[webpFiles.length - 1];
    const baseUrl = Array.isArray(emoteData.host.url)
      ? emoteData.host.url[0]
      : emoteData.host.url;
    return `https:${baseUrl}/${best.name}`;
  }
  
  async function loadBTTVEmotes(channelName) {
    try {
      updateLoadingStatus("Загрузка BTTV эмодзи...");
      
      // Глобальные BTTV
      const globalRes = await fetch('https://api.betterttv.net/3/cached/emotes/global');
      if (globalRes.ok) {
        const data = await globalRes.json();
        for (const emote of data || []) {
          bttvEmotes.set(emote.code, `https://cdn.betterttv.net/emote/${emote.id}/3x`);
          emotesLoaded++;
        }
        log(`✅ Загружено ${data?.length || 0} глобальных BTTV эмодзи`);
      }
      
      // Канальные BTTV
      const userId = await getTwitchUserId(channelName);
      if (userId) {
        const channelRes = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${userId}`);
        if (channelRes.ok) {
          const data = await channelRes.json();
          const emotes = [...(data.channelEmotes || []), ...(data.sharedEmotes || [])];
          for (const emote of emotes) {
            bttvEmotes.set(emote.code, `https://cdn.betterttv.net/emote/${emote.id}/3x`);
            emotesLoaded++;
          }
          log(`✅ Загружено ${emotes.length} канальных BTTV эмодзи`);
        }
      }
    } catch (e) {
      error("Ошибка загрузки BTTV:", e.message);
    }
  }
  
  async function loadFFZEmotes(channelName) {
    try {
      updateLoadingStatus("Загрузка FFZ эмодзи...");
      
      // Канальные FFZ
      const channelRes = await fetch(`https://api.frankerfacez.com/v1/room/${channelName}`);
      if (channelRes.ok) {
        const data = await channelRes.json();
        const sets = data.sets || {};
        for (const [setId, set] of Object.entries(sets)) {
          for (const emote of set.emoticons || []) {
            const url = emote.urls['4'] || emote.urls['2'] || emote.urls['1'];
            if (url) {
              const fullUrl = url.startsWith('http') ? url : `https:${url}`;
              ffzEmotes.set(emote.name, fullUrl);
              emotesLoaded++;
            }
          }
        }
        log(`✅ Загружено FFZ эмодзи канала ${channelName}`);
      }
    } catch (e) {
      error("Ошибка загрузки FFZ:", e.message);
    }
  }
  
  // === Инициализация тестового пула эмодзи ===
  function initTestEmotesPool() {
    testEmotesPool = [];
    collectedTestEmotes.clear();
    
    // Добавляем стандартные тестовые эмодзи
    Object.keys(TEST_EMOTES).forEach(platform => {
      TEST_EMOTES[platform].forEach(emoteName => {
        // Проверяем, доступно ли эмодзи
        const url = findEmoteUrl(emoteName);
        if (url) {
          testEmotesPool.push({ name: emoteName, url: url, source: 'standard' });
          collectedTestEmotes.add(emoteName);
        }
      });
    });
    
    if (cfg.debug) {
      log(`🧪 Инициализирован тестовый пул: ${testEmotesPool.length} эмодзи`);
    }
  }
  
  // === Добавление эмодзи в тестовый пул ===
  function addEmoteToTestPool(name, url) {
    // Проверяем, не добавлено ли уже это эмодзи
    if (collectedTestEmotes.has(name)) {
      return false;
    }
    
    // Проверяем, что URL существует
    if (!url) {
      const foundUrl = findEmoteUrl(name);
      if (!foundUrl) {
        return false;
      }
      url = foundUrl;
    }
    
    // Добавляем в пул
    testEmotesPool.push({ name: name, url: url, source: 'collected' });
    collectedTestEmotes.add(name);
    
    log(`🧪 Добавлено в тестовый пул: ${name} (собрано из чата)`);
    updateStats();
    
    return true;
  }
  
  // === Поиск URL эмодзи по имени ===
  function findEmoteUrl(name) {
    // Проверяем в порядке приоритета
    if (chatEmotes.has(name)) return chatEmotes.get(name);
    if (globalEmotes.has(name)) return globalEmotes.get(name);
    if (bttvEmotes.has(name)) return bttvEmotes.get(name);
    if (ffzEmotes.has(name)) return ffzEmotes.get(name);
    return null;
  }
  
  // === Создание элемента эмодзи ===
  function createEmoteElement(name, url) {
    const emoteId = `emote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Создаем контейнер
    const container = document.createElement('div');
    container.id = emoteId;
    container.className = 'emote';
    
    // Определяем размер
    let scale = cfg.emoteScale;
    if (cfg.randomScale) {
      scale = cfg.emoteMinScale + Math.random() * (cfg.emoteMaxScale - cfg.emoteMinScale);
    }
    
    const size = 128 * scale; // Базовый размер 128px
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    
    // Скругление углов
    container.style.borderRadius = `${cfg.borderRadius}px`;
    
    // Тень
    if (cfg.dropShadow) {
      container.style.filter = `drop-shadow(${cfg.shadowBlur}px ${cfg.shadowBlur}px ${cfg.shadowBlur}px ${cfg.shadowColor})`;
    }
    
    // Создаем изображение
    const img = document.createElement('img');
    img.src = url;
    img.alt = name;
    img.draggable = false;
    
    // Добавляем обработчик ошибок загрузки
    img.onerror = () => {
      warn(`Не удалось загрузить эмодзи: ${name}`);
      container.style.display = 'none';
      
      // Удаляем из тестового пула если есть
      testEmotesPool = testEmotesPool.filter(emote => emote.name !== name);
      collectedTestEmotes.delete(name);
      updateStats();
    };
    
    // Добавляем изображение в контейнер
    container.appendChild(img);
    
    return { id: emoteId, element: container, name, url };
  }
  
  // === Получение позиции для появления ===
  function getSpawnPosition() {
    const margin = cfg.margin;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    let x, y;
    
    switch(cfg.spawnArea) {
      case 'top':
        x = margin + Math.random() * (width - 2 * margin);
        y = margin;
        break;
      case 'bottom':
        x = margin + Math.random() * (width - 2 * margin);
        y = height - margin;
        break;
      case 'left':
        x = margin;
        y = margin + Math.random() * (height - 2 * margin);
        break;
      case 'right':
        x = width - margin;
        y = margin + Math.random() * (height - 2 * margin);
        break;
      case 'random':
      default:
        x = margin + Math.random() * (width - 2 * margin);
        y = margin + Math.random() * (height - 2 * margin);
        break;
    }
    
    return { x, y };
  }
  
  // === Применение эффекта появления ===
  function applySpawnEffect(element) {
    const duration = cfg.fadeInDuration;
    
    switch(cfg.spawnEffect) {
      case 'scale':
        element.style.animation = `scaleIn ${duration}ms ease-out`;
        break;
      case 'rotate':
        element.style.animation = `rotateIn ${duration}ms ease-out`;
        break;
      case 'slide':
        element.style.animation = `slideIn ${duration}ms ease-out`;
        break;
      case 'fade':
      default:
        element.style.animation = `fadeIn ${duration}ms ease-out`;
        break;
    }
    
    // Вращение при появлении
    if (cfg.spawnRotation) {
      const rotation = -10 + Math.random() * 20;
      element.style.transform += ` rotate(${rotation}deg)`;
    }
  }
  
  // === Применение анимации движения ===
  function applyMovementAnimation(element) {
    switch(cfg.animationType) {
      case 'bounce':
        if (cfg.bounceAnimation.enabled) {
          element.style.animation += `, bounce ${2/cfg.bounceAnimation.speed}s infinite ease-in-out`;
        }
        break;
      case 'fly':
        if (cfg.flyAnimation.enabled) {
          // Анимация полета
          const angle = cfg.flyAnimation.angle;
          const distance = cfg.flyAnimation.distance;
          const rad = angle * Math.PI / 180;
          const dx = Math.cos(rad) * distance;
          const dy = Math.sin(rad) * distance;
          
          element.style.transition = `transform ${cfg.emoteDuration}ms linear`;
          setTimeout(() => {
            element.style.transform += ` translate(${dx}px, ${dy}px)`;
          }, 10);
        }
        break;
      case 'rain':
        if (cfg.rainAnimation.enabled) {
          // Эмодзи падают вниз
          const speed = cfg.rainAnimation.speed;
          const startY = -100;
          const endY = window.innerHeight + 100;
          
          element.style.transform += ` translateY(${startY}px)`;
          element.style.transition = `transform ${cfg.emoteDuration}ms linear`;
          
          setTimeout(() => {
            element.style.transform += ` translateY(${endY}px)`;
          }, 10);
        }
        break;
      case 'float':
      default:
        if (cfg.floatAnimation.enabled) {
          element.style.animation += `, float ${2/cfg.floatAnimation.speed}s infinite ease-in-out`;
        }
        break;
    }
  }
  
  // === Добавление эмодзи на стену ===
  function addEmoteToWall(name, url, fromTest = false) {
    // Проверяем ограничение по количеству
    if (activeEmotes.size >= cfg.maxEmotesOnScreen) {
      // Удаляем самое старое эмодзи
      const oldestId = Array.from(activeEmotes.keys())[0];
      removeEmote(oldestId);
    }
    
    const now = Date.now();
    
    // Проверяем ограничение по времени, только если maxEmotesPerSecond > 0
    if (cfg.maxEmotesPerSecond > 0) {
      if (now - lastSpawnTime < 1000 / cfg.maxEmotesPerSecond) {
        return null;
      }
    }
    
    // Проверяем спам-фильтр, только если он включен
    if (cfg.spamFilterEnabled && lastEmoteTimes.has(name)) {
      const lastTime = lastEmoteTimes.get(name);
      if (now - lastTime < cfg.spamFilterTime) {
        return null;
      }
    }
    
    // Проверяем комбо
    if (cfg.comboRequirement > 0) {
      if (name === lastEmoteName) {
        emoteCombo++;
      } else {
        emoteCombo = 1;
        lastEmoteName = name;
      }
      
      if (emoteCombo < cfg.comboRequirement) {
        return null;
      }
    }
    
    // Игнорирование дубликатов
    if (cfg.ignoreDuplicates && name === lastEmoteName) {
      return null;
    }
    
    // Создаем элемент
    const emoteData = createEmoteElement(name, url);
    const { id, element } = emoteData;
    
    // Устанавливаем позицию
    const pos = getSpawnPosition();
    element.style.left = `${pos.x}px`;
    element.style.top = `${pos.y}px`;
    
    // Применяем эффект появления
    applySpawnEffect(element);
    
    // Применяем анимацию движения
    applyMovementAnimation(element);
    
    // Добавляем на стену
    emoteWall.appendChild(element);
    activeEmotes.set(id, emoteData);
    lastEmoteTimes.set(name, now);
    lastSpawnTime = now;
    emoteCount++;
    
    // Если включена физика
    if (cfg.enablePhysics) {
      physicsEmotes.set(id, {
        element: element,
        vx: (Math.random() - 0.5) * 5,
        vy: -5, // Начальная скорость вверх
        x: pos.x,
        y: pos.y
      });
    }
    
    // Устанавливаем таймер удаления
    setTimeout(() => {
      removeEmote(id);
    }, cfg.emoteDuration);
    
    // Если не из тестового режима и включен тестовый режим, добавляем в пул
    if (!fromTest && cfg.testMode) {
      addEmoteToTestPool(name, url);
    }
    
    // Логируем только обычные эмодзи, не тестовые
    if (!fromTest) {
      log(`➕ Добавлено эмодзи: ${name}`);
    }
    
    updateStats();
    
    return id;
  }
  
  // === Удаление эмодзи ===
  function removeEmote(id) {
    if (!activeEmotes.has(id)) return;
    
    const emoteData = activeEmotes.get(id);
    const element = emoteData.element;
    
    // Эффект исчезновения
    element.style.animation = `fadeOut ${cfg.fadeOutDuration}ms ease-out`;
    
    // Удаляем после анимации
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      activeEmotes.delete(id);
      physicsEmotes.delete(id);
      updateStats();
    }, cfg.fadeOutDuration);
  }
  
  // === Обработка физики ===
  function updatePhysics() {
    if (!cfg.enablePhysics) return;
    
    const now = Date.now();
    physicsEmotes.forEach((data, id) => {
      // Обновляем позицию
      data.vy += cfg.gravity; // Гравитация
      data.x += data.vx;
      data.y += data.vy;
      
      // Проверяем столкновение с границами
      const element = data.element;
      const rect = element.getBoundingClientRect();
      
      // Правая граница
      if (data.x + rect.width > window.innerWidth) {
        data.x = window.innerWidth - rect.width;
        data.vx = -Math.abs(data.vx) * cfg.bounceDamping;
      }
      
      // Левая граница
      if (data.x < 0) {
        data.x = 0;
        data.vx = Math.abs(data.vx) * cfg.bounceDamping;
      }
      
      // Нижняя граница
      if (data.y + rect.height > window.innerHeight) {
        data.y = window.innerHeight - rect.height;
        data.vy = -Math.abs(data.vy) * cfg.bounceDamping;
        
        // Если скорость слишком мала, останавливаем
        if (Math.abs(data.vy) < 0.5) {
          data.vy = 0;
        }
      }
      
      // Верхняя граница
      if (data.y < 0) {
        data.y = 0;
        data.vy = Math.abs(data.vy) * cfg.bounceDamping;
      }
      
      // Применяем позицию
      element.style.left = `${data.x}px`;
      element.style.top = `${data.y}px`;
    });
  }
  
  // === Тестовый режим ===
  function startTestMode() {
    if (!cfg.testMode || testInterval) return;
    
    log("🧪 Запуск тестового режима");
    log(`🧪 Тестовый пул: ${testEmotesPool.length} эмодзи`);
    
    // Если пул пустой, добавляем стандартные
    if (testEmotesPool.length === 0) {
      initTestEmotesPool();
    }
    
    testInterval = setInterval(() => {
      // Проверяем, есть ли эмодзи в пуле
      if (testEmotesPool.length === 0) {
        return;
      }
      
      // Выбираем случайное эмодзи из пула
      const randomIndex = Math.floor(Math.random() * testEmotesPool.length);
      const testEmote = testEmotesPool[randomIndex];
      
      // Показываем эмодзи
      if (testEmote && testEmote.url) {
        addEmoteToWall(testEmote.name, testEmote.url, true);
      }
    }, cfg.testInterval);
  }
  
  function stopTestMode() {
    if (testInterval) {
      clearInterval(testInterval);
      testInterval = null;
      log("🧪 Тестовый режим остановлен");
    }
  }
  
  // === Главный цикл анимации ===
  function animationLoop(timestamp) {
    updateFPS(timestamp);
    updatePhysics();
    updateStats();
    requestAnimationFrame(animationLoop);
  }
  
  // === Обработка сообщений из чата ===
  function processChatMessage(message, tags, username) {
    // Извлекаем слова из сообщения
    const words = message.split(/\s+/);
    let emoteFound = false;
    
    for (const word of words) {
      const cleanWord = word.trim();
      if (!cleanWord) continue;
      
      // Ищем эмодзи в загруженных коллекциях
      const url = findEmoteUrl(cleanWord);
      if (url) {
        addEmoteToWall(cleanWord, url, false);
        emoteFound = true;
        break; // Показываем только первое найденное эмодзи из сообщения
      }
    }
    
    // Также проверяем Twitch эмодзи из тегов
    if (!emoteFound && cfg.enableTwitch && tags.emotes) {
      const emoteData = tags.emotes;
      if (typeof emoteData === 'string') {
        const emotes = emoteData.split('/');
        for (const emote of emotes) {
          const [emoteId, positions] = emote.split(':');
          if (emoteId) {
            // Twitch эмодзи имеют специальный URL
            const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/3.0`;
            addEmoteToWall(`twitch_${emoteId}`, emoteUrl, false);
            break;
          }
        }
      }
    }
  }
  
  // === Подключение к Twitch чату ===
  function connectToTwitchChat(channel) {
    const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    
    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send("PASS SCHMOOPIIE");
      ws.send("NICK justinfan12345");
      ws.send(`JOIN #${channel}`);
      log(`📥 Подключено к чату #${channel}`);
    };
    
    ws.onmessage = (event) => {
      const raw = event.data;
      
      // Отвечаем на PING
      if (raw.startsWith("PING")) {
        ws.send("PONG :tmi.twitch.tv");
        return;
      }
      
      // Пропускаем не-PRIVMSG сообщения
      if (!raw.includes("PRIVMSG")) return;
      
      // Парсим теги
      const parts = raw.split(' ');
      const tags = {};
      
      if (parts[0].startsWith('@')) {
        const tagString = parts[0].substring(1);
        tagString.split(';').forEach(tag => {
          const [key, value] = tag.split('=');
          tags[key] = value;
        });
      }
      
      // Извлекаем сообщение
      const messageMatch = raw.match(/PRIVMSG #[^ ]+ :(.+)/);
      if (!messageMatch) return;
      
      const message = messageMatch[1];
      const displayName = tags['display-name'] || 'unknown';
      
      if (cfg.debug) {
        log(`💬 [${displayName}]: ${message}`);
      }
      
      // Обрабатываем сообщение
      processChatMessage(message, tags, displayName);
    };
    
    ws.onerror = (e) => error("WebSocket ошибка:", e);
    
    ws.onclose = () => {
      warn("Соединение закрыто. Переподключение через 5 сек...");
      setTimeout(() => connectToTwitchChat(channel), 5000);
    };
  }
  
  // === Инициализация ===
  async function init() {
    info("🚀 EmoteWall запускается...");
    info(`📺 Канал: ${cfg.nickname}`);
    
    // Загружаем конфиг
    const userId = await getTwitchUserId(cfg.nickname);
    if (!userId) {
      error("❌ Не удалось получить User ID для канала");
      hideLoadingIndicator();
      return;
    }
    
    // Загружаем эмодзи
    await loadEmotes(userId, cfg.nickname);
    
    // Подключаемся к чату
    connectToTwitchChat(cfg.nickname);
    
    // Запускаем главный цикл
    requestAnimationFrame(animationLoop);
    
    // Запускаем тестовый режим, если включен
    if (cfg.testMode) {
      startTestMode();
    }
    
    // Скрываем индикатор загрузки
    hideLoadingIndicator();
    
    info("✅ EmoteWall готов к работе!");
    info(`🧪 Тестовый режим: ${cfg.testMode ? 'ВКЛ' : 'ВЫКЛ'}`);
    
    // Делаем тестовый запуск если в дебаге
    if (cfg.debug && testEmotesPool.length > 0 && !cfg.testMode) {
      // Однократный тест при запуске
      setTimeout(() => {
        // Пробуем показать одно тестовое эмодзи
        const randomIndex = Math.floor(Math.random() * testEmotesPool.length);
        const testEmote = testEmotesPool[randomIndex];
        if (testEmote && testEmote.url) {
          addEmoteToWall(testEmote.name, testEmote.url, true);
        }
      }, 1000);
    }
  }
  
  // Запускаем инициализацию
  init();
})();