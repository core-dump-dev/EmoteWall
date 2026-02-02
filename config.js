// Конфигурация EmoteWall
window.EmoteWallConfig = {
  // === Общие настройки ===
  nickname: 'core_dmp',                    // Имя Twitch канала для мониторинга
  debug: true,                             // Включить отладочное логирование (показывает панель)
  debugLog: true,                          // Показывать всплывающие дебаг-сообщения
  testMode: true,                         // Включить автоматический тестовый режим
  testInterval: 500,                      // Интервал теста в миллисекундах (5 секунд)
  
  // === Лимиты ===
  maxEmotesOnScreen: 50,                   // Максимальное количество эмодзи на экране одновременно
  maxEmotesPerSecond: 3,                   // Максимальное количество эмодзи в секунду
  
  // === Внешний вид ===
  emoteScale: 0.5,                         // Базовый масштаб эмодзи (0.1 - 1.0)
  emoteMinScale: 0.2,                      // Минимальный случайный масштаб
  emoteMaxScale: 0.8,                      // Максимальный случайный масштаб
  randomScale: true,                       // Использовать случайный размер в пределах min-max
  borderRadius: 12,                        // Скругление углов эмодзи в пикселях
  dropShadow: true,                        // Включить тень под эмодзи
  shadowColor: 'rgba(0,0,0,0.5)',          // Цвет тени
  shadowBlur: 5,                           // Размытие тени
  
  // === Длительность и поведение ===
  emoteDuration: 5000,                     // Время отображения эмодзи (мс)
  fadeInDuration: 300,                     // Длительность появления
  fadeOutDuration: 300,                    // Длительность исчезновения
  comboRequirement: 0,                     // Требуемое комбо для показа (0 = показывать все)
  ignoreDuplicates: false,                 // Игнорировать одинаковые эмодзи подряд
  
  // === Анимации ===
  animationType: 'float',                  // Тип анимации: 'float', 'bounce', 'fly', 'rain'
  enablePhysics: false,                    // Включить физику (падение, отскоки)
  gravity: 0.2,                            // Сила гравитации для физики
  bounceDamping: 0.8,                      // Затухание при отскоке
  
  // === Позиционирование ===
  spawnArea: 'random',                     // Область появления: 'random', 'top', 'bottom', 'left', 'right'
  margin: 50,                              // Отступ от краев экрана
  
  // === Эффекты появления ===
  spawnEffect: 'fade',                     // Эффект появления: 'fade', 'scale', 'rotate', 'slide'
  spawnRotation: true,                     // Вращение при появлении
  
  // === Платформы эмодзи ===
  enable7tv: true,                         // Включить 7TV эмодзи
  enableTwitch: true,                      // Включить Twitch эмодзи
  enableBTTV: true,                        // Включить BTTV эмодзи
  enableFFZ: true,                         // Включить FFZ эмодзи
  
  // === Спам-фильтр ===
  spamFilterEnabled: true,                 // Включить фильтр спама
  spamFilterTime: 1000,                    // Минимальное время между одинаковыми эмодзи (мс)
  
  // === Настройки отдельных анимаций ===
  floatAnimation: {                        // Настройки плавающей анимации
    enabled: true,
    amplitude: 20,                         // Амплитуда колебаний
    speed: 0.5                             // Скорость колебаний
  },
  
  bounceAnimation: {                       // Настройки анимации отскока
    enabled: false,
    bounceHeight: 100,                     // Высота отскока
    bounceCount: 3                         // Количество отскоков
  },
  
  flyAnimation: {                          // Настройки анимации полета
    enabled: false,
    angle: 45,                             // Угол полета
    distance: 300                          // Дистанция полета
  },
  
  rainAnimation: {                         // Настройки анимации дождя
    enabled: false,
    speed: 2,                              // Скорость падения
    angle: 90                              // Угол падения
  }
};