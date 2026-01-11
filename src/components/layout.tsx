interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-dvh bg-slate-50 flex overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 min-h-0 overflow-auto p-4 lg:p-5">
          <div className="w-full space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
