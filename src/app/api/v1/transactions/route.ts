import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, rateLimit } from "@/lib/api-auth";
import { signedAmount } from "@/lib/utils";
import { transactionStatus } from "@/lib/transaction-status";

// Structured create, for an automation that already knows what it wants to
// post (or for anyone scripting against their own data). The WhatsApp agent
// uses /api/v1/messages instead and lets the app do the interpreting.
const CreateSchema = z.object({
  description: z.string().trim().min(1).max(120),
  amount: z.number().positive({ error: "O valor deve ser maior que zero." }),
  type: z.enum(["income", "expense"]),
  // Names, not ids: an automation shouldn't have to know internal ids, and
  // names are what a person can read in an n8n node. Unknown name = 400,
  // never a silent fallback that files money in the wrong place.
  account: z.string().optional(),
  category: z.string().optional(),
  date: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
  // Same previsto/realizado switch the UI has.
  paid: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`transactions:${auth.userId}`);
  if (!limited.ok) return limited.response;

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const accounts = await prisma.account.findMany({
    where: { userId: auth.userId, archived: false },
    orderBy: { name: "asc" },
  });
  if (accounts.length === 0) {
    return NextResponse.json({ error: "Nenhuma conta cadastrada." }, { status: 400 });
  }

  const account = data.account
    ? accounts.find((a) => a.name.toLowerCase() === data.account!.toLowerCase())
    : accounts[0];
  if (!account) {
    return NextResponse.json(
      { error: `Conta "${data.account}" não encontrada.`, accounts: accounts.map((a) => a.name) },
      { status: 400 }
    );
  }

  let categoryId: string | null = null;
  if (data.category) {
    const category = await prisma.category.findFirst({
      where: { userId: auth.userId, name: data.category, type: data.type },
    });
    if (!category) {
      return NextResponse.json(
        { error: `Categoria "${data.category}" não encontrada.` },
        { status: 400 }
      );
    }
    categoryId = category.id;
  }

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId: auth.userId,
        accountId: account.id,
        categoryId,
        description: data.description,
        amount: data.amount,
        date: data.date ?? new Date(),
        type: data.type,
        notes: data.notes ?? null,
        balanceApplied: data.paid,
        source: "api",
      },
    }),
    ...(data.paid
      ? [
          prisma.account.update({
            where: { id: account.id },
            data: { balance: { increment: signedAmount(data.amount, data.type) } },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(
    {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      date: transaction.date,
      account: account.name,
      status: transactionStatus(transaction),
    },
    { status: 201 }
  );
}

// Recent transactions, so an automation can echo back what it just did or
// build a digest without touching the database directly.
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`transactions:${auth.userId}`);
  if (!limited.ok) return limited.response;

  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 20, 100);
  const transactions = await prisma.transaction.findMany({
    where: { userId: auth.userId },
    include: { account: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
      account: t.account.name,
      category: t.category?.name ?? null,
      status: transactionStatus(t),
      source: t.source,
    })),
  });
}
