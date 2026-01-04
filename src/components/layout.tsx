interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <main className="flex-1 overflow-auto p-4 lg:p-5">
          <div className="w-full space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
