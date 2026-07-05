interface Props {
  context: any;
}

export function FileTree({ context }: Props) {
  if (!context) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No context available
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full text-sm">
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Files</h3>
        <p className="text-foreground font-mono truncate">{context.filename}</p>
        <p className="text-muted-foreground text-xs">{context.language}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Diagnostics</h3>
        <div className="text-muted-foreground text-xs">
          {context.diagnostics?.map((d: string, i: number) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
