@echo off
:loop
echo.
echo Starting MyKBD Node.js application...
echo Press Ctrl+C to stop the supervisor.
echo.

.\node\node.exe server/index.js


echo.
echo MyKBD has stopped or crashed. Restarting in 2 seconds...
timeout /t 2 /nobreak >nul

goto loop