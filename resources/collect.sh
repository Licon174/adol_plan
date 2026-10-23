#!/bin/sh
D=/mnt/userdata/flux_stat
RAM=/tmp/flux_stat
mkdir -p "$D" "$RAM"

sync_to_flash() {
    [ -d "$RAM" ] || return 0
    for f in total.txt daily.txt hourly.txt uptime.txt; do
        [ -f "$RAM/$f" ] && cp -f "$RAM/$f" "$D/$f" 2>/dev/null
    done
    sync 2>/dev/null
}

update_battery_stat() {
    BL=`cat /sys/class/power_supply/battery/bat_level 2>/dev/null`
    BT=`cat /sys/class/power_supply/battery/temp 2>/dev/null`
    BV=`cat /sys/class/power_supply/battery/voltage_now 2>/dev/null`
    BH=`cat /sys/class/power_supply/battery/health 2>/dev/null`
    BC=`cat /sys/class/power_supply/battery/chgic_type 2>/dev/null`
    BE=`cat /sys/class/power_supply/battery/bat_exist 2>/dev/null`
    BS=`cat /sys/class/power_supply/charger/status 2>/dev/null`
    BP=`cat /sys/class/power_supply/charger/pc1_ac2 2>/dev/null`
    case "$BL" in ''|*[!0-9]*) BL=0;; esac
    case "$BT" in ''|*[!0-9]*) BT=0;; esac
    case "$BV" in ''|*[!0-9]*) BV=0;; esac
    case "$BE" in ''|*[!0-9]*) BE=0;; esac
    echo "{\"level\":$BL,\"temp\":$BT,\"voltage\":$BV,\"health\":\"$BH\",\"chip\":\"$BC\",\"exist\":$BE,\"status\":\"$BS\",\"pwr\":\"$BP\"}" > /tmp/battery_stat.txt 2>/dev/null
}

init_ram() {
    mkdir -p "$RAM"
    for f in total.txt daily.txt hourly.txt uptime.txt; do
        if [ -f "$D/$f" ] && [ ! -f "$RAM/$f" ]; then
            cp -f "$D/$f" "$RAM/$f" 2>/dev/null
        elif [ ! -f "$RAM/$f" ]; then
            touch "$RAM/$f"
        fi
    done
    update_battery_stat
}

do_collect() {
    RTX=$1
    RRX=$2
    case "$RTX" in ''|*[!0-9]*) RTX=0;; esac
    case "$RRX" in ''|*[!0-9]*) RRX=0;; esac

    CTX=0; CRX=0; LTX=0; LRX=0
    if [ -f "$RAM/total.txt" ]; then
        read CTX CRX LTX LRX < "$RAM/total.txt" 2>/dev/null
    fi
    case "$CTX" in ''|*[!0-9]*) CTX=0;; esac
    case "$CRX" in ''|*[!0-9]*) CRX=0;; esac
    case "$LTX" in ''|*[!0-9]*) LTX=0;; esac
    case "$LRX" in ''|*[!0-9]*) LRX=0;; esac

    if [ "$RTX" -ge "$LTX" ]; then DTX=`expr $RTX - $LTX`; else DTX=$RTX; fi
    if [ "$RRX" -ge "$LRX" ]; then DRX=`expr $RRX - $LRX`; else DRX=$RRX; fi

    CTX=`expr $CTX + $DTX`
    CRX=`expr $CRX + $DRX`
    echo "$CTX $CRX $RTX $RRX" > "$RAM/total.txt"

    YEAR=`date +%Y 2>/dev/null`
    case "$YEAR" in ''|*[!0-9]*) YEAR=2000;; esac

    if [ "$YEAR" -ge 2024 ]; then
        DAY=`date +%Y-%m-%d`
        : > "$RAM/daily.tmp"
        if [ -f "$RAM/daily.txt" ]; then
            grep -v "^$DAY " "$RAM/daily.txt" 2>/dev/null | grep -v "^2000-" >> "$RAM/daily.tmp" 2>/dev/null
        fi
        echo "$DAY $CTX $CRX" >> "$RAM/daily.tmp"
        mv "$RAM/daily.tmp" "$RAM/daily.txt"

        if [ -f "$RAM/daily.txt" ]; then
            LINES=`wc -l < "$RAM/daily.txt"`
            case "$LINES" in ''|*[!0-9]*) LINES=0;; esac
            if [ "$LINES" -gt 400 ]; then
                CUT=`expr $LINES - 400`
                sed -i "1,${CUT}d" "$RAM/daily.txt" 2>/dev/null
            fi
        fi

        HDAY=`date +%Y-%m-%d`
        HH=`date +%H`
        : > "$RAM/hourly.tmp"
        if [ -f "$RAM/hourly.txt" ]; then
            grep -v "^$HDAY $HH " "$RAM/hourly.txt" 2>/dev/null | grep -v "^2000-" >> "$RAM/hourly.tmp" 2>/dev/null
        fi
        echo "$HDAY $HH $CTX $CRX" >> "$RAM/hourly.tmp"
        mv "$RAM/hourly.tmp" "$RAM/hourly.txt"

        if [ -f "$RAM/hourly.txt" ]; then
            HL=`wc -l < "$RAM/hourly.txt"`
            case "$HL" in ''|*[!0-9]*) HL=0;; esac
            if [ "$HL" -gt 200 ]; then
                HCUT=`expr $HL - 200`
                sed -i "1,${HCUT}d" "$RAM/hourly.txt" 2>/dev/null
            fi
        fi
    fi

    U=`cut -d' ' -f1 /proc/uptime 2>/dev/null | cut -d. -f1`
    case "$U" in ''|*[!0-9]*) U=0;; esac
    echo "$U $U" > "$RAM/uptime.txt"
}

case "$1" in
clear)
    init_ram
    RTX=$2; RRX=$3
    case "$RTX" in ''|*[!0-9]*) RTX=0;; esac
    case "$RRX" in ''|*[!0-9]*) RRX=0;; esac
    echo "0 0 $RTX $RRX" > "$RAM/total.txt"
    : > "$RAM/daily.txt"
    : > "$RAM/hourly.txt"
    sync_to_flash
    exit 0
    ;;
sync)
    sync_to_flash
    exit 0
    ;;
stop)
    if [ -f "$RAM/daemon.pid" ]; then
        DPID=`cat "$RAM/daemon.pid" 2>/dev/null`
        [ -n "$DPID" ] && kill -9 "$DPID" 2>/dev/null
        rm -f "$RAM/daemon.pid"
    fi
    sync_to_flash
    exit 0
    ;;
daemon)
    trap '' 1 15
    init_ram
    echo "$$" > "$RAM/daemon.pid"
    TICK=0
    while true; do
        if [ -f "$RAM/daemon.pid" ]; then
            CURPID=`cat "$RAM/daemon.pid" 2>/dev/null`
            [ "$CURPID" = "$$" ] || exit 0
        else
            exit 0
        fi

        SW="1"
        [ -f "$D/switch" ] && SW=`cat "$D/switch" 2>/dev/null`
        if [ "$SW" != "0" ]; then
            NTX=`nv get realtime_tx_bytes 2>/dev/null`
            NRX=`nv get realtime_rx_bytes 2>/dev/null`
            NTX=${NTX#*=}
            NRX=${NRX#*=}
            do_collect "$NTX" "$NRX"
        fi
        update_battery_stat

        TICK=`expr $TICK + 1`
        if [ "$TICK" -ge 120 ]; then
            sync_to_flash
            TICK=0
        fi
        sleep 30
    done
    ;;
*)
    init_ram
    do_collect "$1" "$2"
    exit 0
    ;;
esac
