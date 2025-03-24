import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { message, chatHistory } = await req.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    console.log('message', message, 'chatHistory', chatHistory);
    
    // Format messages for the model
    const formattedMessages = chatHistory ? [...chatHistory] : [];
    
    // Avoid duplicating the last message
    if (formattedMessages.length === 0 || 
        formattedMessages[formattedMessages.length - 1].content !== message) {
      formattedMessages.push({ role: 'user', content: message });
    }
    
    console.log('formatted messages', formattedMessages);
    
    // Prepare conversation history in a format suitable for text generation
    let prompt = "";
    for (const msg of formattedMessages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      prompt += `${role}: ${msg.content}\n`;
    }
    prompt += `Assistant:`;
    
    // Use a free model instead of phi-4
    const response = await fetch(
      "https://api-inference.huggingface.co/models/TinyLlama/TinyLlama-1.1B-Chat-v1.0",
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            return_full_text: false
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
    const generatedText = Array.isArray(result) ? result[0].generated_text : result.generated_text;
    
    // Return the generated text
    return NextResponse.json({
      response: generatedText,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0'
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