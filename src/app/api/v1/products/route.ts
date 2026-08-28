import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createProductSchema } from "@/lib/validation/product";
import { createProduct, listProductsForUser } from "@/services/product.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    const products = await listProductsForUser(actor, includeInactive);
    return NextResponse.json({ products });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createProductSchema.parse(body);

    const product = await createProduct(input, actor);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
