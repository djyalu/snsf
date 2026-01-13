import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

const CategoryFilter = ({ categories, selected, onSelect }: CategoryFilterProps) => {
  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="w-full md:w-[250px]">
        <SelectValue placeholder="카테고리 선택" />
      </SelectTrigger>
      <SelectContent className="bg-popover">
        <SelectItem value="all">전체 카테고리</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CategoryFilter;
