"""
Backend API for VQA System with Enhanced Debugging
Provides Azure Speech token and BLIP-based Visual Question Answering endpoints
"""

import cv2
import torch
import base64
import numpy as np
from PIL import Image
from transformers import BlipProcessor, BlipForQuestionAnswering
from aiohttp import web
import asyncio
import os
from io import BytesIO
from dotenv import load_dotenv
from datetime import datetime

try:
    from api_routes import setup_additional_routes
except ImportError:
    print("⚠️  api_routes.py not found - preferences API will not be available")
    setup_additional_routes = None

# Load environment variables
print("\n" + "="*60)
print("🔧 LOADING ENVIRONMENT VARIABLES")
print("="*60)
load_dotenv()

# Check environment variables
AZURE_SPEECH_KEY = os.getenv('AZURE_SPEECH_KEY')
AZURE_SPEECH_REGION = os.getenv('AZURE_SPEECH_REGION', 'eastus')
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8000))

print(f"AZURE_SPEECH_KEY: {'✅ Found' if AZURE_SPEECH_KEY else '❌ NOT FOUND'}")
if AZURE_SPEECH_KEY:
    print(f"  Key length: {len(AZURE_SPEECH_KEY)} chars")
    print(f"  Key preview: {AZURE_SPEECH_KEY[:8]}...{AZURE_SPEECH_KEY[-4:]}")
print(f"AZURE_SPEECH_REGION: {AZURE_SPEECH_REGION}")
print(f"HOST: {HOST}")
print(f"PORT: {PORT}")
print("="*60 + "\n")

# Azure Speech SDK imports
try:
    import azure.cognitiveservices.speech as speechsdk
    AZURE_AVAILABLE = AZURE_SPEECH_KEY is not None
    if AZURE_AVAILABLE:
        print(f"✅ Azure Speech SDK loaded successfully")
        print(f"   Region: {AZURE_SPEECH_REGION}")
    else:
        print(f"❌ Azure Speech SDK loaded but NO API KEY found")
        print(f"   Please set AZURE_SPEECH_KEY in .env file")
except ImportError as e:
    AZURE_AVAILABLE = False
    print(f"❌ Azure Speech SDK import failed: {e}")

# Azure integration imports
try:
    from azure_integration import AzureServicesManager
    azure = AzureServicesManager()
    print("✅ Azure services manager initialized")
except Exception as e:
    print(f"⚠️  Azure services manager not available: {e}")
    azure = None

# Global models
device = None
processor = None
blip_model = None

async def init_models():
    """Initialize BLIP model on startup"""
    global device, processor, blip_model
    
    print("\n" + "="*60)
    print("🤖 INITIALIZING AI MODELS")
    print("="*60)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    
    try:
        print("\n📥 Loading BLIP VQA model...")
        processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
        print("   ✅ Processor loaded")
        
        blip_model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base").to(device)
        blip_model.eval()
        print("   ✅ Model loaded and set to eval mode")
        print("="*60 + "\n")
    except Exception as e:
        print(f"❌ BLIP model loading failed: {e}")
        processor = None
        blip_model = None


def decode_base64_image(base64_string: str) -> Image.Image:
    """Decode base64 string to PIL Image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    image_data = base64.b64decode(base64_string)
    image = Image.open(BytesIO(image_data)).convert('RGB')
    return image


def blip_answer(image: Image.Image, question: str) -> str:
    """Generate answer using BLIP model"""
    global processor, blip_model, device
    
    if processor is None or blip_model is None:
        return "VQA model not available"
    
    try:
        inputs = processor(image, question, return_tensors="pt").to(device)
        with torch.no_grad():
            out = blip_model.generate(**inputs, max_length=50)
        answer = processor.decode(out[0], skip_special_tokens=True)
        return answer
    except Exception as e:
        print(f"❌ BLIP inference error: {e}")
        return f"Error processing question: {str(e)}"


# CORS middleware with logging
@web.middleware
async def cors_middleware(request, handler):
    """Add CORS headers to all responses with logging"""
    origin = request.headers.get('Origin', 'unknown')
    method = request.method
    path = request.path
    
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] 🌐 {method:7s} {path:30s} Origin: {origin}")
    
    if request.method == 'OPTIONS':
        response = web.Response()
        print(f"[{timestamp}]    ✅ CORS preflight handled")
    else:
        try:
            response = await handler(request)
            print(f"[{timestamp}]    ✅ Response: {response.status}")
        except Exception as e:
            print(f"[{timestamp}]    ❌ Handler error: {e}")
            raise
    
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


async def handle_speech_token(request):
    """
    GET /api/speech-token
    Returns short-lived Azure Speech SDK token
    """
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"\n[{timestamp}] 🎤 SPEECH TOKEN REQUEST")
    print(f"   Azure Available: {AZURE_AVAILABLE}")
    print(f"   Key Present: {AZURE_SPEECH_KEY is not None}")
    print(f"   Region: {AZURE_SPEECH_REGION}")
    
    if not AZURE_AVAILABLE:
        print(f"   ❌ Azure Speech SDK not configured")
        return web.json_response(
            {'error': 'Azure Speech SDK not configured. Check AZURE_SPEECH_KEY in .env'},
            status=500
        )
    
    try:
        # Method 1: Direct HTTP request to Azure token endpoint (more reliable)
        import aiohttp
        
        print(f"   Fetching token via HTTP...")
        token_url = f'https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken'
        
        headers = {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY
        }
        
        print(f"   Token URL: {token_url}")
        print(f"   Using key: {AZURE_SPEECH_KEY[:8]}...{AZURE_SPEECH_KEY[-4:]}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(token_url, headers=headers) as response:
                print(f"   Response status: {response.status}")
                
                if response.status == 200:
                    token = await response.text()
                    print(f"   ✅ Token generated successfully")
                    print(f"   Token length: {len(token)} chars")
                    print(f"   Token preview: {token[:20]}...")
                    
                    return web.json_response({
                        'token': token,
                        'region': AZURE_SPEECH_REGION
                    })
                else:
                    error_text = await response.text()
                    print(f"   ❌ Token fetch failed!")
                    print(f"   Status: {response.status}")
                    print(f"   Error: {error_text}")
                    
                    return web.json_response({
                        'error': f'Azure token fetch failed: {response.status} - {error_text}'
                    }, status=500)
        
    except Exception as e:
        print(f"   ❌ Token generation error: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response(
            {'error': f'Failed to generate token: {str(e)}'},
            status=500
        )


async def handle_vqa(request):
    """
    POST /api/vqa
    Accepts: { imageBase64: string, question: string }
    Returns: { answer: string }
    """
    timestamp = datetime.now().strftime("%H:%M:%S")
    
    try:
        print(f"\n[{timestamp}] 💬 VQA REQUEST")
        
        data = await request.json()
        image_base64 = data.get('imageBase64')
        question = data.get('question')
        
        print(f"   Question: {question}")
        print(f"   Image data present: {image_base64 is not None}")
        if image_base64:
            print(f"   Image data length: {len(image_base64)} chars")
        
        if not image_base64 or not question:
            print(f"   ❌ Missing data!")
            return web.json_response(
                {'error': 'Missing imageBase64 or question'},
                status=400
            )
        
        print(f"   Model loaded: {blip_model is not None}")
        
        if blip_model is None:
            print(f"   ❌ BLIP model not loaded!")
            return web.json_response(
                {'error': 'VQA model not loaded yet. Wait for initialization.'},
                status=503
            )
        
        import time
        start_time = time.time()
        
        print(f"   Decoding image...")
        image = decode_base64_image(image_base64)
        print(f"   Image size: {image.size}")
        
        print(f"   Generating answer...")
        answer = blip_answer(image, question)
        
        response_time = time.time() - start_time
        
        print(f"   ✅ Answer: {answer}")
        print(f"   Response time: {response_time:.2f}s")
        
        # Log to Azure if available
        if azure:
            try:
                user_id = azure.user_id or "guest_user"
                azure.sql.log_query(user_id, question, answer)
                azure.monitor.track_query(question, response_time)
                print(f"   ✅ Logged to Azure")
            except Exception as e:
                print(f"   ⚠️  Azure logging error: {e}")
        
        return web.json_response({
            'answer': answer
        })
        
    except Exception as e:
        print(f"   ❌ VQA error: {e}")
        import traceback
        traceback.print_exc()
        
        if azure:
            try:
                azure.monitor.track_error(str(e), "VQA_ENDPOINT")
            except:
                pass
        
        return web.json_response(
            {'error': f'VQA processing failed: {str(e)}'},
            status=500
        )


async def handle_health(request):
    """GET / - Health check endpoint"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"\n[{timestamp}] 🏥 HEALTH CHECK")
    
    status = {
        'status': 'running',
        'timestamp': timestamp,
        'blip_loaded': blip_model is not None,
        'azure_speech_available': AZURE_AVAILABLE,
        'azure_services': azure is not None,
        'device': str(device),
        'env_vars': {
            'AZURE_SPEECH_KEY': '✅ Set' if AZURE_SPEECH_KEY else '❌ Missing',
            'AZURE_SPEECH_REGION': AZURE_SPEECH_REGION,
            'HOST': HOST,
            'PORT': PORT
        }
    }
    
    print(f"   Status: {status}")
    return web.json_response(status)


async def on_startup(app):
    """Initialize models on startup"""
    print("\n" + "="*60)
    print("🚀 SERVER STARTING UP")
    print("="*60)
    await init_models()
    print("\n✅ Server ready to accept connections\n")


async def on_cleanup(app):
    """Cleanup on shutdown"""
    print("\n" + "="*60)
    print("🛑 SERVER SHUTTING DOWN")
    print("="*60)


def create_app():
    """Create and configure the application"""
    app = web.Application(middlewares=[cors_middleware])
    
    # Add routes
    app.router.add_get('/', handle_health)
    app.router.add_get('/api/speech-token', handle_speech_token)
    app.router.add_post('/api/vqa', handle_vqa)
    
    # Add additional routes (preferences, etc.)
    if setup_additional_routes:
        setup_additional_routes(app)
        print("✅ Additional API routes registered")
    
    # Add startup/cleanup handlers
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    
    return app


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 VQA BACKEND SERVER")
    print("="*60)
    print(f"📍 Host: {HOST}")
    print(f"🔌 Port: {PORT}")
    print(f"🔗 Endpoints:")
    print(f"   GET  /                      - Health check")
    print(f"   GET  /api/speech-token      - Azure Speech token")
    print(f"   POST /api/vqa               - Visual QA")
    print(f"   GET  /api/preferences       - Get user preferences")
    print(f"   POST /api/preferences       - Save user preferences")
    print("="*60)
    print(f"\n💡 Test connection:")
    print(f"   curl http://{HOST}:{PORT}/")
    print(f"   curl http://{HOST}:{PORT}/api/speech-token")
    print("="*60 + "\n")
    
    app = create_app()
    web.run_app(app, host=HOST, port=PORT, print=None)