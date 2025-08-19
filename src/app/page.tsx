"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Content() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return <div>ID: {id}</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}
