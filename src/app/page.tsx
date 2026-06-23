import { StoreProvider } from "@/state/provider";
import { Workbench } from "@/components/Workbench";

export default function Page() {
  return (
    <StoreProvider>
      <Workbench />
    </StoreProvider>
  );
}
