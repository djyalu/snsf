import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Database, FileText, Loader2, Plus, Trash2, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Comparison {
  id: string;
  item_number: number;
  category: string;
  comparison_item: string;
  salesforce_feature: string;
  servicenow_feature: string;
  source: string | null;
}

interface Stats {
  total: number;
  categories: { name: string; count: number }[];
}

const Admin = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, categories: [] });
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    item_number: 0,
    category: "",
    comparison_item: "",
    salesforce_feature: "",
    servicenow_feature: "",
    source: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("comparisons")
        .select("*")
        .order("item_number", { ascending: true });

      if (error) throw error;

      setComparisons(data || []);

      // Calculate stats
      const categories = data?.reduce((acc: Record<string, number>, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});

      setStats({
        total: data?.length || 0,
        categories: Object.entries(categories || {}).map(([name, count]) => ({
          name,
          count: count as number
        }))
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "데이터 로드 실패",
        description: "데이터를 불러오는 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('로그인이 필요합니다');
      }

      const response = await supabase.functions.invoke('parse-pdf', {
        body: formData,
      });

      if (response.error) {
        throw new Error(response.error.message || '업로드 실패');
      }

      const result = response.data;

      toast({
        title: "업로드 성공",
        description: result.message || `${result.inserted}개 추가, ${result.updated}개 업데이트됨`,
      });

      // Refresh data
      fetchData();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "업로드 실패",
        description: error.message || "파일 처리 중 오류가 발생했습니다."
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleAddItem = async () => {
    try {
      const { error } = await supabase
        .from("comparisons")
        .insert(newItem);

      if (error) throw error;

      toast({
        title: "항목 추가 완료",
        description: `${newItem.item_number}번 항목이 추가되었습니다.`
      });

      setIsAddDialogOpen(false);
      setNewItem({
        item_number: 0,
        category: "",
        comparison_item: "",
        salesforce_feature: "",
        servicenow_feature: "",
        source: ""
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "추가 실패",
        description: error.message
      });
    }
  };

  const handleDeleteItem = async (id: string, itemNumber: number) => {
    if (!confirm(`${itemNumber}번 항목을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from("comparisons")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "삭제 완료",
        description: `${itemNumber}번 항목이 삭제되었습니다.`
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message
      });
    }
  };

  const downloadTemplate = () => {
    const template = `# ServiceNow vs Salesforce 비교 데이터 템플릿
# 형식: 번호|카테고리|비교항목|Salesforce특징|ServiceNow특징|출처
# 예시:
101|Security|인증 방식|OAuth 2.0, SAML 지원|Multi-factor Authentication|SF Security Guide
102|Security|권한 관리|Profile 및 Permission Set 기반|Role 및 Group 기반|
`;
    const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparison_template.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <p className="text-muted-foreground">비교 데이터를 관리하고 업로드하세요</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 항목</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">등록된 비교 항목</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">카테고리</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.categories.length}</div>
              <p className="text-xs text-muted-foreground">분류된 카테고리</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">진행률</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round((stats.total / 1000) * 100)}%</div>
              <p className="text-xs text-muted-foreground">1000개 목표 대비</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upload">데이터 업로드</TabsTrigger>
            <TabsTrigger value="manage">데이터 관리</TabsTrigger>
            <TabsTrigger value="categories">카테고리 현황</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  데이터 업로드
                </CardTitle>
                <CardDescription>
                  텍스트 파일을 업로드하여 비교 데이터를 일괄 추가합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border-2 border-dashed p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="mt-4">
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-primary hover:underline">파일 선택</span>
                      <span className="text-muted-foreground"> 또는 드래그 앤 드롭</span>
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".txt,.csv,.pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    .txt, .csv 또는 .pdf 파일 (파이프 | 구분자 포함)
                  </p>
                </div>

                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>파일 처리 중...</span>
                  </div>
                )}

                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium">파일 형식 안내</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    각 줄은 파이프(|)로 구분된 6개 필드로 구성:
                  </p>
                  <code className="mt-2 block rounded bg-background p-2 text-xs">
                    번호|카테고리|비교항목|Salesforce특징|ServiceNow특징|출처
                  </code>
                  <Button variant="outline" size="sm" className="mt-3" onClick={downloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    템플릿 다운로드
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>데이터 관리</CardTitle>
                  <CardDescription>등록된 비교 항목을 관리합니다</CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      항목 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>새 비교 항목 추가</DialogTitle>
                      <DialogDescription>
                        ServiceNow와 Salesforce 비교 항목을 추가합니다
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>번호</Label>
                          <Input
                            type="number"
                            value={newItem.item_number || ""}
                            onChange={(e) => setNewItem({ ...newItem, item_number: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>카테고리</Label>
                          <Input
                            value={newItem.category}
                            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                            placeholder="예: Architecture & Infrastructure"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>비교 항목</Label>
                        <Input
                          value={newItem.comparison_item}
                          onChange={(e) => setNewItem({ ...newItem, comparison_item: e.target.value })}
                          placeholder="예: 코어 아키텍처"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Salesforce 특징</Label>
                        <Textarea
                          value={newItem.salesforce_feature}
                          onChange={(e) => setNewItem({ ...newItem, salesforce_feature: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>ServiceNow 특징</Label>
                        <Textarea
                          value={newItem.servicenow_feature}
                          onChange={(e) => setNewItem({ ...newItem, servicenow_feature: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>출처</Label>
                        <Input
                          value={newItem.source}
                          onChange={(e) => setNewItem({ ...newItem, source: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        취소
                      </Button>
                      <Button onClick={handleAddItem}>추가</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">번호</TableHead>
                          <TableHead className="w-[150px]">카테고리</TableHead>
                          <TableHead>비교 항목</TableHead>
                          <TableHead className="w-[80px]">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisons.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.item_number}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.comparison_item}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id, item.item_number)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>카테고리별 현황</CardTitle>
                <CardDescription>카테고리별 항목 수를 확인합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.categories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{cat.name}</span>
                      <Badge>{cat.count}개</Badge>
                    </div>
                  ))}
                  {stats.categories.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      등록된 데이터가 없습니다
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;
