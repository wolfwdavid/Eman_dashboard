@echo off
REM Task Scheduler entrypoint ("At log on", "Run only when user is logged on").
REM Restarts the bot on ANY exit (Task Scheduler alone only restarts on non-zero exit).
REM Single-instance: run this ONCE per machine — two pollers on one token = 409 Conflict.
REM Edit the two paths below to match this checkout, then point a Task Scheduler task at this file.

setlocal
set VENV_PY=%~dp0.venv\Scripts\pythonw.exe
set AGENT_DIR=%~dp0

:loop
"%VENV_PY%" -m did_agent.main
echo [supervisor] bot exited, restarting in 5s...
timeout /t 5 /nobreak >nul
goto loop
