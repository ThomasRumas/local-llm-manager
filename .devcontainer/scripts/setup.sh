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

# Install ik_llama.cpp
cd /tmp
git clone https://github.com/ikawrakow/ik_llama.cpp
cd ik_llama.cpp

# iqk_common.h is missing '#include <cstdint>' on GCC 13+ (uint8_t undeclared)
sed -i '/#include "iqk_config.h"/a #include <cstdint>' \
  ggml/src/iqk/iqk_common.h

# GGML_NATIVE=ON only adds -march=native in the x86 cmake block, not on ARM.
# Without -march=native, __ARM_FEATURE_DOTPROD is not defined, iqk_config.h strips
# IQK_IMPLEMENT, and v_expf / v_silu in iqk_utils.h are never compiled.
# Pass -march=native explicitly so the compiler defines __ARM_FEATURE_DOTPROD.
cmake -B build \
  -DGGML_NATIVE=ON \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_FLAGS="-march=native" \
  -DCMAKE_CXX_FLAGS="-march=native"
cmake --build build -j$(nproc)
sudo cp /tmp/ik_llama.cpp/build/bin/* /usr/local/bin/