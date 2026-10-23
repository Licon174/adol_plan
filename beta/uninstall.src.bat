@echo off
chcp 936>nul
setlocal enabledelayedexpansion
set "DST=/mnt/userdata/adol"

where adb>nul 2>&1 || (echo [X] 未找到 adb&pause&exit /b 1)

set /a N=0
for /f "tokens=1" %%s in ('adb devices ^| findstr /r "	device$"') do (
  set "SN=%%s"
  set "VER="
  for /f "usebackq delims=" %%v in (`adb -s !SN! shell "nv get wa_inner_version" 2^>nul`) do set "VER=%%v"
  echo !VER! | findstr /l /c:"M2FW1.0" >nul && (
    set /a N+=1
    set "DEV_!N!=!SN!"
  )
)
if "%N%"=="0" (echo [X] 未发现设备&pause&exit /b 1)

set "DEV="
if "%N%"=="1" (
  for /f "tokens=2 delims==" %%v in ('set DEV_1') do set "DEV=%%v"
) else (
  set /p "PICK=选择设备编号 (1-%N%): "
  set "DEV=!DEV_%PICK%!"
  if not defined DEV (echo [X] 编号无效&pause&exit /b 1)
)

echo 设备: %DEV%
echo 正在卸载...
adb -s %DEV% shell "sh %DST%/beta.sh uninstall 2>/dev/null; killall at_cond key2simd 2>/dev/null; umount -l /etc_ro/web 2>/dev/null || umount /etc_ro/web 2>/dev/null; mount -o remount,rw / 2>/dev/null; sed -i '/adol\/beta\.sh/d' /etc/rc 2>/dev/null; rm -f /bin/wpa_supplicant 2>/dev/null; sync 2>/dev/null; mount -o remount,ro / 2>/dev/null; rm -rf %DST% /tmp/flux_stat /tmp/battery_stat.txt /mnt/userdata/adolbeta /mnt/userdata/binary /mnt/userdata/flux_stat /mnt/userdata/lcd /mnt/userdata/qos /mnt/userdata/sim_switch /mnt/userdata/test_redir.txt /mnt/userdata/usb_func.txt /mnt/userdata/imei_out.txt /mnt/userdata/uptime_out.txt /mnt/userdata/lcd_task_tab.txt" >nul 2>&1

echo.
echo 卸载完成
pause
exit /b 0
