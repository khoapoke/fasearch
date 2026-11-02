import { Suspense } from "react";
import { BoSuuTapListing } from "../listings";

export const metadata = { title: "FaSearch" };

export default function Page() {
  return (
    <Suspense>
      <BoSuuTapListing />
    </Suspense>
  );
}
