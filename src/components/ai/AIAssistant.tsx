import { useState } from "react";
import { Comparison } from "@/pages/Index";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2 } from "lucide-react";

interface AIAssistantProps {
  comparisons: Comparison[];
}

const AIAssistant = ({ comparisons }: AIAssistantProps) => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setResponse("AI 기능을 사용하려면 Google AI API 키를 설정해야 합니다. 관리자에게 문의하세요.");
    setIsLoading(false);
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
          <div className="rounded-lg border bg-muted p-4">
            <p className="text-sm">{response}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIAssistant;
