export function displayName(user: { id: string; name: string }, currentUserId: string) {
  return user.id === currentUserId ? "Você" : user.name;
}
