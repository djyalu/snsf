import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: pdf-parse is an npm package
import pdf from "npm:pdf-parse/lib/pdf-parse.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComparisonItem {
  item_number: number;
  category: string;
  comparison_item: string;
  salesforce_feature: string;
  servicenow_feature: string;
  source: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data with PDF file
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    let text = '';
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      console.log('Detected PDF file, extracting text...');
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      try {
        const data = await pdf(uint8Array);
        text = data.text;
        console.log(`Successfully extracted ${text.length} characters from PDF`);
      } catch (pdfError) {
        console.error('PDF extraction error:', pdfError);
        throw new Error(`PDF 파싱 실패: ${pdfError.message}`);
      }
    } else {
      text = await file.text();
    }

    // 텍스트 클리닝: 비정상적인 바이너리 문자 및 제어 문자 제거
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

    console.log(`Extracted text preview (first 200 chars): ${text.substring(0, 200)}`);

    // Parse the data - handle different line endings and trim each line
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const items: ComparisonItem[] = [];
    const parseErrors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 주석이거나 파이프가 아예 없는 줄은 무시 (노이즈 방지)
      if (!line || line.startsWith('#') || !line.includes('|')) continue;

      const parts = line.split('|').map(p => p.trim());

      // 첫 번째 파트가 숫자로 시작하는지 확인 (기본적인 유효성 검사)
      const itemNumberMatch = parts[0].match(/^\d+/);
      if (!itemNumberMatch) {
        // 노이즈가 심한 줄은 무시하고, 형식이 명확히 틀린 줄만 에러 기록
        if (parts[0].length < 50 && !/[\uFFFD]/.test(parts[0])) {
          parseErrors.push(`Line ${i + 1}: 항목 번호는 숫자로 시작해야 합니다 (값: "${parts[0].substring(0, 20)}")`);
        }
        continue;
      }

      const itemNumber = parseInt(itemNumberMatch[0], 10);

      if (parts.length >= 5) {
        items.push({
          item_number: itemNumber,
          category: parts[1] || 'General',
          comparison_item: parts[2] || '',
          salesforce_feature: parts[3] || '',
          servicenow_feature: parts[4] || '',
          source: parts[5] || ''
        });
      } else if (parts.length > 1) {
        parseErrors.push(`Line ${i + 1}: 필드 부족 (예상: 5-6, 실제: ${parts.length})`);
      }
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          error: '파일에서 유효한 데이터를 찾을 수 없습니다.',
          details: parseErrors.slice(0, 10),
          hint: '기대 형식: 번호|카테고리|비교항목|Salesforce특징|ServiceNow특징|출처'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsed ${items.length} items from file`);

    // Insert items into database (upsert to handle duplicates)
    let inserted = 0;
    let updated = 0;
    const insertErrors: string[] = [];

    for (const item of items) {
      // Check if item exists
      const { data: existing } = await supabase
        .from('comparisons')
        .select('id')
        .eq('item_number', item.item_number)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('comparisons')
          .update({
            category: item.category,
            comparison_item: item.comparison_item,
            salesforce_feature: item.salesforce_feature,
            servicenow_feature: item.servicenow_feature,
            source: item.source
          })
          .eq('item_number', item.item_number);

        if (updateError) {
          insertErrors.push(`Item ${item.item_number}: ${updateError.message}`);
        } else {
          updated++;
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('comparisons')
          .insert(item);

        if (insertError) {
          insertErrors.push(`Item ${item.item_number}: ${insertError.message}`);
        } else {
          inserted++;
        }
      }
    }

    console.log(`Completed: ${inserted} inserted, ${updated} updated, ${insertErrors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `처리 완료: ${inserted}개 추가, ${updated}개 업데이트`,
        inserted,
        updated,
        total: items.length,
        parseErrors: parseErrors.slice(0, 10),
        insertErrors: insertErrors.slice(0, 10)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const errorMessage = error.message || 'Internal server error';
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
