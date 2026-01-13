import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import ComparisonTable from "@/components/comparison/ComparisonTable";
import CategoryFilter from "@/components/comparison/CategoryFilter";
import SearchBar from "@/components/comparison/SearchBar";
import AIAssistant from "@/components/ai/AIAssistant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2, Search, Bot, BarChart3 } from "lucide-react";

export interface Comparison {
  id: string;
  item_number: number;
  category: string;
  comparison_item: string;
  salesforce_feature: string;
  servicenow_feature: string;
  source: string | null;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [filteredComparisons, setFilteredComparisons] = useState<Comparison[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchComparisons();
    }
  }, [user]);

  useEffect(() => {
    filterComparisons();
  }, [comparisons, selectedCategory, searchQuery]);

  const fetchComparisons = async () => {
    try {
      const { data, error } = await supabase
        .from("comparisons")
        .select("*")
        .order("item_number", { ascending: true });

      if (error) throw error;

      setComparisons(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map((c) => c.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching comparisons:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterComparisons = () => {
    let filtered = [...comparisons];

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.comparison_item.toLowerCase().includes(query) ||
          c.salesforce_feature.toLowerCase().includes(query) ||
          c.servicenow_feature.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query)
      );
    }

    setFilteredComparisons(filtered);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Hero Section */}
        <div className="rounded-lg bg-gradient-to-r from-salesforce/10 via-background to-servicenow/10 p-4 sm:p-8">
          <div className="text-center">
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              ServiceNow vs Salesforce
            </h1>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              1000개 항목에 대한 상세 비교 분석 자료를 검색하고 AI로 분석하세요
            </p>
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-salesforce"></div>
                <span className="text-xs sm:text-sm font-medium">Salesforce</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-servicenow"></div>
                <span className="text-xs sm:text-sm font-medium">ServiceNow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">전체 항목</CardTitle>
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{comparisons.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">등록된 비교 항목 수</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">카테고리</CardTitle>
              <Search className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{categories.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">분류된 카테고리 수</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">검색 결과</CardTitle>
              <Search className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{filteredComparisons.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">현재 필터링된 항목</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="search" className="space-y-3 sm:space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="search" className="gap-1.5 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              검색
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              AI 분석
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">비교 항목 검색</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  카테고리 필터와 키워드 검색으로 원하는 비교 항목을 찾아보세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} />
                  <CategoryFilter
                    categories={categories}
                    selected={selectedCategory}
                    onSelect={setSelectedCategory}
                  />
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ComparisonTable comparisons={filteredComparisons} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-3 sm:space-y-4">
            <AIAssistant comparisons={comparisons} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Index;
