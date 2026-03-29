FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install systemd + dbus so that systemctl (including --user) works inside the container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       systemd systemd-sysv dbus dbus-user-session build-essential git libcurl4-openssl-dev curl libgomp1 cmake \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Mask units that are unnecessary (or harmful) inside a container.
RUN systemctl mask \
      systemd-remount-fs.service \
      systemd-resolved.service \
      systemd-logind.service \
      getty.target \
      console-getty.service

# systemd expects a writable /run and /tmp — those are handled via tmpfs
# mounts in devcontainer.json.

# The proper signal to shut systemd down cleanly.
STOPSIGNAL SIGRTMIN+3

# Let systemd be PID 1.
ENTRYPOINT ["/lib/systemd/systemd"]
