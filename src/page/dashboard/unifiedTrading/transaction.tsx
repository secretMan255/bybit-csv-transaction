import type { ParsedRow } from ".";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { SortableHeader } from "@/components/data-table-sort";

interface Props {
  parsedRows: ParsedRow[];
}

function toNumber(v: unknown): number {
  const s = String(v ?? "")
    .replace(/,/g, "")
    .trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function toTime(v: unknown): number {
  const s = String(v ?? "").trim();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Number.NaN;
}

export default function Transaction({ parsedRows }: Props) {
  const columns: ColumnDef<ParsedRow>[] = [
    {
      id: "Uid",
      accessorFn: (row) => row.raw["Uid"] ?? "",
      header: ({ column }) => <SortableHeader column={column} title="Uid" />,
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      id: "Currency",
      accessorFn: (row) => row.raw["Currency"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Currency" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      id: "Type",
      accessorFn: (row) => row.raw["Type"] ?? row.category ?? "",
      header: ({ column }) => <SortableHeader column={column} title="Type" />,
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      id: "Quantity",
      accessorFn: (row) => row.raw["Quantity"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Quantity" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      // 数字排序：用 accessorFn 返回原字符串也没关系，sortingFn 自己转 number
      sortingFn: (rowA, rowB, columnId) => {
        const a = toNumber(rowA.getValue(columnId));
        const b = toNumber(rowB.getValue(columnId));
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return a === b ? 0 : a > b ? 1 : -1;
      },
    },
    {
      id: "Filled Price",
      accessorFn: (row) => row.raw["Filled Price"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Filled Price" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: (rowA, rowB, columnId) => {
        const a = toNumber(rowA.getValue(columnId));
        const b = toNumber(rowB.getValue(columnId));
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return a === b ? 0 : a > b ? 1 : -1;
      },
    },
    {
      id: "Fee Paid",
      accessorFn: (row) => row.raw["Fee Paid"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Fee Paid" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: (rowA, rowB, columnId) => {
        const a = toNumber(rowA.getValue(columnId));
        const b = toNumber(rowB.getValue(columnId));
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return a === b ? 0 : a > b ? 1 : -1;
      },
    },
    {
      id: "Cash Flow",
      accessorFn: (row) => row.raw["Cash Flow"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Cash Flow" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: (rowA, rowB, columnId) => {
        const a = toNumber(rowA.getValue(columnId));
        const b = toNumber(rowB.getValue(columnId));
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return a === b ? 0 : a > b ? 1 : -1;
      },
    },
    {
      id: "Wallet Balance",
      accessorFn: (row) => row.raw["Wallet Balance"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Wallet Balance" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: (rowA, rowB, columnId) => {
        const a = toNumber(rowA.getValue(columnId));
        const b = toNumber(rowB.getValue(columnId));
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return a === b ? 0 : a > b ? 1 : -1;
      },
    },
    {
      id: "Time(UTC)",
      accessorFn: (row) => row.raw["Time(UTC)"] ?? "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Time(UTC)" />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
      ),
      sortingFn: (rowA, rowB, columnId) => {
        const a = toTime(rowA.getValue(columnId));
        const b = toTime(rowB.getValue(columnId));
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return a === b ? 0 : a > b ? 1 : -1;
      },
    },
  ];

  return (
    <div className="flex w-full">
      <DataTable columns={columns} data={parsedRows} />
    </div>
  );
}
