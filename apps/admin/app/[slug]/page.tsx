import { AdminApp } from '../../src/lib/AdminApp';
import { AdminCrudPanel } from '../../src/lib/AdminCrudPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ModulePage({ params }: { params: { slug: string } }) {
  return (
    <AdminApp>
      <AdminCrudPanel activeModuleKey={params.slug} />
    </AdminApp>
  );
}
