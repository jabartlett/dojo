import { NextRequest, NextResponse } from 'next/server';
import { checkChatLimit } from '@/lib/rateLimit';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { message, chatHistory, sessionId = 'default' } = await req.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    console.log('message', message, 'chatHistory', chatHistory);
    
    // Check rate limit
    if (!checkChatLimit(sessionId)) {
      return NextResponse.json({
        response: "You've already used your chat quota. You only get one test of the AI because I am poor.",
        limitExceeded: true
      }, { status: 200 }); // Using 200 so client handles it gracefully
    }
    
    // Format messages for the model
    const formattedMessages = chatHistory ? [...chatHistory] : [];
    
    // Avoid duplicating the last message
    if (formattedMessages.length === 0 || 
        formattedMessages[formattedMessages.length - 1].content !== message) {
      formattedMessages.push({ role: 'user', content: message });
    }
    
    // Get your Hugging Face API key from environment variables
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    
    // Call the Hugging Face API for chat
    const response = await fetch(
      'https://api-inference.huggingface.co/models/microsoft/phi-3-mini-4k-instruct',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            messages: formattedMessages
          }
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    // Extract generated text from response
    const generatedText = result.generated_text || result[0]?.generated_text || '';
    
    // Return the generated text
    return NextResponse.json({
      response: generatedText,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'microsoft/phi-3-mini-4k-instruct'
      }
    });
  } catch (error) {
    console.error('Text generation API error:', error);
    return NextResponse.json({
      error: String(error),
      response: "I'm sorry, I'm having trouble processing your request right now."
    }, { status: 500 });
  }
}