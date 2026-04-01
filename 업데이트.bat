@echo off
chcp 65001 >nul
title 샵플링 확장프로그램 업데이트
echo ==========================================
echo   샵플링 이미지수정 확장프로그램 업데이트
echo ==========================================
echo.

set TARGET=D:\이미지수정
set BRANCH=claude/load-sampling-image-edits-bt2Xf
set BASE=https://raw.githubusercontent.com/sparklebs3029-sudo/claude/%BRANCH%

if not exist "%TARGET%" mkdir "%TARGET%"
cd /d "%TARGET%"

echo [1/9] manifest.json 다운로드...
curl -sL -o manifest.json "%BASE%/manifest.json"
echo [2/9] background.js 다운로드...
curl -sL -o background.js "%BASE%/background.js"
echo [3/9] content.js 다운로드...
curl -sL -o content.js "%BASE%/content.js"
echo [4/9] editor.html 다운로드...
curl -sL -o editor.html "%BASE%/editor.html"
echo [5/9] editor.js 다운로드...
curl -sL -o editor.js "%BASE%/editor.js"
echo [6/9] popup.html 다운로드...
curl -sL -o popup.html "%BASE%/popup.html"
echo [7/9] popup.js 다운로드...
curl -sL -o popup.js "%BASE%/popup.js"
echo [8/9] webedit_reader.js 다운로드...
curl -sL -o webedit_reader.js "%BASE%/webedit_reader.js"
echo [9/9] shopling_server.py 다운로드...
curl -sL -o shopling_server.py "%BASE%/shopling_server.py"

echo.
echo ==========================================
echo   업데이트 완료!
echo ==========================================
echo.
echo   다음 단계:
echo   1. chrome://extensions 에서 확장프로그램 새로고침
echo   2. 서버실행.bat 더블클릭
echo.
pause
