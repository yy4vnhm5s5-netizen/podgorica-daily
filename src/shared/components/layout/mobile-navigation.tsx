import { Navigation } from "@/shared/components/layout/navigation";

function MobileNavigation() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <Navigation mobile />
    </div>
  );
}

export { MobileNavigation };
