import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log(`Processing PDF: ${file.name}, size: ${file.size} bytes`);

    // Read file as text (for now, expect a structured text/CSV format)
    // In production, you would use a PDF parsing library
    const text = await file.text();
    
    // Parse the data - expecting a specific format
    // Format: Each line is: number|category|comparison_item|salesforce|servicenow|source
    const lines = text.split('\n').filter(line => line.trim());
    const items: ComparisonItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue; // Skip empty lines and comments

      const parts = line.split('|').map(p => p.trim());
      
      if (parts.length >= 5) {
        const itemNumber = parseInt(parts[0], 10);
        
        if (isNaN(itemNumber)) {
          errors.push(`Line ${i + 1}: Invalid item number "${parts[0]}"`);
          continue;
        }

        items.push({
          item_number: itemNumber,
          category: parts[1] || 'General',
          comparison_item: parts[2] || '',
          salesforce_feature: parts[3] || '',
          servicenow_feature: parts[4] || '',
          source: parts[5] || ''
        });
      } else if (parts.length > 1) {
        errors.push(`Line ${i + 1}: Not enough fields (expected 5-6, got ${parts.length})`);
      }
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No valid items found in file',
          details: errors.slice(0, 10),
          hint: 'Expected format: number|category|comparison_item|salesforce_feature|servicenow_feature|source'
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
        parseErrors: errors.slice(0, 10),
        insertErrors: insertErrors.slice(0, 10)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
