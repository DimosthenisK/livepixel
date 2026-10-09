#!/usr/bin/env bash
# Install ble and ssd1306 from the published tag, overlay the local ble
# module (larger write buffer), then run this app on the Pico.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REQUESTED_MPREMOTE=${MPREMOTE:-}
TAG=${TAG:-v0.2.0}

# shellcheck disable=SC1091
source "$DIR/../../w/common/scripts/common.sh"
if [[ -n "$REQUESTED_MPREMOTE" ]]; then
  MPREMOTE=$REQUESTED_MPREMOTE
fi
# common.sh uses REPO for the local pico-lib checkout.
PACKAGE_REPO=${PACKAGE_REPO:-github:DimosthenisK/pico-lib}

prepare_port

"$MPREMOTE" connect "$PORT" mip install "$PACKAGE_REPO/lib/ble@$TAG"
"$MPREMOTE" connect "$PORT" mip install "$PACKAGE_REPO/lib/ssd1306@$TAG"
"$MPREMOTE" connect "$PORT" cp "$DIR/../../w/lib/ble/__init__.py" :/lib/ble/__init__.py
"$MPREMOTE" connect "$PORT" run "$DIR/main.py"
