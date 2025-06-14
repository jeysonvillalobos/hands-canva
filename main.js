// --- 1. Elementos del DOM ---
const videoElement = document.getElementById("video");
const canvasCamera = document.getElementById("canvasCamera");
const canvasDraw = document.getElementById("canvasDraw");
const toolbar = document.getElementById("toolbar");

const ctxCamera = canvasCamera.getContext("2d");
const ctxDraw = canvasDraw.getContext("2d");

// --- 2. Constantes de configuración ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PINCH_THRESHOLD = 0.05;
const TOOL_COOLDOWN_MS = 500;
const TEXT_FONT_SIZE = 50;
const TEXT_LETTER_DELAY_MS = 100;
const TOOL_SWITCH_DELAY_MS = 300;

// --- 3. Estado de la aplicación ---
const appState = {
  previousDrawX: null,
  previousDrawY: null,
  currentColor: "blue",
  currentDrawThickness: 4,
  isToolCooldownActive: false,
  lastActiveToolElement: null,
  currentTextAnimationTimeoutId: null, // Para controlar la animación de texto
};

// --- 4. Configuración inicial del Canvas ---
function setupCanvas() {
  canvasCamera.width = CANVAS_WIDTH;
  canvasCamera.height = CANVAS_HEIGHT;
  canvasDraw.width = CANVAS_WIDTH;
  canvasDraw.height = CANVAS_HEIGHT;

  ctxDraw.lineCap = "round";
  ctxDraw.lineJoin = "round";

  // Activar la herramienta azul por defecto al inicio
  const defaultTool = document.querySelector('.tool.blue-bg');
  if (defaultTool) {
    activateToolUI(defaultTool);
  }
}

// --- 5. Funciones de Utilidad ---
function getDistance(point1, point2) {
  return Math.hypot(point1.x - point2.x, point1.y - point2.y);
}

function activateToolUI(element) {
  if (appState.lastActiveToolElement) {
    appState.lastActiveToolElement.classList.remove('active');
  }
  element.classList.add('active');
  appState.lastActiveToolElement = element;
}

function setToolCooldown() {
  appState.isToolCooldownActive = true;
  setTimeout(() => {
    appState.isToolCooldownActive = false;
  }, TOOL_COOLDOWN_MS);
}

// --- 6. Lógica de Animación de Texto ---
function animateTextLetterByLetter(phrase, color, x, y) {
  // Cancelar cualquier animación de texto anterior
  if (appState.currentTextAnimationTimeoutId) {
    clearTimeout(appState.currentTextAnimationTimeoutId);
    appState.currentTextAnimationTimeoutId = null;
  }

  ctxDraw.save();
  ctxDraw.fillStyle = color;
  ctxDraw.font = `${TEXT_FONT_SIZE}px Arial, sans-serif`;
  ctxDraw.textAlign = 'center';
  ctxDraw.textBaseline = 'alphabetic';

  const clearAreaY = y - TEXT_FONT_SIZE;
  const clearAreaHeight = TEXT_FONT_SIZE * 1.5;
  ctxDraw.clearRect(0, clearAreaY, CANVAS_WIDTH, clearAreaHeight);

  let currentDisplayedText = "";
  let charIndex = 0;

  function drawNextLetter() {
    if (charIndex < phrase.length) {
      currentDisplayedText += phrase[charIndex];
      ctxDraw.clearRect(0, clearAreaY, CANVAS_WIDTH, clearAreaHeight);
      ctxDraw.fillText(currentDisplayedText, x, y);
      charIndex++;
      appState.currentTextAnimationTimeoutId = setTimeout(drawNextLetter, TEXT_LETTER_DELAY_MS);
    } else {
      ctxDraw.restore();
      appState.currentTextAnimationTimeoutId = null;
    }
  }

  drawNextLetter();
}

// --- 7. Manejo de Interacción con Herramientas (Toolbar) ---
function handleToolInteraction(indexTipNormalizedX, indexTipNormalizedY) {
  const tools = document.querySelectorAll('.tool');
  const containerRect = document.querySelector('.container').getBoundingClientRect();
  const xFingerDoc = (1 - indexTipNormalizedX) * containerRect.width + containerRect.left;
  const yFingerDoc = indexTipNormalizedY * containerRect.height + containerRect.top;

  for (const tool of tools) {
    const toolRect = tool.getBoundingClientRect();
    const isHovering = xFingerDoc >= toolRect.left && xFingerDoc <= toolRect.right &&
                       yFingerDoc >= toolRect.top && yFingerDoc <= toolRect.bottom;

    if (isHovering && !appState.isToolCooldownActive) {
      if (tool.dataset.color) { // Herramienta de color
        appState.currentColor = tool.dataset.color;
        activateToolUI(tool);
      } else if (tool.dataset.eraser) { // Herramienta de borrador
        ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height); // Borra todo el canvas
        activateToolUI(tool);
        if (appState.currentTextAnimationTimeoutId) { // Cancelar animación de texto si existe
            clearTimeout(appState.currentTextAnimationTimeoutId);
            appState.currentTextAnimationTimeoutId = null;
        }
        // Volver a la herramienta de color anterior después de un breve retraso
        setTimeout(() => {
            if (appState.lastActiveToolElement && appState.lastActiveToolElement.dataset.eraser) {
                const prevColorTool = document.querySelector(`.tool[data-color="${appState.currentColor}"]`);
                if (prevColorTool) {
                    activateToolUI(prevColorTool);
                }
            }
        }, TOOL_SWITCH_DELAY_MS);
      } else if (tool.classList.contains('text-tool')) {
          const phraseToDraw = tool.dataset.textLabel;
          const drawX = CANVAS_WIDTH / 2;
          const drawY = CANVAS_HEIGHT - 80;

          animateTextLetterByLetter(phraseToDraw, appState.currentColor, drawX, drawY);
          
          activateToolUI(tool);
          // Volver a la herramienta de color anterior después de un breve retraso
          setTimeout(() => {
              if (appState.lastActiveToolElement && appState.lastActiveToolElement.classList.contains('text-tool')) {
                  const prevColorTool = document.querySelector(`.tool[data-color="${appState.currentColor}"]`);
                  if (prevColorTool) {
                      activateToolUI(prevColorTool);
                  }
              }
          }, TOOL_SWITCH_DELAY_MS);
      }
      setToolCooldown();
      return true;
    }
  }
  return false;
}

// --- 8. Manejo de Resultados de MediaPipe Hands ---
const hands = new Hands({
  locateFile: (file) => `libraries/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
});

hands.onResults((results) => {
  // Limpiar y dibujar la cámara
  ctxCamera.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctxCamera.save();
  ctxCamera.scale(-1, 1); // Espejar la imagen de la cámara
  ctxCamera.drawImage(results.image, -CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctxCamera.restore();

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    appState.previousDrawX = null;
    appState.previousDrawY = null;
    return;
  }

  const primaryHand = results.multiHandLandmarks[0]; // Usar la primera mano detectada
  const indexTip = primaryHand[8];
  const thumbTip = primaryHand[4];

  // Coordenadas normalizadas del dedo índice
  const indexTipNormalizedX = indexTip.x;
  const indexTipNormalizedY = indexTip.y;

  // Manejar interacción con la barra de herramientas antes de dibujar
  const interactedWithTool = handleToolInteraction(indexTipNormalizedX, indexTipNormalizedY);

  // Convertir coordenadas normalizadas a coordenadas del canvas de dibujo (X invertida)
  const drawX = (1 - indexTip.x) * CANVAS_WIDTH;
  const drawY = indexTip.y * CANVAS_HEIGHT;

  const isPinching = getDistance(indexTip, thumbTip) < PINCH_THRESHOLD;

  if (isPinching && !interactedWithTool) {
    if (appState.previousDrawX !== null && appState.previousDrawY !== null) {
      ctxDraw.beginPath();
      ctxDraw.strokeStyle = appState.currentColor;
      ctxDraw.lineWidth = appState.currentDrawThickness;
      ctxDraw.moveTo(appState.previousDrawX, appState.previousDrawY);
      ctxDraw.lineTo(drawX, drawY);
      ctxDraw.stroke();
    }
    appState.previousDrawX = drawX;
    appState.previousDrawY = drawY;
  } else {
    appState.previousDrawX = null;
    appState.previousDrawY = null;
  }
});

// --- 9. Inicialización de la Cámara ---
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
});

// --- 10. Iniciar la aplicación ---
function initializeApp() {
  setupCanvas();
  camera.start();
}

initializeApp();
