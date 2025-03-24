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
    
    // Format messages for the model - using the proper format for Hugging Face API
    const formattedMessages = chatHistory ? [...chatHistory] : [];
    formattedMessages.push({ role: 'user', content: message });
    
    console.log('formatted messages', formattedMessages);
    
    // Use direct fetch to Hugging Face API
    const response = await fetch(
      "https://router.huggingface.co/nebius/v1/chat/completions",
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          "model": "microsoft/phi-4",
          "messages": formattedMessages, // Use the formatted messages directly
          "max_tokens": 500,
          "stream": false
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('API response:', result);
    
    // Extract generated text from response
    const generatedText = result.choices[0].message.content;
    
    console.log('generatedText', generatedText);
    
    // Return the generated text
    return NextResponse.json({
      response: generatedText,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'microsoft/phi-4'
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