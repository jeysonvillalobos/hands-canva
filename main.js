const video = document.getElementById("video");
const canvasCamera = document.getElementById("canvasCamera");
const canvasDraw = document.getElementById("canvasDraw");
const ctxCamera = canvasCamera.getContext("2d");
const ctxDraw = canvasDraw.getContext("2d");

ctxDraw.lineCap = "round";
ctxDraw.lineJoin = "round";

let prevX = null;
let prevY = null;
let drawing = false;
let color = "blue";
let thickness = 4;
let cooldown = false;

const tools = [
  {
    x: 10,
    y: 10,
    width: 40,
    height: 40,
    color: "red",
    el: document.querySelector(".red"),
  },
  {
    x: 58,
    y: 10,
    width: 40,
    height: 40,
    color: "blue",
    el: document.querySelector(".blue"),
  },
  {
    x: 106,
    y: 10,
    width: 40,
    height: 40,
    color: "yellow",
    el: document.querySelector(".yellow"),
  },
  {
    x: 154,
    y: 10,
    width: 40,
    height: 40,
    color: "green",
    el: document.querySelector(".green"),
  },
  {
    x: 202,
    y: 10,
    width: 60,
    height: 40,
    eraser: true,
    el: document.querySelector(".eraser"),
  },
];

const hands = new Hands({
  locateFile: (file) => `libraries/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function triggerAnimation(element) {
  element.classList.add("active");
  setTimeout(() => element.classList.remove("active"), 300);
}

function handleToolInteraction(x, y) {
  for (const tool of tools) {
    const insideX = x >= tool.x && x <= tool.x + tool.width;
    const insideY = y >= tool.y && y <= tool.y + tool.height;
    if (insideX && insideY) {
      triggerAnimation(tool.el);
      if (tool.eraser) {
        ctxDraw.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
      } else {
        color = tool.color;
      }
      return true;
    }
  }
  return false;
}

hands.onResults(({ image, multiHandLandmarks }) => {
  ctxCamera.clearRect(0, 0, canvasCamera.width, canvasCamera.height);
  ctxCamera.drawImage(image, 0, 0, canvasCamera.width, canvasCamera.height);

  if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
    prevX = prevY = null;
    return;
  }

  const [hand] = multiHandLandmarks;
  const indexTip = hand[8];
  const thumbTip = hand[4];
  const middleTip = hand[12];

  const x = indexTip.x * canvasDraw.width;
  const y = indexTip.y * canvasDraw.height;

  if (handleToolInteraction(x, y)) {
    drawing = false;
    prevX = prevY = null;
    return;
  }

  const isPinching = getDistance(indexTip, thumbTip) < 0.05;
  const wantsToChangeThickness = getDistance(thumbTip, middleTip) < 0.05;

  if (wantsToChangeThickness && !cooldown) {
    thickness = thickness === 4 ? 8 : 4;
    cooldown = true;
    setTimeout(() => (cooldown = false), 500);
  }

  if (isPinching) {
    if (prevX !== null && prevY !== null) {
      ctxDraw.beginPath();
      ctxDraw.strokeStyle = color;
      ctxDraw.lineWidth = thickness;
      ctxDraw.moveTo(prevX, prevY);
      ctxDraw.lineTo(x, y);
      ctxDraw.stroke();
    }
    prevX = x;
    prevY = y;
  } else {
    prevX = prevY = null;
  }
});

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480,
});

camera.start();
