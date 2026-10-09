# LivePixel

A Pico app and a browser app that share one BLE session. The Pico advertises. The page draws a 128×64 canvas and sends that bitmap to the panel.

## Pico

`livepixel-pico/main.py` imports `ble` and `ssd1306`. On startup it shows `LivePixel` and advertises under that name. After a central connects, incoming packets fill a frame. The last packet unpacks it and copies it into the panel buffer.

From `livepixel-pico`. This attaches the shared Pico into WSL, then installs and runs:

```bash
./run.sh
```

That installs `ble` and `ssd1306` at `v0.2.0` from `github:DimosthenisK/pico-lib`, then runs `main.py`. The screen is SDA GP4, SCL GP5, 128×64.

A packet is `offset` as a little-endian uint16, `length`, `flags`, then `length` bytes. Bit 0 of `flags` marks the last packet. Bit 1 means the payload is the raw 1024-byte panel buffer. Otherwise the payload is run-length encoded and unpacks to those 1024 bytes. The buffer is SSD1306 page order: eight pages of 128 columns, and the low bit of each byte is the top pixel. A cleared canvas encodes to 16 bytes, so it travels in one write. A frame that does not shrink is sent raw. Each write carries at most 16 payload bytes, which fits in one default BLE packet. The Pico treats that write as a whole packet.

## PWA

Local development, from `livepixel-pwa`:

```bash
python3 dev.py
```

Open `http://127.0.0.1:8080` in Chrome or Edge. Web Bluetooth does not run over plain HTTP except on localhost. Connect, then draw. Lit pixels are white. Each change starts a transfer. If a transfer is already running, later changes wait and the latest canvas is sent when the radio is free. A 250ms poll sends anything still waiting.

## CapRover

`livepixel-pwa` is the app CapRover builds. `captain-definition` and `Dockerfile` sit in that directory, and the image serves the page with nginx on port 80. CapRover terminates HTTPS in front of that port.

Create an app named `livepixel`. Leave the container HTTP port at 80. Enable HTTPS, then force HTTPS. Web Bluetooth runs in Chrome or Edge only on that `https://` address, on a device that is next to the Pico.

A push to `main` that changes `livepixel-pwa` runs `.github/workflows/deploy.yml`. That packages `livepixel-pwa` by itself and sends it to CapRover. The repository secrets are `CAPROVER_SERVER`, `APP_NAME`, and `APP_TOKEN`. The Dockerfile copies the page from the root of that package.
