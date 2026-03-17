interface AppLayoutProps {
  children: React.ReactNode;
  contentWrapperClassName?: string;
  outerWrapperClassName?: string;
  fixedHeight?: boolean;
}

export function AppLayout({
  children,
  contentWrapperClassName,
  outerWrapperClassName,
  fixedHeight = false,
}: AppLayoutProps) {
  return (
    <main className={fixedHeight ? "h-screen flex flex-col overflow-hidden" : "min-h-screen flex flex-col"}>
      {/* Content */}
      <div
        className={
          outerWrapperClassName || "flex-1 w-full flex flex-col items-center"
        }
      >
        <div
          className={`w-full ${
            contentWrapperClassName ||
            "flex-1 flex flex-col gap-20 max-w-5xl p-5"
          }`}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
