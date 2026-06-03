# Job Agent container: Node.js server + Python resume extractor.
# Built for cloud platforms (Render / Railway / Fly.io) connected to GitHub.
FROM node:20-slim

# Python is required by scripts/extract_resume.py (pypdf, python-docx).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into an isolated virtualenv.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

WORKDIR /app

# Copy the application (see .dockerignore for what is excluded).
COPY . .

# The server has no npm dependencies (built-in Node modules only),
# so there is no `npm install` step.

# Bind to all interfaces so the platform can route traffic, and point the
# resume extractor at the virtualenv Python. PORT is provided by the platform.
ENV HOST=0.0.0.0
ENV PYTHON_EXE=/opt/venv/bin/python3
ENV PORT=4317
EXPOSE 4317

CMD ["node", "server.mjs"]
