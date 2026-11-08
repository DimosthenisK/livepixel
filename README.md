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

## Production (NixOS homeserver)

Push `main` to this repo. GitHub Actions builds `livepixel-pwa/`, pushes `ghcr.io/dimosthenisk/livepixel:main`, then triggers `https://deploy.dimosthenis.dev/deploy/livepixel`.

| URL | Scope |
| --- | --- |
| https://livepixel.dimosthenis.dev | Public (Cloudflare Tunnel) |
| https://livepixel.afrino-macaroni.ts.net | Tailnet |

Homeserver compose (`DimosthenisK/nix-homeserver` `stacks/livepixel/`) is thin: it only pulls the GHCR image on loopback `127.0.0.1:8086`. Repo secret `DEPLOY_WEBHOOK_TOKEN` is required.

Web Bluetooth needs HTTPS (or localhost) in Chrome/Edge, on a device next to the Pico.

Local image: `docker build -t livepixel-pwa ./livepixel-pwa`.

Guide: https://github.com/DimosthenisK/homeserver-directory
