import looks from "./cat-looks.json";
import { ROOMS } from "./model";

export const CAT_LOOKS = looks;
export const MAX_CATS = 40;
export type CatProfile = {
  id: string;
  name: string;
  variant: number;
  roomId: string;
  personalitySeed: number;
  curiosity: number;
  laziness: number;
  sociability: number;
  speed: number;
};
export const catLook = (variant: number) => {
  const look = CAT_LOOKS.find((look) => look.id === variant);
  if (!look) throw Error("Unknown cat appearance");
  return look;
};
export function catProfile(cat: CatProfile): CatProfile {
  const {
    id,
    name,
    variant,
    roomId,
    personalitySeed,
    curiosity,
    laziness,
    sociability,
    speed,
  } = cat;
  return {
    id,
    name,
    variant,
    roomId,
    personalitySeed,
    curiosity,
    laziness,
    sociability,
    speed,
  };
}
export function validateRoster(cats: CatProfile[]): CatProfile[] {
  if (!Array.isArray(cats) || cats.length > MAX_CATS)
    throw Error("Unrecognized cat roster");
  const ids = new Set<string>();
  for (const cat of cats) {
    if (
      !cat ||
      typeof cat.id !== "string" ||
      !cat.id ||
      cat.id.length > 100 ||
      ids.has(cat.id) ||
      typeof cat.name !== "string" ||
      !cat.name.trim() ||
      cat.name.length > 40
    )
      throw Error("Invalid cat identity");
    catLook(cat.variant);
    if (!ROOMS.some((room) => room.id === cat.roomId))
      throw Error("Unknown cat home room");
    if (!Number.isSafeInteger(cat.personalitySeed))
      throw Error("Invalid cat personality");
    if (
      ![cat.curiosity, cat.laziness, cat.sociability].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      ) ||
      !Number.isFinite(cat.speed) ||
      cat.speed < 1 ||
      cat.speed > 3
    )
      throw Error("Invalid cat traits");
    ids.add(cat.id);
  }
  return cats.map(catProfile);
}
