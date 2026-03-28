#!/bin/bash
set -e

# Ensure the XDG_RUNTIME_DIR exists for the vscode user (uid 1000).
# systemd --user needs this directory to place its socket.
if [ ! -d /run/user/1000 ]; then
  sudo mkdir -p /run/user/1000
  sudo chown vscode:vscode /run/user/1000
  sudo chmod 700 /run/user/1000
fi

# Enable lingering so the user systemd instance starts automatically
# (even without a login session).
sudo loginctl enable-linger vscode

# Wait briefly for the user systemd instance to become ready.
for i in $(seq 1 10); do
  if systemctl --user is-system-running --wait 2>/dev/null; then
    break
  fi
  sleep 1
done