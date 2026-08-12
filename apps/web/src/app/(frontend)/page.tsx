import { CabinetFace } from "@/components/home/CabinetFace";
import { DrawerRack } from "@/components/home/DrawerRack";
import { LedgerBand } from "@/components/home/LedgerBand";
import { ProjectRail } from "@/components/home/ProjectRail";
import { MakeSection } from "@/components/home/MakeSection";
import { Reviews } from "@/components/home/Reviews";

/*
  Paced deliberately: a monumental image, then the rack of drawers you can
  pull, then the builds, then Make — the one section whose subject is a part
  that does not exist yet — and only then the terms.

  The ledger sits immediately above the reviews on purpose. It is the answer to
  "why buy here", and it lands better as the last thing read before other
  people's opinions than as an interruption between the cabinet and the builds.
*/
export default function Home() {
  return (
    <>
      <CabinetFace />
      <DrawerRack />
      <ProjectRail />
      <MakeSection />
      <LedgerBand />
      <Reviews />
    </>
  );
}
