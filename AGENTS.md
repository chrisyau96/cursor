# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Single-file Python/Streamlit dashboard (`app.py`). No database, no Docker, no external services required.

### Running the application

```
streamlit run app.py --server.headless true --server.port 8501
```

The app serves on `http://localhost:8501` and loads built-in sample data when no file is uploaded.

### Linting and testing

No dedicated lint config or test suite exists in this repo. Use `python3 -m py_compile app.py` for basic syntax validation. Standard commands are in the README under "Run locally".

### Dependencies

Managed via `pip install -r requirements.txt` (Python 3.12, system-installed). No virtual environment is needed in the Cloud Agent VM since packages install globally.
