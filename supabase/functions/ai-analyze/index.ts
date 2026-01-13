import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, comparisons } = await req.json();

    if (!query) {
      throw new Error('Query is required');
    }

    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }

    console.log(`Processing AI query: ${query.substring(0, 100)}...`);
    console.log(`Comparisons count: ${comparisons?.length || 0}`);

    // Build context from comparisons data
    const contextData = comparisons?.slice(0, 100).map((c: any) => 
      `[${c.item_number}] ${c.category} - ${c.comparison_item}: Salesforce(${c.salesforce_feature}) vs ServiceNow(${c.servicenow_feature})`
    ).join('\n') || '';

    const systemPrompt = `당신은 Salesforce와 ServiceNow 비교 분석 전문가입니다. 
사용자의 질문에 대해 제공된 비교 데이터를 기반으로 정확하고 유용한 답변을 제공하세요.
답변은 한국어로 작성하고, 구체적인 데이터를 인용하여 설명해주세요.
비교 데이터가 없는 경우에도 일반적인 지식을 바탕으로 도움이 되는 답변을 제공하세요.

현재 비교 데이터:
${contextData}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt },
                { text: `사용자 질문: ${query}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google AI API error:', JSON.stringify(errorData));
      
      if (response.status === 429) {
        throw new Error('API 요청 한도 초과입니다. 30초 후 다시 시도해주세요.');
      }
      throw new Error(`Google AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Google AI response received');

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      '응답을 생성하지 못했습니다. 다시 시도해주세요.';

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-analyze function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
