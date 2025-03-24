import { NextRequest, NextResponse } from 'next/server';
import { checkTranscriptionLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  console.log('trying to transcribe audio');
  
  try {
    // Get the session ID from the request headers or query params
    const sessionId = req.headers.get('x-session-id') || req.nextUrl.searchParams.get('sessionId') || 'default';
    
    // Check rate limit
    if (!checkTranscriptionLimit(sessionId)) {
      return NextResponse.json({ 
        text: "You've already used your transcription quota. You only get one test because I am poor.",
        limitExceeded: true
      }, { status: 200 }); // Using 200 so client handles it gracefully
    }
    
    // Get the audio file from the form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    
    // Convert the file to an array buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Get your Hugging Face API key from environment variables
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    
    // Call the Hugging Face API for transcription
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'audio/webm',
        },
        body: audioBuffer,
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    
    return NextResponse.json({ 
      text: result.text || '',
      language: result.language || 'en',
    });
    
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ 
      error: String(error),
      message: "Failed to transcribe audio. Please try again."
    }, { status: 500 });
  }
}