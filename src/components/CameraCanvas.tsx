/**
 * Camera + Canvas component with YOLOv11n object detection
 * Handles model loading, inference loop, and frame capture for VQA
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

interface CameraCanvasProps {
  modelPath?: string;
  onModelLoaded?: () => void;
  onDetections?: (detections: Detection[]) => void;
  onError?: (error: string) => void;
}

export const CameraCanvas = ({
  modelPath = '/models/yolo11n/model.json',
  onModelLoaded,
  onDetections,
  onError,
}: CameraCanvasProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);

  const modelRef = useRef<tf.GraphModel | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionTime = useRef<number>(0);

  // Model configuration
  const MODEL_INPUT_SIZE = 416; // Your model's input size
  const NUM_CLASSES = 20; // Your model has 20 classes (24 total outputs - 4 bbox coords)

  // Your custom class names from data.yaml
  const classNames = [
    'table', 'chair', 'occupied chair', 'unoccupied chair', 'screen',
    'laptop', 'bottle', 'book', 'person', 'shelf',
    'plate', 'refrigerator', 'closed door', 'opened door', 'stairs',
    'window', 'noticeboard flyer', 'trashbin', 'phone', 'backpack'
  ];

  /**
   * Initialize TensorFlow.js backend
   */
  useEffect(() => {
    const initTF = async () => {
      try {
        await tf.ready();
        await tf.setBackend('webgl');
        console.log('✅ TensorFlow.js backend initialized:', tf.getBackend());
      } catch (error) {
        console.error('❌ TF.js initialization error:', error);
        onError?.('Failed to initialize TensorFlow.js');
      }
    };
    initTF();
  }, [onError]);

  /**
   * Load YOLO model
   */
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log('📦 Loading YOLO model from:', modelPath);
        const model = await tf.loadGraphModel(modelPath);
        modelRef.current = model;
        
        // Log model info
        console.log('Model inputs:', model.inputs);
        console.log('Model outputs:', model.outputs);
        
        setIsModelLoaded(true);
        onModelLoaded?.();
        console.log('✅ YOLO model loaded successfully');
      } catch (error) {
        console.error('❌ Model loading error:', error);
        onError?.('Failed to load YOLO model. Please check if model files exist at ' + modelPath);
      }
    };

    loadModel();

    return () => {
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, [modelPath, onModelLoaded, onError]);

  /**
   * Initialize camera stream
   */
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment',
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsStreaming(true);
            console.log('✅ Camera stream started');
          };
        }
      } catch (error) {
        console.error('❌ Camera access error:', error);
        onError?.('Camera access denied. Please enable camera permissions.');
      }
    };

    initCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onError]);

  /**
   * Non-Maximum Suppression (NMS)
   */
  const applyNMS = (boxes: Detection[], iouThreshold = 0.5): Detection[] => {
    boxes.sort((a, b) => b.score - a.score);
    const selected: Detection[] = [];
    
    while (boxes.length > 0) {
      const current = boxes.shift()!;
      selected.push(current);
      
      boxes = boxes.filter((box) => {
        const iou = calculateIOU(current.bbox, box.bbox);
        return iou < iouThreshold;
      });
    }
    
    return selected;
  };

  /**
   * Calculate Intersection over Union
   */
  const calculateIOU = (
    boxA: [number, number, number, number],
    boxB: [number, number, number, number]
  ): number => {
    const [x1A, y1A, wA, hA] = boxA;
    const [x1B, y1B, wB, hB] = boxB;
    
    const x2A = x1A + wA;
    const y2A = y1A + hA;
    const x2B = x1B + wB;
    const y2B = y1B + hB;
    
    const xA = Math.max(x1A, x1B);
    const yA = Math.max(y1A, y1B);
    const xB = Math.min(x2A, x2B);
    const yB = Math.min(y2A, y2B);
    
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = wA * hA;
    const boxBArea = wB * hB;
    
    return interArea / (boxAArea + boxBArea - interArea);
  };

  /**
   * Run detection on current frame
   */
  const runDetection = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !canvasRef.current || !isStreaming) {
      return;
    }

    const now = performance.now();
    // Throttle to ~15 FPS for performance
    if (now - lastDetectionTime.current < 66) {
      animationFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }
    lastDetectionTime.current = now;

    try {
      await tf.tidy(() => {
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        
        // Set canvas size to match video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Prepare input tensor (416x416 for your model)
        let inputTensor = tf.browser.fromPixels(video);
        inputTensor = tf.image.resizeBilinear(inputTensor, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
        inputTensor = tf.cast(inputTensor, 'float32');
        inputTensor = tf.div(inputTensor, 255.0);
        inputTensor = tf.expandDims(inputTensor, 0);

        // Run inference
        let predictions = modelRef.current!.predict(inputTensor) as tf.Tensor;
        
        // CRITICAL: Transpose from [1, 24, 3549] to [1, 3549, 24]
        predictions = tf.transpose(predictions, [0, 2, 1]);
        
        const predictionsArray = predictions.arraySync() as number[][][];

        // Process detections
        const detections: Detection[] = [];
        const threshold = 0.5;

        // Your model output format: [batch, num_predictions, 24]
        // 24 = 4 bbox coords + 20 class scores
        const outputs = predictionsArray[0];
        
        for (const output of outputs) {
          // Get class scores (indices 4-23)
          const classScores = output.slice(4, 4 + NUM_CLASSES);
          const maxScore = Math.max(...classScores);
          
          if (maxScore < threshold) continue;
          
          const classIndex = classScores.indexOf(maxScore);

          // Convert from YOLO format (center_x, center_y, width, height) to (x, y, width, height)
          // YOLO outputs are normalized [0, 1]
          const [cx, cy, w, h] = output.slice(0, 4);
          
          const x = (cx - w / 2) * video.videoWidth;
          const y = (cy - h / 2) * video.videoHeight;
          const width = w * video.videoWidth;
          const height = h * video.videoHeight;

          detections.push({
            bbox: [x, y, width, height],
            class: classNames[classIndex] || `class_${classIndex}`,
            score: maxScore,
          });
        }

        // Apply NMS
        const finalDetections = applyNMS(detections, 0.5);
        setDetectionCount(finalDetections.length);
        onDetections?.(finalDetections);

        // Draw detections
        finalDetections.forEach((detection) => {
          const [x, y, w, h] = detection.bbox;
          
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);

          ctx.fillStyle = '#00ff00';
          ctx.fillRect(x, y - 25, Math.max(w, 100), 25);

          ctx.fillStyle = 'white';
          ctx.font = '14px sans-serif';
          ctx.fillText(
            `${detection.class} ${(detection.score * 100).toFixed(0)}%`,
            x + 5,
            y - 8
          );
        });
      });
    } catch (error) {
      console.error('❌ Detection error:', error);
      console.error('Error details:', error);
    }

    animationFrameRef.current = requestAnimationFrame(runDetection);
  }, [isStreaming, onDetections]);

  /**
   * Start detection loop when model and stream are ready
   */
  useEffect(() => {
    if (isModelLoaded && isStreaming) {
      runDetection();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isModelLoaded, isStreaming, runDetection]);

  /**
   * Capture current frame for VQA
   */
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !isStreaming) {
      return null;
    }

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const canvas = offscreenCanvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [isStreaming]);

  useEffect(() => {
    if (videoRef.current) {
      (videoRef.current as any).captureFrame = captureFrame;
    }
  }, [captureFrame]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      
      {!isStreaming && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p>Initializing camera...</p>
          </div>
        </div>
      )}

      {isStreaming && !isModelLoaded && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-white">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            <span>Loading AI model...</span>
          </div>
        </div>
      )}

      {isStreaming && isModelLoaded && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-white">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium">{detectionCount} objects detected</span>
          </div>
        </div>
      )}
    </div>
  );
};