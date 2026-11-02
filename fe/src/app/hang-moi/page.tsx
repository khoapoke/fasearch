import { Suspense } from "react";
import { HangMoiListing } from "../listings";

export const metadata = { title: "FaSearch" };

export default function Page() {
  return (
    <Suspense>
      <HangMoiListing />
    </Suspense>
  );
}
