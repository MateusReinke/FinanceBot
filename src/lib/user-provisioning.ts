import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@/lib/default-categories";

// Shared by self-registration (src/app/actions/auth.ts) and admin-created
// users (src/app/actions/admin.ts) so the default-category seeding never
// drifts between the two paths.
export async function createUserWithDefaultCategories(data: {
  name: string;
  email: string;
  // Null for an account created by signing in with Google, which has no
  // password until the user chooses to set one in Configurações.
  passwordHash: string | null;
  phoneNumber?: string | null;
  role?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        phoneNumber: data.phoneNumber ?? null,
        role: data.role ?? "user",
      },
    });

    await tx.category.createMany({
      data: [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
          ...c,
          type: "expense",
          isDefault: true,
          userId: created.id,
        })),
        ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
          ...c,
          type: "income",
          isDefault: true,
          userId: created.id,
        })),
      ],
    });

    return created;
  });
}
