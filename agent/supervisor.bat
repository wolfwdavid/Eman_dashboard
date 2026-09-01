@echo off
REM Task Scheduler entrypoint ("At log on", "Run only when user is logged on").
REM Restarts the bot on ANY exit (Task Scheduler alone only restarts on non-zero exit).
REM Single-instance: run this ONCE per machine — two pollers on one token = 409 Conflict.
REM See WINDOWS-DEPLOY.md for the schtasks registration.

setlocal
REM python.exe, not pythonw.exe: pythonw has no stdout, so nothing could be logged.
set VENV_PY=%~dp0.venv\Scripts\python.exe
set LOG=%TEMP%\did-grant-agent.log

REM Task Scheduler starts tasks in C:\Windows\System32; `-m did_agent.main` needs the agent dir.
cd /d "%~dp0"

:loop
echo [supervisor] %DATE% %TIME% starting bot>> "%LOG%"
"%VENV_PY%" -m did_agent.main >> "%LOG%" 2>&1
echo [supervisor] %DATE% %TIME% bot exited, restarting in 5s...>> "%LOG%"
timeout /t 5 /nobreak >nul
goto loop
