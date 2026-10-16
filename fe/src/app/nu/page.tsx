import { Suspense } from "react";
import { NuListing } from "../listings";

export const metadata = { title: "FashionSearch AI" };

export default function Page() {
  return (
    <Suspense>
      <NuListing />
    </Suspense>
  );
}
