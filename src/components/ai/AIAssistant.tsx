import { useState } from "react";
import { Comparison } from "@/pages/Index";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface AIAssistantProps {
  comparisons: Comparison[];
}

const AIAssistant = ({ comparisons }: AIAssistantProps) => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke('ai-analyze', {
        body: { query, comparisons }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResponse(data.response);
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast({
        variant: "destructive",
        title: "AI 분석 실패",
        description: error.message || "잠시 후 다시 시도해주세요.",
      });
      setResponse("AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI 분석 도우미
        </CardTitle>
        <CardDescription>
          자연어로 질문하면 등록된 {comparisons.length}개의 비교 데이터를 기반으로 답변합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="예: ServiceNow가 보안 측면에서 Salesforce보다 유리한 점은?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
        />
        <Button onClick={handleSubmit} disabled={isLoading || !query.trim()}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          분석 요청
        </Button>
        
        {response && (
          <div className="rounded-lg border bg-muted p-6 overflow-auto max-h-[600px]">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground border-b pb-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1 text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="my-2 text-sm text-foreground leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-foreground">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                  code: ({ children }) => <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 my-2 italic text-muted-foreground">{children}</blockquote>,
                }}
              >
                {response}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIAssistant;
