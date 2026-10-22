import { PersonDetail } from "@/components/people-pages";

export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PersonDetail id={id} />;
}
