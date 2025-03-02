@echo off
cd /d "%~dp0"

echo Starting Flask server...

:: Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

:: Start the Flask server
python app.py

pause 