# Use official Python 3.10 slim base image
FROM python:3.10-slim

# Set workdir inside container
WORKDIR /app

# Install system dependencies required for your app, yt-dlp, ffmpeg etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    curl \
    ffmpeg \
    git \
    libffi-dev \
    libssl-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements to leverage Docker cache
COPY requirements.txt .

# Upgrade pip and install Python packages globally
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy rest of app source code
COPY . .

# Expose port from env variable (Railway uses PORT env)
ENV PORT 8000

# Default command to run the app using the dynamic PORT
CMD ["sh", "-c", "python app.py"]
