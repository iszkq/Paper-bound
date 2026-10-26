FROM python:3.13-slim
WORKDIR /app
COPY server.py *.html *.css *.js ./
COPY fonts/ ./fonts/
COPY vendor/ ./vendor/
COPY data/ ./data/
RUN useradd --system --uid 10001 notes && mkdir /data && chown notes:notes /data
ENV NOTES_DATA_DIR=/data PYTHONUNBUFFERED=1
USER notes
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/session', timeout=4)"
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8080"]
