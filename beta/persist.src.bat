@echo off
chcp 936>nul
setlocal enabledelayedexpansion

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
echo 正在配置开机自启（带防变砖看门狗与按键安全模式）...
adb -s %DEV% shell "mount -o remount,rw / && sed -i '/adol\/beta\.sh/d' /etc/rc && echo '(sleep 8; [ -f /mnt/userdata/adol/beta.sh ] && sh /mnt/userdata/adol/beta.sh boot >/dev/null 2>&1) &' >> /etc/rc && sync && mount -o remount,ro /" >nul 2>&1
if errorlevel 1 (echo [X] 配置失败&pause&exit /b 1)

echo.
echo 持久化配置完成
pause
exit /b 0
