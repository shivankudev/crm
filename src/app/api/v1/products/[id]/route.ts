import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateProductSchema } from "@/lib/validation/product";
import { updateProduct } from "@/services/product.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateProductSchema.parse(body);

    const product = await updateProduct(id, input, actor);
    return NextResponse.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
