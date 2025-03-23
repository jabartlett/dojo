import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  console.log('trying to transcribe audio');
  try {
    // Get the form data from the request
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    // Optional parameters
    const model = formData.get('model') as string || 'openai/whisper-large-v3';
    const returnTimestamps = formData.get('returnTimestamps') === 'true';
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert the audio file to an ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('attempting to transcribe audio with model:', model);
    console.log('returnTimestamps:', returnTimestamps);
    
    // Construct the API URL with parameters
    const url = new URL('https://router.huggingface.co/hf-inference/v1/speech-recognition');
    url.searchParams.append('model', model);
    if (returnTimestamps) {
      url.searchParams.append('return_timestamps', 'true');
    }
    
    // Call Hugging Face Inference API for transcription
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    console.log('result', result)
    
    // Return the transcription
    return NextResponse.json({
      text: result.text,
      chunks: result.chunks || [],
      model: model
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ 
      error: 'Failed to transcribe audio',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}