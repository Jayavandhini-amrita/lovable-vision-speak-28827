# Vision-Speak: AI-Powered Visual Assistance System

A comprehensive real-time visual assistance application with object detection, visual question answering, voice interaction, and intelligent priority-based TTS announcements.

## Features

- 🎥 **Real-time Object Detection** - YOLOv11n with 20+ object classes
- 🚨 **Dynamic Priority System** - Smart obstacle warnings based on size & approach
- 🎤 **Voice Input (STT)** - Azure Speech SDK for hands-free questions
- 🔊 **Priority TTS Queue** - Intelligent speech synthesis with 6 priority levels
- 💬 **Visual Q&A** - BLIP-powered scene understanding
- ⚙️ **User Preferences** - Customizable TTS speed, intervals, priority modes
- 📱 **Responsive Design** - Desktop (Space bar) & Mobile (double-tap) controls
- 🔒 **Secure** - Token-based auth, Azure SQL preferences storage

## Technology Stack

- **Frontend Framework**: React 18 + TypeScript + Vite
- **AI/ML**: TensorFlow.js + YOLOv11n
- **Voice I/O**: Azure Cognitive Services Speech SDK
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Hooks

## Prerequisites

- Node.js 18+ and npm
- Backend API running with the following endpoints:
  - `GET /api/speech-token` - Returns Azure Speech SDK token
  - `POST /api/vqa` - Accepts image + question, returns answer
- YOLOv11n model files in `public/models/yolo11n/`

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your backend API URL:
# VITE_API_BASE_URL=http://localhost:8000
```

## Model Setup

Place your converted YOLOv11n TensorFlow.js model files in:
```
public/models/yolo11n/
├── model.json
└── group1-shard1of1.bin (or similar shards)
```

## Running the Application

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:8080`

## Usage

1. **Grant camera permissions** when prompted
2. **Wait for initialization**:
   - Camera feed starts
   - AI model loads (~5-10 seconds)
   - Voice features initialize
3. **Ask questions**:
   - Type in the text box and press Enter
   - Or click the microphone button for voice input
4. **View answers**:
   - Answers appear in the conversation history
   - AI speaks the answer (can be muted)

## Architecture

### Components

- **`CameraCanvas`** - Manages video stream, YOLO model, detection loop
- **`VQAControls`** - Question input, voice controls, conversation history
- **`StatusBar`** - System status indicators
- **`useSpeech`** - Custom hook for Azure Speech SDK (STT/TTS)

### API Communication

```typescript
// Token fetching (called on init and token expiry)
GET /api/speech-token
Response: { token: string, region: string }

// VQA request
POST /api/vqa
Body: { imageBase64: string, question: string }
Response: { answer: string }
```

## Performance Optimization

- **TensorFlow.js**: Uses WebGL backend, tf.tidy() for memory management
- **Detection Loop**: Throttled to ~15 FPS for mobile compatibility
- **Frame Capture**: Offscreen canvas for high-quality capture
- **NMS**: Applied to reduce duplicate detections

## Security

- ✅ No API keys or secrets in frontend code
- ✅ Token-based Azure Speech SDK authentication
- ✅ Tokens fetched just-in-time from backend
- ✅ Automatic token refresh on expiry

## Browser Compatibility

- Chrome 90+ (recommended)
- Edge 90+
- Safari 14+
- Firefox 88+

**Note**: Camera and microphone access required. HTTPS recommended for production.

## Troubleshooting

### Model won't load
- Check that model files exist at `/public/models/yolo11n/model.json`
- Verify CORS headers if serving from different domain
- Check browser console for TensorFlow.js errors

### Voice features not working
- Ensure backend `/api/speech-token` endpoint is accessible
- Check Azure subscription key is valid on backend
- Verify microphone permissions granted in browser

### VQA requests failing
- Confirm backend `/api/vqa` endpoint is running
- Check network tab for request/response details
- Verify image capture is working (check console logs)

## Development

### Key Files

- `src/pages/Index.tsx` - Main application logic
- `src/components/CameraCanvas.tsx` - Detection engine
- `src/hooks/useSpeech.ts` - Voice I/O logic
- `src/lib/api-utils.ts` - Backend communication
- `src/index.css` - Design system tokens

### Environment Variables

```bash
VITE_API_BASE_URL=http://localhost:8000  # Backend API URL
```

## License

MIT

## Support

For issues or questions:
- Check the browser console for detailed error logs
- Verify backend API is running and accessible
- Ensure camera/mic permissions are granted
