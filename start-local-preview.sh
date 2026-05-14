#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Starting local portfolio preview..."
echo "Open this address in your browser: http://localhost:8000"
echo "Press Ctrl+C in this terminal when you are done."
python3 -m http.server 8000 || python -m http.server 8000
