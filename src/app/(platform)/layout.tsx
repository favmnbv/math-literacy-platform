import { Portal } from "@/components/portal";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Portal />
      {children}
    </>
  );
}
