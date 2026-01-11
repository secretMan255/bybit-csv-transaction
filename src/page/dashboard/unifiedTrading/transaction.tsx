import type { ParsedRow } from ".";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";

interface Props {
  headers: string[];
  parsedRows: ParsedRow[];
}

export default function Transaction({ headers, parsedRows }: Props) {
  const columns: ColumnDef<ParsedRow>[] = headers.map((h) => ({
    id: h,
    header: h,
    accessorFn: (row) => row.raw?.[h] ?? "",
    cell: ({ getValue }) => {
      const v = String(getValue() ?? "");
      return <span className="whitespace-nowrap">{v}</span>;
    },
  }));

  return (
    <div className="flex w-full">
      <DataTable columns={columns} data={parsedRows} />
    </div>
  );
}
