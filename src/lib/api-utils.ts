/**
 * API utilities for backend communication
 * Handles token fetching and VQA requests
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface SpeechToken {
  token: string;
  region: string;
}

export interface VQARequest {
  imageBase64: string;
  question: string;
}

export interface VQAResponse {
  answer: string;
}

/**
 * Fetch a short-lived Azure Speech SDK token from backend
 * This token should be refreshed periodically (typically every 9 minutes)
 */
export async function fetchSpeechToken(): Promise<SpeechToken> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/speech-token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.token || !data.region) {
      throw new Error('Invalid token response from server');
    }

    console.log('✅ Speech token fetched successfully');
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch speech token:', error);
    throw new Error('Could not fetch speech token. Please check your connection.');
  }
}

/**
 * Send VQA request to backend with captured image and question
 */
export async function sendVQARequest({ imageBase64, question }: VQARequest): Promise<VQAResponse> {
  try {
    console.log('📤 Sending VQA request...', { 
      questionLength: question.length, 
      imageSize: imageBase64.length 
    });

    const response = await fetch(`${API_BASE_URL}/api/vqa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64, question }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 500) {
        throw new Error('Server error processing your question. Please try again.');
      }
      throw new Error(`VQA request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.answer) {
      throw new Error('Invalid response from VQA server');
    }

    console.log('✅ VQA response received');
    return data;
  } catch (error) {
    console.error('❌ VQA request failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get answer. Please try again.');
  }
}
