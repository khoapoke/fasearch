import { Suspense } from "react";
import { SaleListing } from "../listings";

export const metadata = { title: "FaSearch" };

export default function Page() {
  return (
    <Suspense>
      <SaleListing />
    </Suspense>
  );
}
