import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Database } from "lucide-react";

const Admin = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <p className="text-muted-foreground">비교 데이터를 관리하고 업로드하세요</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                데이터 업로드
              </CardTitle>
              <CardDescription>PDF 파일에서 비교 데이터를 추출합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled>
                <Upload className="mr-2 h-4 w-4" />
                PDF 업로드 (준비 중)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                데이터 현황
              </CardTitle>
              <CardDescription>등록된 비교 항목을 관리합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">데이터 관리 기능이 곧 추가됩니다</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;
