FROM texlive/texlive:TL2026-local

RUN set -eux; \
    sed -i 's/Components: main/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources; \
    apt-get update; \
    echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ttf-mscorefonts-installer; \
    fc-cache -f; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /work
