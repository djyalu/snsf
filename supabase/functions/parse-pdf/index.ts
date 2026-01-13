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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleData?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return new Response(JSON.stringify({ error: 'No file' }), { status: 400, headers: corsHeaders });

    console.log(`[FORCE_UPDATE_v3] Processing: ${file.name}`);

    let text = '';
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdfData = await pdf(uint8Array);
      text = pdfData.text;
    } else {
      text = await file.text();
    }

    // 강력한 텍스트 정화: 깨진 바이너리 문자 완전히 제거
    text = text.replace(/[^\x20-\x7E\s\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g, "");

    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.includes('|'));
    const items: ComparisonItem[] = [];
    const parseErrors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split('|').map(p => p.trim());

      // 첫 번째 컬럼이 숫자로만 시작하는지 엄격하게 검사
      const numStr = parts[0].replace(/[^0-9]/g, '');
      if (!numStr || parts[0].length > 10) continue; // 숫자가 아니거나 너무 길면 노이즈로 간주

      const itemNumber = parseInt(numStr, 10);
      if (parts.length >= 5) {
        items.push({
          item_number: itemNumber,
          category: parts[1] || 'General',
          comparison_item: parts[2] || '',
          salesforce_feature: parts[3] || '',
          servicenow_feature: parts[4] || '',
          source: (parts[5] || '').substring(0, 200)
        });
      } else {
        parseErrors.push(`[줄 ${i + 1}] 데이터 부족 (컬럼 5개 필요)`);
      }
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({
        error: '유효한 비교 데이터를 찾을 수 없습니다.',
        details: parseErrors.slice(0, 5),
        hint: '파일 내에 "번호|카테고리|항목|SF특징|SN특징" 형식이 포함되어야 합니다.'
      }), { status: 400, headers: corsHeaders });
    }

    // Upsert 로직
    let inserted = 0;
    let updated = 0;
    for (const item of items) {
      const { data: existing } = await supabase.from('comparisons').select('id').eq('item_number', item.item_number).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('comparisons').update(item).eq('item_number', item.item_number);
        if (!error) updated++;
      } else {
        const { error } = await supabase.from('comparisons').insert(item);
        if (!error) inserted++;
      }
    }

    return new Response(JSON.stringify({ success: true, inserted, updated, total: items.length }), { headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
