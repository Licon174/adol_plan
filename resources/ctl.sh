D=/mnt/userdata/sim_switch
BIN=$D/key2simd
PIDF=$D/key2simd.pid
alive(){ ps | grep "$BIN" | grep -v grep | awk '{print $1}'; }
kills(){ P=`alive`; [ -n "$P" ]&&kill $P 2>/dev/null; sleep 1; P=`alive`; [ -n "$P" ]&&kill -9 $P 2>/dev/null; }
onflag(){ [ -f $D/on.txt ]&&[ "`head -c 1 $D/on.txt 2>/dev/null`" = "1" ]; }
case "$1" in
start) [ -x $BIN ]||exit 1; [ -n "`alive`" ]&&exit 0; rm -f $PIDF; $BIN -D;;
stop) kills; rm -f $PIDF;;
restart) kills; rm -f $PIDF; sleep 2; $BIN -D; sleep 1; [ -z "`alive`" ]&&$BIN -D;;
boot) onflag&&[ -x $BIN ]&&[ -e /dev/event0 ]&&[ -z "`alive`" ]&&$BIN -D;;
status) if [ -n "`alive`" ];then echo running;else echo stopped;fi;;
esac
exit 0
