import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('trying to transcribe audio');
  
  try {
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
    
    if (!HF_API_KEY) {
      console.error('HUGGING_FACE_API_KEY is not defined in environment variables');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }
    
    // Use a free model instead of whisper-large-v3
    console.log('attempting to transcribe audio with model: facebook/wav2vec2-base-960h');
    
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/wav2vec2-base-960h",
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "audio/wav",
        },
        method: "POST",
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
      language: 'en', // This model only supports English
    });
    
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ 
      error: String(error),
      message: "Failed to transcribe audio. Please try again."
    }, { status: 500 });
  }
}