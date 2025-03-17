import { NextRequest, NextResponse } from 'next/server';
import { pipeline } from '@xenova/transformers';

// Store the model instance (singleton pattern)
let model: any = null;
let modelInitializing = false;
const modelInitPromise: Promise<any> | null = null;

async function initializeModel() {
  if (model) return model;
  
  if (modelInitPromise) return modelInitPromise;
  
  if (modelInitializing) {
    // Wait for the model to initialize
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (model) {
          clearInterval(checkInterval);
          resolve(model);
        }
      }, 100);
    });
  }
  
  modelInitializing = true;
  
  try {
    // Use a smaller model suitable for chat applications
    // You can replace with other Hugging Face models as needed
    model = await pipeline('text-generation', 'Xenova/distilgpt2');
    console.log('Text generation model loaded successfully');
    return model;
  } catch (error) {
    console.error('Failed to load text generation model:', error);
    modelInitializing = false;
    throw new Error('Failed to initialize text generation model');
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { message, chatHistory } = await req.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Initialize model if not already done
    const generator = await initializeModel();
    
    // Build prompt from chat history and current message
    let prompt = '';
    
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.slice(-5).forEach(entry => {
        if (entry.role === 'user') {
          prompt += `User: ${entry.content}\n`;
        } else if (entry.role === 'assistant') {
          prompt += `Assistant: ${entry.content}\n`;
        }
      });
    }
    
    // Add the current message to the prompt
    prompt += `User: ${message}\nAssistant:`;

    // Generate response with reasonable parameters
    const result = await generator(prompt, {
      max_new_tokens: 128,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
      num_return_sequences: 1
    });

    // Extract generated text and clean it up
    let generatedText = result[0].generated_text;
    
    // Extract only the assistant's response
    const assistantResponse = generatedText.split('Assistant:').pop()?.trim();
    
    // Handle potential empty responses
    const response = assistantResponse || "I'm sorry, I couldn't generate a proper response.";

    return NextResponse.json({ 
      response,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'distilgpt2'
      }
    });
    
  } catch (error) {
    console.error('Text generation API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process message',
      response: "I'm sorry, I'm having trouble processing your request right now."
    }, { status: 500 });
  }
}