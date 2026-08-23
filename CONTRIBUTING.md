# Como contribuir

## Antes de começar

Leia [docs/arquitetura.md](docs/arquitetura.md). São dez minutos que economizam
a maior parte das perguntas sobre onde uma mudança deve morar.

O ambiente sobe com o passo a passo do [README](README.md#rodando-localmente).

## O ciclo de trabalho

```bash
npm run dev            # enquanto você mexe
npm run check          # antes de commitar: lint + typecheck + formato
```

`npm run check` é exatamente o que a CI roda. Se passar aqui, passa lá — a
única coisa a mais que a CI faz é `npm run build`, que vale rodar quando a
mudança mexe em algo de servidor.

Mexeu no `prisma/schema.prisma`?

```bash
npm run db:migrate     # cria a migration e regenera o client
```

Nunca edite uma migration já aplicada: gere outra. E dê um nome que descreva o
efeito (`add_onboarding_guide`), não o mecanismo (`alter_user`).

## Convenções

**Autorização.** Toda Server Action começa por `verifySession()` — ela é um
endpoint POST alcançável diretamente, não só pelo botão que a chama. Toda
query filtra por `userId`: `findFirst({ where: { id, userId } })`, nunca
`findUnique({ where: { id } })` para dados de usuário.

**Validação.** Sempre no servidor, com zod, em `src/lib/validation/`. O
`required` do HTML é conveniência para o usuário, não garantia para o backend.

**Design.** Cores, sombras, raio de canto e o tratamento de painel vivem em
`src/app/globals.css`, nomeados por papel. Um card é `.surface`, não
`rounded-xl border bg-card shadow-card` repetido. Se você precisou de uma cor
nova, provavelmente precisava de um token novo.

**Idioma.** Interface em português, código em inglês.

**Comentários.** Este repositório comenta o *porquê*, não o *quê*. O código já
diz o que faz; o que se perde com o tempo é a razão de ter sido feito assim —
especialmente quando a razão é "a alternativa óbvia quebrava X". Se você
desfizer uma decisão, apague o comentário que a defendia.

## Commits e PRs

Mensagem no imperativo, dizendo o efeito para quem usa o app, e um corpo que
explica o porquê quando a mudança não é óbvia. O diff mostra o quê; a
mensagem existe para o resto.

Antes de abrir o PR: `npm run check` verde, e uma passada no seu próprio diff
procurando o que você deixou para trás — um `console.log`, um TODO, um trecho
comentado.
