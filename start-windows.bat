@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Chua Online - TikTok LIVE
set "NODE_VER=v20.18.0"
set "NODE_DIR=%~dp0node"

rem 1) Uu tien Node portable trong thu muc du an
if exist "%NODE_DIR%\node.exe" goto useLocal

rem 2) Neu may da cai Node thi dung luon
where node >nul 2>nul
if not errorlevel 1 goto run

rem 3) Chua co Node: tu tai ban portable (khong can cai dat)
echo Dang tai Node.js portable (lan dau, ~30MB)...
if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';" ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$u='https://nodejs.org/dist/%NODE_VER%/node-%NODE_VER%-win-x64.zip';" ^
  "$z=Join-Path $env:TEMP 'node-portable.zip'; Invoke-WebRequest $u -OutFile $z;" ^
  "$t=Join-Path $env:TEMP 'node-portable'; if(Test-Path $t){Remove-Item $t -Recurse -Force};" ^
  "Expand-Archive $z $t; Move-Item (Join-Path $t 'node-%NODE_VER%-win-x64') $env:NODE_DIR; Remove-Item $z"
if not exist "%NODE_DIR%\node.exe" (
  echo Tai Node that bai. Kiem tra mang hoac cai tay tai https://nodejs.org
  pause
  exit /b
)

:useLocal
set "PATH=%NODE_DIR%;%PATH%"

:run
if not exist node_modules (
  echo Dang cai thu vien lan dau, vui long doi...
  call npm install --omit=dev
)

rem 4) Ghi "127.0.0.1 localtest.me" vao file hosts (1 lan, can quyen Admin).
rem    localtest.me tro ve chinh may minh, nhung nhieu router / nha mang chan ten mien tro ve 127.0.0.1
rem    -> LIVE Studio hien chua trong. Co dong nay trong hosts thi khong can mang, khong bi chan.
set "HOSTS=%SystemRoot%\System32\drivers\etc\hosts"
findstr /i /r /c:"^[^#]*localtest\.me" "%HOSTS%" >nul 2>nul
if not errorlevel 1 goto hostsDone
rem Mang van tra localtest.me ve 127.0.0.1 binh thuong -> khong can sua hosts
powershell -NoProfile -Command "try { if ([Net.Dns]::GetHostAddresses('localtest.me').IPAddressToString -contains '127.0.0.1') { exit 0 } } catch {} ; exit 1" >nul 2>nul
if not errorlevel 1 goto hostsDone
echo.
echo [localtest.me] Mang dang CHAN localtest.me (router / nha mang) - LIVE Studio se hien chua trong.
echo [localtest.me] Dang them localtest.me vao file hosts de khac phuc.
net session >nul 2>nul
if errorlevel 1 goto hostsElevate
rem Dang chay voi quyen Admin (chuot phai - Run as administrator): bo thuoc tinh chi-doc roi ghi thang
attrib -r "%HOSTS%" >nul 2>nul
(echo.& echo 127.0.0.1 localtest.me)>>"%HOSTS%"
ipconfig /flushdns >nul 2>nul
goto hostsCheck

:hostsElevate
echo                Windows se hoi quyen Admin: bam "Yes" / "Co" (bang hoi co the nhap nhay o thanh Taskbar).
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process cmd -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '/c','attrib -r %HOSTS% & (echo.& echo 127.0.0.1 localtest.me)>>%HOSTS% & ipconfig /flushdns' -ErrorAction Stop } catch { Write-Host ('                Loi: ' + $_.Exception.Message) }"

:hostsCheck
findstr /i /r /c:"^[^#]*localtest\.me" "%HOSTS%" >nul 2>nul
if errorlevel 1 goto hostsFail
echo [localtest.me] Da them xong.
echo.
goto hostsDone

:hostsFail
echo [localtest.me] CHUA THEM DUOC. Cach khac:
echo    1. Dong cua so nay, CHUOT PHAI vao start-windows.bat - chon "Run as administrator".
echo    2. Neu da chay Admin ma van "Access is denied": phan mem diet virus (Kaspersky, Bkav, Avast...)
echo       dang khoa file hosts - tat tam tinh nang bao ve hosts roi chay lai file nay,
echo       hoac mo Notepad bang "Run as administrator", mo %HOSTS%
echo       them dong:  127.0.0.1 localtest.me   roi luu lai.
echo    3. Hoac khong dung link: mo http://localhost:8080/?clean=1 bang Chrome, F11,
echo       trong LIVE Studio them nguon "Window capture" chon cua so Chrome.
echo.

:hostsDone

node server.mjs
pause
