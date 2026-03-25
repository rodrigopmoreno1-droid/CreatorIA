import { ProductsWorkspace } from '@/components/platform/products-workspace';
import { getWorkspaceProducts } from '@/lib/platform-data';

export default async function ProductsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const products = await getWorkspaceProducts(workspace);

  return <ProductsWorkspace workspace={workspace} initialProducts={products} />;
}
