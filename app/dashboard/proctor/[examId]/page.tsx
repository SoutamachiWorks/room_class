import { redirect } from 'next/navigation';

export default async function ProctorExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  redirect(`/dashboard/proctor/${examId}/monitoring`);
}
