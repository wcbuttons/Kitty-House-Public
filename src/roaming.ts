/** Choose a room first so larger rooms do not overwhelm a cat's preference. */
export function chooseRoamingRoom(
  cat: {
    roomId: string;
    homeRoomId: string;
    curiosity: number;
    laziness: number;
    energy: number;
    awayFor: number;
  },
  rooms: ReadonlyMap<string, number>,
  random: () => number,
): string {
  if (!rooms.size) return cat.roomId;
  if (
    cat.roomId !== cat.homeRoomId &&
    rooms.has(cat.homeRoomId) &&
    random() <
      Math.min(
        0.9,
        0.18 + cat.awayFor / 240 + (1 - cat.energy) * 0.2 + cat.laziness * 0.1,
      )
  )
    return cat.homeRoomId;
  if (rooms.has(cat.roomId) && random() >= 0.05 + cat.curiosity * 0.55)
    return cat.roomId;
  const choices = [...rooms].filter(([room]) => room !== cat.roomId);
  if (!choices.length) return rooms.keys().next().value!;
  const weighted = choices.map(([room, hops]) => ({
    room,
    weight: Math.pow(0.25 + cat.curiosity, Math.max(0, hops - 1)),
  }));
  let roll = random() * weighted.reduce((sum, item) => sum + item.weight, 0);
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.room;
  }
  return weighted[weighted.length - 1].room;
}
