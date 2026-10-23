#!/bin/sh
DIR=/mnt/userdata/qos
MAP=$DIR/map
STATE=$DIR/state.txt
DEV=wlan0
TC=/bin/tc
is_mac(){ echo "$1"|grep -E '^[0-9A-Fa-f][0-9A-Fa-f]:[0-9A-Fa-f][0-9A-Fa-f]:[0-9A-Fa-f][0-9A-Fa-f]:[0-9A-Fa-f][0-9A-Fa-f]:[0-9A-Fa-f][0-9A-Fa-f]:[0-9A-Fa-f][0-9A-Fa-f]$'>/dev/null 2>&1;}
is_num(){ echo "$1"|grep -E '^[0-9]+$'>/dev/null 2>&1;}
emit_state(){ : > $STATE;if [ -s "$MAP" ];then while read m d u h;do [ -z "$m" ]&&continue;echo "$m|$d|$u|$h">>$STATE;done < $MAP;fi;}
apply(){
$TC qdisc del dev $DEV ingress >/dev/null 2>&1
$TC qdisc del dev $DEV root >/dev/null 2>&1
if [ ! -s "$MAP" ];then emit_state;return 0;fi
$TC qdisc add dev $DEV root handle 1: htb default 999
$TC class add dev $DEV parent 1: classid 1:999 htb rate 1000mbit
n=0
while read m d u h;do [ -z "$m" ]&&continue;n=`expr $n + 1`;cid=`expr 100 + $n`;[ "$d" = "0" ]&&continue;$TC class add dev $DEV parent 1: classid 1:$cid htb rate ${d}kbit ceil ${d}kbit;$TC filter add dev $DEV parent 1: protocol ip prio 1 u32 match ether dst $m flowid 1:$cid;done < $MAP
nu=0
while read m d u h;do [ -z "$m" ]&&continue;[ "$u" != "0" ]&&nu=1;done < $MAP
if [ "$nu" = "1" ];then $TC qdisc add dev $DEV handle ffff: ingress;while read m d u h;do [ -z "$m" ]&&continue;if [ "$u" != "0" ];then $TC filter add dev $DEV parent ffff: protocol ip prio 1 u32 match ether src $m police rate ${u}kbit burst 32k drop flowid :1;fi;done < $MAP;fi
emit_state
}
case "$1" in
set) m=$2;d=$3;u=$4;h=$5;if ! is_mac "$m"||! is_num "$d"||! is_num "$u";then exit 1;fi;h=`echo "$h"|sed 's/[|;]/-/g'`;[ -z "$h" ]&&h="-";touch $MAP;sed -i "/^$m /d" $MAP;echo "$m $d $u $h">>$MAP;apply;;
del) m=$2;is_mac "$m"||exit 1;touch $MAP;sed -i "/^$m /d" $MAP;apply;;
clear) : > $MAP;apply;;
list) emit_state;;
restore) apply;;
stat) $TC -s class show dev $DEV;$TC -s filter show dev $DEV;$TC -s filter show dev $DEV parent ffff:;;
esac
