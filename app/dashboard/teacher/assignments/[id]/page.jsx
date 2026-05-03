import { redirect } from 'next/navigation';

export default async function AssignmentIdPage({ params }) {
  const { id } = await params;
  // Jika user mengakses /assignments/[id], otomatis lempar ke /assignments/[id]/submissions
  redirect(`/dashboard/teacher/assignments/${id}/submissions`);
}
