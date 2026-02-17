import { handlers } from "@/lib/auth";

export function generateStaticParams() {
  return [];
}

export const { GET, POST } = handlers;
