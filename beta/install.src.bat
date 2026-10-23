@echo off
chcp 936>nul
setlocal enabledelayedexpansion
set "SRC=%~dp0files"
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
echo 正在推送...
adb -s %DEV% shell "mkdir -p %DST%" >nul 2>&1
for %%f in (app.css app.js favicon.ico index.html web.md5 at_cond backend.md5 collect.sh ctl.sh imei_tool key2simd qos.sh wpa_supplicant beta.sh) do (
  if not exist "%SRC%\%%f" (echo [X] 缺失文件: %%f&pause&exit /b 1)
  adb -s %DEV% push "%SRC%\%%f" "%DST%/%%f" >nul 2>nul || echo [!] %%f 推送失败
)

echo 正在部署...
adb -s %DEV% shell "sh %DST%/beta.sh install"
if errorlevel 1 (echo [X] 部署失败&pause&exit /b 1)

echo.
echo 部署完成: http://192.168.0.1
pause
exit /b 0
