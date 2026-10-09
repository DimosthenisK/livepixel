const WIDTH = 128;
const HEIGHT = 64;
const FRAME = (WIDTH * HEIGHT) / 8;
const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const HEADER = 4;
const CHUNK = 16;
const LAST = 1;
const RAW = 2;

const canvas = document.querySelector("#board");
const statusNode = document.querySelector("#status");
const connectButton = document.querySelector("#connect");
const clearButton = document.querySelector("#clear");
const eraseButton = document.querySelector("#erase");
const context = canvas.getContext("2d", { willReadFrequently: true });

let rx = null;
let drawing = false;
let erasing = false;
let dirty = false;
let sending = false;

context.fillStyle = "#000";
context.fillRect(0, 0, WIDTH, HEIGHT);

function setStatus(text) {
  statusNode.textContent = text;
}

function cell(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * WIDTH);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * HEIGHT);
  return [
    Math.max(0, Math.min(WIDTH - 1, x)),
    Math.max(0, Math.min(HEIGHT - 1, y)),
  ];
}

function paint(event) {
  const [x, y] = cell(event);
  context.fillStyle = erasing ? "#000" : "#fff";
  context.fillRect(x, y, 1, 1);
  dirty = true;
  schedule();
}

function bitmap() {
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  const bytes = new Uint8Array(FRAME);
  for (let page = 0; page < HEIGHT / 8; page += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      let value = 0;
      const row = page * WIDTH;
      for (let bit = 0; bit < 8; bit += 1) {
        const y = page * 8 + bit;
        if (pixels[(y * WIDTH + x) * 4] > 127) {
          value |= 1 << bit;
        }
      }
      bytes[row + x] = value;
    }
  }
  return bytes;
}

function encode(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    let run = 1;
    while (i + run < bytes.length && bytes[i + run] === bytes[i] && run < 128) {
      run += 1;
    }
    if (run >= 2) {
      out.push(0x80 | (run - 1), bytes[i]);
      i += run;
      continue;
    }
    const start = i;
    i += 1;
    while (i < bytes.length && i - start < 128) {
      let next = 1;
      while (
        i + next < bytes.length &&
        bytes[i + next] === bytes[i] &&
        next < 128
      ) {
        next += 1;
      }
      if (next >= 2) {
        break;
      }
      i += 1;
    }
    out.push(i - start - 1);
    for (let at = start; at < i; at += 1) {
      out.push(bytes[at]);
    }
  }
  return Uint8Array.from(out);
}

async function writePacket(packet) {
  try {
    await rx.writeValueWithoutResponse(packet);
  } catch (err) {
    await rx.writeValue(packet);
  }
}

async function sendFrame() {
  const bytes = bitmap();
  let payload = encode(bytes);
  let flags = 0;
  if (payload.length >= bytes.length) {
    payload = bytes;
    flags = RAW;
  }
  for (let offset = 0; offset < payload.length; offset += CHUNK) {
    const slice = payload.subarray(offset, Math.min(offset + CHUNK, payload.length));
    const packet = new Uint8Array(HEADER + slice.length);
    packet[0] = offset & 0xff;
    packet[1] = (offset >> 8) & 0xff;
    packet[2] = slice.length;
    packet[3] = flags | (offset + slice.length === payload.length ? LAST : 0);
    packet.set(slice, HEADER);
    await writePacket(packet);
  }
}

function schedule() {
  if (sending || !dirty || !rx) {
    return;
  }
  dirty = false;
  sending = true;
  sendFrame()
    .catch((err) => {
      setStatus(err.message || "Send failed");
      dirty = true;
    })
    .finally(() => {
      sending = false;
      schedule();
    });
}

canvas.addEventListener("pointerdown", (event) => {
  drawing = true;
  canvas.setPointerCapture(event.pointerId);
  paint(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (drawing) {
    paint(event);
  }
});

function stopDrawing(event) {
  if (!drawing) {
    return;
  }
  drawing = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  dirty = true;
  schedule();
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

clearButton.addEventListener("click", () => {
  context.fillStyle = "#000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  dirty = true;
  schedule();
});

eraseButton.addEventListener("click", () => {
  erasing = !erasing;
  eraseButton.textContent = erasing ? "Erase" : "Draw";
  eraseButton.setAttribute("aria-pressed", erasing ? "true" : "false");
});

connectButton.addEventListener("click", async () => {
  setStatus("Choosing device");
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "LivePixel", services: [UART_SERVICE] }],
    });
    device.addEventListener("gattserverdisconnected", () => {
      rx = null;
      setStatus("Disconnected");
    });
    setStatus("Connecting");
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE);
    rx = await service.getCharacteristic(UART_RX);
    setStatus("Connected");
    dirty = true;
    schedule();
  } catch (err) {
    rx = null;
    setStatus(err.message || "Connection failed");
  }
});

setInterval(schedule, 250);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
