import { Suspense } from "react";
import { NuListing } from "../listings";

export const metadata = { title: "FaSearch" };

export default function Page() {
  return (
    <Suspense>
      <NuListing />
    </Suspense>
  );
}
