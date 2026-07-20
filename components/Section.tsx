type Props = {
  id: string;
  index: string;
  title: string;
  children: React.ReactNode;
};

export default function Section({ id, index, title, children }: Props) {
  return (
    <section id={id} className="mx-auto max-w-5xl scroll-mt-20 px-6 py-20 md:py-28">
      <div className="mb-10 flex items-center gap-4">
        <span className="font-mono text-sm text-accent">{index}</span>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}
