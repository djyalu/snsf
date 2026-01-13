import { useState } from "react";
import { Comparison } from "@/pages/Index";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Info } from "lucide-react";

interface ComparisonTableProps {
  comparisons: Comparison[];
}

const ComparisonTable = ({ comparisons }: ComparisonTableProps) => {
  const [selectedItem, setSelectedItem] = useState<Comparison | null>(null);

  if (comparisons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Info className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">검색 결과가 없습니다</h3>
        <p className="text-muted-foreground">
          다른 검색어나 카테고리를 시도해보세요
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">번호</TableHead>
              <TableHead className="w-[150px]">카테고리</TableHead>
              <TableHead className="w-[200px]">비교 항목</TableHead>
              <TableHead className="bg-salesforce-light">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-salesforce"></div>
                  Salesforce
                </div>
              </TableHead>
              <TableHead className="bg-servicenow-light">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-servicenow"></div>
                  ServiceNow
                </div>
              </TableHead>
              <TableHead className="w-[80px]">상세</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((comparison) => (
              <TableRow key={comparison.id}>
                <TableCell className="font-medium">
                  {comparison.item_number}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {comparison.category}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {comparison.comparison_item}
                </TableCell>
                <TableCell className="max-w-[300px] bg-salesforce-light/50">
                  <p className="line-clamp-2 text-sm">
                    {comparison.salesforce_feature}
                  </p>
                </TableCell>
                <TableCell className="max-w-[300px] bg-servicenow-light/50">
                  <p className="line-clamp-2 text-sm">
                    {comparison.servicenow_feature}
                  </p>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItem(comparison)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedItem?.category}</Badge>
              <span className="text-sm text-muted-foreground">
                #{selectedItem?.item_number}
              </span>
            </div>
            <DialogTitle className="text-xl">
              {selectedItem?.comparison_item}
            </DialogTitle>
            <DialogDescription>상세 비교 내용</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-salesforce-light p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-salesforce"></div>
                <h4 className="font-semibold">Salesforce</h4>
              </div>
              <p className="text-sm leading-relaxed">
                {selectedItem?.salesforce_feature}
              </p>
            </div>
            <div className="rounded-lg border bg-servicenow-light p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-servicenow"></div>
                <h4 className="font-semibold">ServiceNow</h4>
              </div>
              <p className="text-sm leading-relaxed">
                {selectedItem?.servicenow_feature}
              </p>
            </div>
          </div>

          {selectedItem?.source && (
            <div className="mt-4 rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">출처:</span> {selectedItem.source}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ComparisonTable;
