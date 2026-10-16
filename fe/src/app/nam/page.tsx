import { Suspense } from "react";
import { NamListing } from "../listings";

export const metadata = { title: "FashionSearch AI" };

export default function Page() {
  return (
    <Suspense>
      <NamListing />
    </Suspense>
  );
}
