import { Suspense } from "react";
import { BoSuuTapListing } from "../listings";

export const metadata = { title: "FashionSearch AI" };

export default function Page() {
  return (
    <Suspense>
      <BoSuuTapListing />
    </Suspense>
  );
}
