import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Database, FileText, Loader2, Plus, Trash2, Download, Edit2, Search } from "lucide-react";
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Comparison | null>(null);
  const [newItem, setNewItem] = useState({
    item_number: 0,
    category: "",
    comparison_item: "",
    salesforce_feature: "",
    servicenow_feature: "",
    source: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditingItem, setInlineEditingItem] = useState<Comparison | null>(null);
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
      let text = "";

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();

        // 동적으로 PDF.js 로드
        if (!(window as any).pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          await new Promise((resolve) => { script.onload = resolve; });
        }

        const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'] || (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }
        text = fullText;
      } else {
        text = await file.text();
      }

      // 텍스트 클리닝 및 파싱 로직
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.includes("|"));

      const items = [];
      for (const line of lines) {
        const parts = line.split("|").map(p => p.trim());
        const numMatch = parts[0].match(/^\d+/);

        if (numMatch && parts.length >= 5) {
          items.push({
            item_number: parseInt(numMatch[0], 10),
            category: parts[1] || "General",
            comparison_item: parts[2] || "",
            salesforce_feature: parts[3] || "",
            servicenow_feature: parts[4] || "",
            source: parts[5] || ""
          });
        }
      }

      if (items.length === 0) {
        throw new Error("유효한 비교 데이터를 찾을 수 없습니다. (번호|카테고리|... 형식 확인)");
      }

      // Supabase 직접 Upsert 실행
      let successCount = 0;
      for (const item of items) {
        const { error } = await supabase
          .from("comparisons")
          .upsert(item, { onConflict: "item_number" });
        if (!error) successCount++;
      }

      toast({
        title: "업로드 성공",
        description: `${successCount}개의 항목이 성공적으로 업데이트되었습니다.`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Upload error detail:", error);
      toast({
        variant: "destructive",
        title: "업로드 실패",
        description: error.message || "파일 처리 중 오류가 발생했습니다."
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleAddItem = async () => {
    try {
      if (!newItem.comparison_item) {
        toast({ variant: "destructive", title: "입력 오류", description: "비교 항목은 필수입니다." });
        return;
      }

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

  const handleEditClick = (item: Comparison) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from("comparisons")
        .update({
          item_number: editingItem.item_number,
          category: editingItem.category,
          comparison_item: editingItem.comparison_item,
          salesforce_feature: editingItem.salesforce_feature,
          servicenow_feature: editingItem.servicenow_feature,
          source: editingItem.source
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast({
        title: "수정 완료",
        description: `${editingItem.item_number}번 항목이 수정되었습니다.`
      });

      setIsEditDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "수정 실패",
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

  const handleInlineEditStart = (item: Comparison) => {
    setInlineEditingId(item.id);
    setInlineEditingItem({ ...item });
  };

  const handleInlineSave = async () => {
    if (!inlineEditingItem) return;

    try {
      const { error } = await supabase
        .from("comparisons")
        .update({
          item_number: inlineEditingItem.item_number,
          category: inlineEditingItem.category,
          comparison_item: inlineEditingItem.comparison_item,
          salesforce_feature: inlineEditingItem.salesforce_feature,
          servicenow_feature: inlineEditingItem.servicenow_feature,
          source: inlineEditingItem.source
        })
        .eq("id", inlineEditingItem.id);

      if (error) throw error;

      toast({
        title: "수정 완료",
        description: `${inlineEditingItem.item_number}번 항목이 수정되었습니다.`
      });

      setInlineEditingId(null);
      setInlineEditingItem(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: error.message
      });
    }
  };

  const handleInlineCancel = () => {
    setInlineEditingId(null);
    setInlineEditingItem(null);
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
                  <CardDescription>등록된 비교 항목을 검색하고 관리합니다</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="번호, 카테고리, 항목 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
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
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] w-full border rounded-md">
                    <div className="min-w-[1200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">번호</TableHead>
                            <TableHead className="w-[120px]">카테고리</TableHead>
                            <TableHead className="w-[150px]">비교항목</TableHead>
                            <TableHead className="min-w-[200px]">Salesforce특징</TableHead>
                            <TableHead className="min-w-[200px]">ServiceNow특징</TableHead>
                            <TableHead className="w-[120px]">출처</TableHead>
                            <TableHead className="w-[80px] text-right">작업</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparisons
                            .filter(item =>
                              item.item_number.toString().includes(searchQuery) ||
                              item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.comparison_item.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.salesforce_feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.servicenow_feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (item.source && item.source.toLowerCase().includes(searchQuery.toLowerCase()))
                            )
                            .map((item) => {
                              const isEditing = inlineEditingId === item.id;

                              if (isEditing && inlineEditingItem) {
                                return (
                                  <TableRow key={item.id} className="bg-blue-50/50">
                                    <TableCell className="p-2">
                                      <Input
                                        type="number"
                                        className="h-8"
                                        value={inlineEditingItem.item_number}
                                        onChange={e => setInlineEditingItem({ ...inlineEditingItem, item_number: parseInt(e.target.value) || 0 })}
                                      />
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Input
                                        className="h-8"
                                        value={inlineEditingItem.category}
                                        onChange={e => setInlineEditingItem({ ...inlineEditingItem, category: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Input
                                        className="h-8"
                                        value={inlineEditingItem.comparison_item}
                                        onChange={e => setInlineEditingItem({ ...inlineEditingItem, comparison_item: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Textarea
                                        className="text-xs min-h-[80px]"
                                        value={inlineEditingItem.salesforce_feature}
                                        onChange={e => setInlineEditingItem({ ...inlineEditingItem, salesforce_feature: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Textarea
                                        className="text-xs min-h-[80px]"
                                        value={inlineEditingItem.servicenow_feature}
                                        onChange={e => setInlineEditingItem({ ...inlineEditingItem, servicenow_feature: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Input
                                        className="h-8"
                                        value={inlineEditingItem.source || ""}
                                        onChange={e => setInlineEditingItem({ ...inlineEditingItem, source: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                      <Button size="sm" onClick={handleInlineSave} className="h-8">저장</Button>
                                      <Button size="sm" variant="ghost" onClick={handleInlineCancel} className="h-8">취소</Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              return (
                                <TableRow
                                  key={item.id}
                                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                                  onClick={() => handleInlineEditStart(item)}
                                >
                                  <TableCell className="font-medium">{item.item_number}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="font-normal text-[10px] truncate max-w-[110px]">
                                      {item.category}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-semibold text-sm truncate max-w-[150px]">
                                    {item.comparison_item}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground min-w-[250px] whitespace-pre-wrap py-3 leading-relaxed">
                                    {item.salesforce_feature}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground min-w-[250px] whitespace-pre-wrap py-3 leading-relaxed">
                                    {item.servicenow_feature}
                                  </TableCell>
                                  <TableCell className="text-xs truncate max-w-[120px]">
                                    {item.source}
                                  </TableCell>
                                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleInlineEditStart(item)}
                                      title="수정"
                                    >
                                      <Edit2 className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleDeleteItem(item.id, item.item_number)}
                                      title="삭제"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>비교 항목 수정</DialogTitle>
                  <DialogDescription>
                    {editingItem?.item_number}번 항목의 내용을 수정합니다
                  </DialogDescription>
                </DialogHeader>
                {editingItem && (
                  <div
                    className="grid gap-4 py-4"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleUpdateItem();
                      }
                    }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>번호</Label>
                        <Input
                          type="number"
                          value={editingItem.item_number}
                          onChange={(e) => setEditingItem({ ...editingItem, item_number: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>카테고리</Label>
                        <Input
                          value={editingItem.category}
                          onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>비교 항목</Label>
                      <Input
                        value={editingItem.comparison_item}
                        onChange={(e) => setEditingItem({ ...editingItem, comparison_item: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-blue-600 font-bold">Salesforce 특징</Label>
                        <Textarea
                          value={editingItem.salesforce_feature}
                          onChange={(e) => setEditingItem({ ...editingItem, salesforce_feature: e.target.value })}
                          rows={6}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-green-600 font-bold">ServiceNow 특징</Label>
                        <Textarea
                          value={editingItem.servicenow_feature}
                          onChange={(e) => setEditingItem({ ...editingItem, servicenow_feature: e.target.value })}
                          rows={6}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>출처</Label>
                      <Input
                        value={editingItem.source || ""}
                        onChange={(e) => setEditingItem({ ...editingItem, source: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={handleUpdateItem}>저장</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
