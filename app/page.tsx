import { redirect } from "next/navigation";
import { DEFAULT_MODULE } from "@/lib/modules";

export default function RootPage() {
  redirect(`/${DEFAULT_MODULE.slug}`);
}
