# VQA Backend Server

Backend API server providing Azure Speech token generation and BLIP-based Visual Question Answering.

## Features

- 🎤 Azure Speech SDK token generation (short-lived, secure)
- 🤖 BLIP Visual Question Answering
- 🚀 Async HTTP API with CORS support
- 🔧 GPU acceleration (CUDA) when available

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` and add your Azure Speech credentials:

```
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=eastus
```

### 3. Run Server

```bash
python main.py
```

Server will start on `http://localhost:8080`

## API Endpoints

### Health Check
```
GET /
```

Returns server status and model availability.

### Speech Token
```
GET /api/speech-token
```

Returns:
```json
{
  "token": "eyJ0eXAiOiJKV1...",
  "region": "eastus"
}
```

### Visual Question Answering
```
POST /api/vqa
Content-Type: application/json

{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
  "question": "What is in this image?"
}
```

Returns:
```json
{
  "answer": "a person standing in front of a building"
}
```

## Frontend Integration

Update frontend `.env` file:

```
VITE_API_BASE_URL=http://localhost:8080
```

The frontend will automatically use these endpoints for speech and VQA functionality.

## Requirements

- Python 3.8+
- Azure Speech Service subscription (for STT/TTS)
- 4GB+ RAM (8GB+ recommended for GPU)
- CUDA-capable GPU (optional, for faster inference)

## Troubleshooting

**BLIP model fails to load:**
- Ensure you have enough RAM/VRAM
- Check internet connection (first run downloads ~1GB model)

**Azure token errors:**
- Verify `AZURE_SPEECH_KEY` is correct
- Check region matches your Azure subscription

**CORS errors:**
- Backend automatically allows all origins
- Ensure backend URL in frontend `.env` is correct
