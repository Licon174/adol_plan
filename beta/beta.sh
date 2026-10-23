#!/bin/sh
BASE=/mnt/userdata/adol
WEB=/etc_ro/web
LIST="index.html app.js app.css favicon.ico"
OURS=""

is_mounted() { grep -q " $1 " /proc/mounts; }
is_mounted_dir() { grep -q " $1 " /proc/mounts; }

rollback() {
    if is_mounted_dir "$WEB"; then
        umount -l "$WEB" 2>/dev/null || umount "$WEB" 2>/dev/null
    fi
    for f in $LIST; do
        is_mounted "$WEB/$f" && umount "$WEB/$f" 2>/dev/null
    done
}

normalize() {
    for p in "$BASE/beta.sh" "$BASE/web.md5" "$BASE/backend.md5"; do
        [ -f "$p" ] && { tr -d '\015' < "$p" > "$p.n" && mv "$p.n" "$p"; }
    done
}

stop_daemons() {
    sh /mnt/userdata/flux_stat/collect.sh stop 2>/dev/null
    killall at_cond 2>/dev/null
    killall key2simd 2>/dev/null
    sh /mnt/userdata/sim_switch/ctl.sh stop 2>/dev/null
    sleep 1
}

relay_link() {
    mkdir -p /etc_rw/wifi/sockets 2>/dev/null
    if [ ! -f /etc_rw/wifi/wpa_supplicant.conf ]; then
        printf "ctrl_interface=/etc_rw/wifi/sockets\nupdate_config=1\ncountry=CN\npmf=1\nsae_pwe=2\n" > /etc_rw/wifi/wpa_supplicant.conf 2>/dev/null
        chmod 644 /etc_rw/wifi/wpa_supplicant.conf 2>/dev/null
    fi
    mount -o remount,rw / || return 1
    ln -sf /mnt/userdata/binary/wpa_supplicant /bin/wpa_supplicant
    r=$?
    sync
    mount -o remount,ro /
    return $r
}

install_web() {
    cd "$BASE" || return 1
    ok=1
    while read -r h f; do
        [ -n "$f" ] || continue
        got=$(md5sum "$BASE/$f" 2>/dev/null | cut -d' ' -f1)
        [ "$got" = "$h" ] || { echo "ABORT bad $f"; ok=0; }
    done < web.md5
    [ $ok = 1 ] || return 1

    if is_mounted_dir "$WEB"; then
        umount -l "$WEB" 2>/dev/null || umount "$WEB" || { rollback; return 1; }
    fi
    for f in $LIST; do
        is_mounted "$WEB/$f" && umount "$WEB/$f" 2>/dev/null
    done
    SH="$BASE/shadow"
    rm -rf "$SH"; mkdir -p "$SH" "$SH/pic" || return 1
    for f in $LIST; do cp "$BASE/$f" "$SH/$f" || return 1; done
    for p in $WEB/*; do
        [ -L "$p" ] || continue
        tgt=$(readlink "$p")
        case "$tgt" in /mnt/userdata/*) ln -s "$tgt" "$SH/$(basename "$p")" ;; esac
    done
    ln -sf /etc_rw/wifi/qrcode_ssid_wifikey.png "$SH/pic/qrcode_ssid_wifikey.png"
    ln -sf /etc_rw/wifi/qrcode_multi_ssid_wifikey.png "$SH/pic/qrcode_multi_ssid_wifikey.png"
    mkdir -p /tmp/flux_stat /mnt/userdata/flux_stat /mnt/userdata/qos /mnt/userdata/sim_switch
    [ -f /mnt/userdata/flux_stat/switch ] || echo 1 > /mnt/userdata/flux_stat/switch
    for f in total.txt daily.txt hourly.txt uptime.txt; do
        if [ -f "/mnt/userdata/flux_stat/$f" ] && [ ! -f "/tmp/flux_stat/$f" ]; then
            cp -f "/mnt/userdata/flux_stat/$f" "/tmp/flux_stat/$f" 2>/dev/null
        elif [ ! -f "/tmp/flux_stat/$f" ]; then
            touch "/tmp/flux_stat/$f" 2>/dev/null
        fi
    done
    for pair in \
        at_usb_func.txt:/mnt/userdata/usb_func.txt \
        imei_out.txt:/mnt/userdata/imei_out.txt \
        uptime_out.txt:/mnt/userdata/uptime_out.txt \
        battery_stat.txt:/tmp/battery_stat.txt \
        qos_state.txt:/mnt/userdata/qos/state.txt \
        flux_stat_daily.txt:/tmp/flux_stat/daily.txt \
        flux_stat_hourly.txt:/tmp/flux_stat/hourly.txt \
        flux_stat_state.txt:/mnt/userdata/flux_stat/switch \
        flux_stat_uptime.txt:/tmp/flux_stat/uptime.txt \
        keysim_applied.txt:/mnt/userdata/sim_switch/applied.txt \
        keysim_map.txt:/mnt/userdata/sim_switch/map.txt \
        keysim_on.txt:/mnt/userdata/sim_switch/on.txt \
        keysim_rules.txt:/mnt/userdata/sim_switch/rules.txt \
        keysim_slots.txt:/mnt/userdata/sim_switch/slots.txt \
        keysim_stat.txt:/mnt/userdata/sim_switch/stat.txt \
        lcd_bg.png:/etc_ro/mmi/first_background.png \
        lcd_task.txt:/mnt/userdata/lcd_task_tab.txt ; do
        nm=${pair%%:*}; tg=${pair#*:}
        [ -e "$tg" ] || touch "$tg" 2>/dev/null
        ln -sf "$tg" "$SH/$nm"
    done
    ln -sf /etc_ro/mmi "$SH/lcd_anim"
    mount --bind "$SH" "$WEB" || { rollback; return 1; }
    DIR_M=1
    OURS="$OURS .webdir"

    bad=0
    for f in $LIST; do
        a=$(md5sum "$BASE/$f" | cut -d' ' -f1)
        b=$(md5sum "$WEB/$f" | cut -d' ' -f1)
        [ "$a" = "$b" ] || bad=1
    done
    if [ $bad = 1 ]; then rollback; return 1; fi
}

install_backend() {
    [ -f "$BASE/backend.md5" ] || return 0
    cd "$BASE" || return 1
    mkdir -p /mnt/userdata/binary/logs /mnt/userdata/flux_stat /mnt/userdata/qos /mnt/userdata/sim_switch
    stop_daemons
    while read -r h tgt; do
        [ -n "$tgt" ] || continue
        src="$BASE/$(basename "$tgt")"
        [ -f "$src" ] || continue
        if [ -f "$tgt" ] && [ "$(md5sum "$tgt" | cut -d' ' -f1)" = "$h" ]; then
            continue
        fi
        cp "$src" "$tgt" || continue
        chmod +x "$tgt"
    done < backend.md5
    /mnt/userdata/binary/at_cond -b 2048
    sh /mnt/userdata/flux_stat/collect.sh daemon >/dev/null 2>&1 &
    if [ -f /mnt/userdata/sim_switch/on.txt ] && [ "$(head -c 1 /mnt/userdata/sim_switch/on.txt)" = "1" ]; then
        sh /mnt/userdata/sim_switch/ctl.sh boot
    fi
}

install() {
    normalize
    install_web || exit 1
    install_backend
    relay_link
}

boot() {
    if [ -c /dev/event0 ]; then
        cat /dev/event0 > /tmp/key_probe 2>/dev/null &
        KPID=$!
        sleep 2
        kill -9 $KPID 2>/dev/null
        if [ -s /tmp/key_probe ]; then
            rm -f /tmp/key_probe
            mount -o remount,rw / 2>/dev/null
            sed -i '/adol\/beta\.sh/d' /etc/rc 2>/dev/null
            sync 2>/dev/null
            mount -o remount,ro / 2>/dev/null
            echo "[SAFE_MODE] Hardware key pressed during boot. Autostart canceled." > "$BASE/safe_boot.log"
            touch "$BASE/HARDWARE_SAFE_MODE"
            exit 0
        fi
        rm -f /tmp/key_probe
    fi

    BC_FILE="$BASE/boot_count.txt"
    BC=0
    if [ -f "$BC_FILE" ]; then read BC < "$BC_FILE" 2>/dev/null; fi
    case "$BC" in ''|*[!0-9]*) BC=0;; esac

    if [ "$BC" -ge 3 ]; then
        echo "[CIRCUIT_BREAKER] Crash loop detected ($BC >= 3). Rolling back autostart to protect hardware!" > "$BASE/safe_boot.log"
        mount -o remount,rw / 2>/dev/null
        sed -i '/adol\/beta\.sh/d' /etc/rc 2>/dev/null
        sync 2>/dev/null
        mount -o remount,ro / 2>/dev/null
        rollback 2>/dev/null
        echo 0 > "$BC_FILE"
        touch "$BASE/CIRCUIT_BREAKER_TRIPPED"
        exit 0
    fi

    BC=`expr $BC + 1`
    echo "$BC" > "$BC_FILE"

    install

    (
        trap '' 1 15
        sleep 30
        if ps | grep goahead | grep -v grep >/dev/null 2>&1; then
            echo 0 > "$BASE/boot_count.txt"
            rm -f "$BASE/CIRCUIT_BREAKER_TRIPPED" "$BASE/HARDWARE_SAFE_MODE"
            echo "[HEALTHY] Boot verified healthy at `date`" >> "$BASE/safe_boot.log"
        fi
    ) </dev/null >/dev/null 2>&1 &
}

uninstall() {
    stop_daemons
    if is_mounted_dir "$WEB"; then
        umount -l "$WEB" 2>/dev/null || umount "$WEB" 2>/dev/null
    fi
    for f in $LIST; do
        is_mounted "$WEB/$f" && umount "$WEB/$f" 2>/dev/null
    done
    mount -o remount,rw / 2>/dev/null
    sed -i '/adol\/beta\.sh/d' /etc/rc 2>/dev/null
    rm -f /bin/wpa_supplicant 2>/dev/null
    sync
    mount -o remount,ro / 2>/dev/null
    rm -rf "$BASE" /tmp/flux_stat /tmp/battery_stat.txt /mnt/userdata/adolbeta /mnt/userdata/binary /mnt/userdata/flux_stat /mnt/userdata/lcd /mnt/userdata/qos /mnt/userdata/sim_switch /mnt/userdata/test_redir.txt /mnt/userdata/usb_func.txt /mnt/userdata/imei_out.txt /mnt/userdata/uptime_out.txt /mnt/userdata/lcd_task_tab.txt
}

status() {
    if is_mounted_dir "$WEB"; then
        echo "WEB shadow mounted"
    fi
    if netstat -ltn 2>/dev/null | grep -q ':2048 '; then
        echo "SVC at_cond running"
    fi
}

check() {
    is_mounted_dir "$WEB" && return 0
    for f in $LIST; do is_mounted "$WEB/$f" || return 1; done
}

case "$1" in
    boot)      boot ;;
    install)   install ;;
    uninstall) uninstall ;;
    rollback)  rollback ;;
    status)    status ;;
    check)     check ;;
    normalize) normalize ;;
    relay-link) relay_link ;;
    *) exit 2 ;;
esac
