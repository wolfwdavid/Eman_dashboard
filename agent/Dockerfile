# DID Grant Agent — container image for a Hugging Face Docker Space (or any Docker host).
# Runs the Telegram bot + email poller + dashboard chat API in one process.
# The LLM and Whisper are hosted services here (set LLM_BASE_URL / WHISPER_BASE_URL as Space secrets).
FROM python:3.13-slim

# Spaces run the container as uid 1000; create that user before copying files.
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CHAT_API_HOST=0.0.0.0 \
    CHAT_API_PORT=7860
WORKDIR $HOME/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY --chown=user . .
USER user

EXPOSE 7860
CMD ["python", "-m", "did_agent.main"]
