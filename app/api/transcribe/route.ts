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
    
    console.log('attempting to transcribe audio with model: openai/whisper-large-v3');
    
    // Convert the file to an array buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Get your Hugging Face API key from environment variables
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
    
    if (!HF_API_KEY) {
      console.error('HUGGING_FACE_API_KEY is not defined in environment variables');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }
    
    // Use the direct model endpoint instead of the router endpoint
    const response = await fetch(
      "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "audio/wav", // Adjust based on your audio format
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

    console.log('result', result)
    
    return NextResponse.json({ 
      text: result.text || '',
      language: result.language || '',
    });
    
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}