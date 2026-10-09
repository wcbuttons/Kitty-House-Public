import {
  CELL,
  ROOMS,
  defById,
  roomById,
  worldPoint,
  type Action,
  type Layout,
} from "./model";
import {
  actionWeights,
  sampleActionDuration,
  updateNeeds,
  weightedChoice,
  type CatNeeds,
} from "./behavior";
import { chooseRoamingRoom } from "./roaming";
import { passageSegmentClear, passageWorldPoint } from "./passages";
import {
  catLook,
  catProfile,
  validateRoster,
  MAX_CATS,
  type CatProfile,
} from "./cat-model";
import {
  arcPoint,
  arcClear,
  bodyClear,
  buildGraph,
  updateGraph,
  clamp,
  findPath,
  routeValid,
  reachableSurfaces,
  type Edge,
  type Goal,
  type Graph,
  type Surface,
} from "./navigation";
export type CatState =
  | Action
  | "walk"
  | "jump"
  | "drop"
  | "recover"
  | "cross"
  | "climb"
  | "wait"
  | "anticipate";
export interface CatSocial {
  partnerId: string;
  kind: "greet" | "company";
  phase: "approach" | "settled";
  expiresAt: number;
  initiator: boolean;
  surfaceId: string;
  resume?: {
    state: CatState;
    timer: number;
    actionElapsed: number;
    goal: Goal | null;
  };
}
export interface Cat {
  id: string;
  name: string;
  variant: number;
  roomId: string;
  homeRoomId: string;
  awayFor: number;
  visitedRooms: string[];
  passageQueuedAt: number | null;
  personalitySeed: number;
  energy: number;
  curiosity: number;
  laziness: number;
  sociability: number;
  needs: CatNeeds;
  actionElapsed: number;
  lastAction: Action | null;
  routineSteps: number;
  social: CatSocial | null;
  socialCooldown: number;
  autonomous: boolean;
  x: number;
  y: number;
  facing: number;
  state: CatState;
  surfaceId: string;
  timer: number;
  path: Edge[];
  goal: Goal | null;
  move: Edge | null;
  progress: number;
  recent: string[];
  visited: string[];
  actions: Record<string, number>;
  speed: number;
  stuck: number;
  passing: number;
}
export const NAMES = [
  "Buttons",
  "Miso",
  "Clover",
  "Pip",
  "Noodle",
  "Maple",
  "Olive",
  "Toast",
  "Fig",
  "Mochi",
  "Pebble",
  "Socks",
  "Juniper",
  "Biscuit",
  "Bean",
  "Waffles",
  "Plum",
  "Echo",
  "Pickle",
  "Dottie",
  "Fern",
  "Tofu",
  "Chai",
  "Cricket",
  "Peaches",
  "Poppy",
  "Oreo",
  "Hazel",
  "Sunny",
  "Truffle",
  "Coco",
  "Dumpling",
  "Sprout",
  "Luna",
  "Mango",
  "Ash",
  "Honey",
  "Dot",
  "Marble",
  "Ziggy",
];
export class Random {
  constructor(public seed = 47) {}
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
export class Simulation {
  graph: Graph;
  cats: Cat[] = [];
  random: Random;
  paused = false;
  elapsed = 0;
  revision = 0;
  pathSearches = 0;
  recoveries = 0;
  private nextCatId = 0;
  private socialPairs = new Map<string, number>();
  events: { time: number; cat: string; text: string }[] = [];
  constructor(
    public layout: Layout,
    count = 12,
    seed = 47,
  ) {
    this.random = new Random(seed);
    this.graph = buildGraph(layout);
    this.setCount(count);
  }
  setCount(count: number) {
    if (!Number.isInteger(count) || count < 0 || count > MAX_CATS)
      throw Error(`Choose up to ${MAX_CATS} cats`);
    for (const cat of this.cats.slice(count)) this.endSocial(cat);
    this.cats = this.cats.slice(0, count);
    for (let i = this.cats.length; i < count; i++) {
      const room = ROOMS[i % ROOMS.length],
        surfaces = this.graph.surfaces.filter(
          (s) => s.roomId === room.id && s.y === 0,
        );
      const s =
        surfaces[i % surfaces.length] ??
        this.graph.surfaces.find((s) => s.roomId === room.id)!;
      const rand = () => this.random.next();
      const serial = this.nextCatId++;
      this.cats.push({
        id: `cat-${serial}`,
        name:
          NAMES[serial % NAMES.length] +
          (serial >= NAMES.length
            ? ` ${Math.floor(serial / NAMES.length) + 1}`
            : ""),
        variant: (i % 6) + 1,
        roomId: room.id,
        homeRoomId: room.id,
        awayFor: 0,
        visitedRooms: [room.id],
        passageQueuedAt: null,
        personalitySeed: i + 47,
        energy: rand(),
        curiosity: rand(),
        laziness: rand(),
        sociability: rand(),
        ...this.motivations(i + 47),
        x: s.x0 + 0.35 + rand() * (s.x1 - s.x0 - 0.7),
        y: s.y,
        facing: 1,
        state: "idle",
        surfaceId: s.id,
        timer: 0.4 + rand() * 4,
        path: [],
        goal: null,
        move: null,
        progress: 0,
        recent: [],
        visited: [],
        actions: {},
        speed: 1.5 + rand() * 0.9,
        stuck: 0,
        passing: 0,
      });
    }
  }
  private motivations(seed: number) {
    const random = new Random(seed ^ 0x6f423b);
    return {
      needs: {
        stimulation: 0.2 + random.next() * 0.5,
        grooming: 0.1 + random.next() * 0.5,
        scratching: 0.1 + random.next() * 0.6,
      },
      actionElapsed: 0,
      lastAction: null as Action | null,
      routineSteps: 0,
      social: null as CatSocial | null,
      socialCooldown: this.elapsed + 45 + random.next() * 120,
      autonomous: false,
    };
  }
  roster(): CatProfile[] {
    // The existing saved roomId remains the home assignment, not a visitor's location.
    return this.cats.map((cat) =>
      catProfile({ ...cat, roomId: cat.homeRoomId }),
    );
  }
  makeCatProfile(variant: number, roomId: string): CatProfile {
    catLook(variant);
    if (!ROOMS.some((r) => r.id === roomId))
      throw Error("Unknown cat home room");
    const serial = this.nextCatId++;
    return {
      id: `cat-${serial}`,
      name:
        NAMES[serial % NAMES.length] +
        (serial >= NAMES.length
          ? ` ${Math.floor(serial / NAMES.length) + 1}`
          : ""),
      variant,
      roomId,
      personalitySeed: Math.floor(this.random.next() * 0x7fffffff),
      curiosity: this.random.next(),
      laziness: this.random.next(),
      sociability: this.random.next(),
      speed: 1.5 + this.random.next() * 0.9,
    };
  }
  private spawn(profile: CatProfile, residents: Cat[] = this.cats): Cat {
    const candidates = this.graph.surfaces
      .filter((s) => s.roomId === profile.roomId)
      .flatMap((s) => {
        const positions: number[] = [];
        for (let x = s.x0 + 0.3; x <= s.x1 - 0.3; x += 0.5) positions.push(x);
        return positions
          .filter((x) =>
            bodyClear(s.roomId, x, s.y, this.graph.solids.get(s.roomId)!),
          )
          .map((x) => ({ s, x }));
      });
    if (!candidates.length)
      throw Error("This room needs a clear surface before a cat can move in.");
    const score = ({ s, x }: (typeof candidates)[number]) => {
      const distance = Math.min(
        4,
        ...residents
          .filter(
            (c) => c.roomId === profile.roomId && Math.abs(c.y - s.y) < 0.5,
          )
          .map((c) => Math.abs(c.x - x)),
      );
      return (s.y === 0 ? 10 : 0) + distance;
    };
    candidates.sort((a, b) => score(b) - score(a));
    const { s, x } = candidates[0];
    const random = new Random(profile.personalitySeed);
    return {
      ...profile,
      homeRoomId: profile.roomId,
      awayFor: 0,
      visitedRooms: [profile.roomId],
      passageQueuedAt: null,
      energy: random.next(),
      ...this.motivations(profile.personalitySeed),
      x,
      y: s.y,
      facing: 1,
      state: "idle",
      surfaceId: s.id,
      timer: 0.4 + random.next() * 3,
      path: [],
      goal: null,
      move: null,
      progress: 0,
      recent: [],
      visited: [],
      actions: {},
      stuck: 0,
      passing: 0,
    };
  }
  replaceRoster(profiles: CatProfile[]) {
    const validated = validateRoster(profiles);
    // Prepare the whole roster first: a failed move must not remove any current cats.
    const stationary = this.cats.filter((cat) =>
      validated.some(
        (profile) => profile.id === cat.id && profile.roomId === cat.homeRoomId,
      ),
    );
    const next: Cat[] = [];
    for (const profile of validated) {
      const current = this.cats.find((c) => c.id === profile.id);
      next.push(
        current && current.homeRoomId === profile.roomId
          ? { ...current, ...profile, roomId: current.roomId }
          : this.spawn(profile, [...stationary, ...next]),
      );
    }
    // Only mutate existing encounters after every requested spawn succeeded.
    for (const cat of this.cats)
      if (
        !validated.some(
          (profile) =>
            profile.id === cat.id && profile.roomId === cat.homeRoomId,
        )
      )
        this.endSocial(cat);
    for (const [index, profile] of validated.entries()) {
      const current = this.cats.find(
        (cat) => cat.id === profile.id && cat.homeRoomId === profile.roomId,
      );
      if (current)
        next[index] = { ...current, ...profile, roomId: current.roomId };
    }
    this.cats = next;
    for (const cat of this.cats) {
      const match = /^cat-(\d+)$/.exec(cat.id);
      if (match)
        this.nextCatId = Math.max(this.nextCatId, Number(match[1]) + 1);
    }
  }
  log(c: Cat, text: string) {
    this.events.unshift({ time: this.elapsed, cat: c.name, text });
    this.events = this.events.slice(0, 8);
  }
  relocate(c: Cat, roomId: string) {
    this.endSocial(c);
    const placed = this.spawn(
      { ...catProfile(c), roomId },
      this.cats.filter((other) => other !== c),
    );
    Object.assign(c, placed, {
      homeRoomId: c.homeRoomId,
      energy: c.energy,
      needs: { ...c.needs },
      visitedRooms: [...new Set([...c.visitedRooms, roomId])],
    });
  }
  surface(id: string) {
    return this.graph.surfaces.find((s) => s.id === id);
  }
  occupied(goal: Goal, cat: Cat) {
    return this.cats.some(
      (c) =>
        c !== cat &&
        (c.goal?.key === goal.key ||
          (goal.interaction &&
            c.goal?.interaction?.furnitureId === goal.interaction.furnitureId)),
    );
  }
  private settlingClear(goal: Goal, cat: Cat) {
    const surface = this.surface(goal.surfaceId);
    return !this.cats.some(
      (c) =>
        c !== cat &&
        surface &&
        c.roomId === surface.roomId &&
        !c.move &&
        c.state !== "walk" &&
        c.state !== "anticipate" &&
        Math.abs(c.y - surface.y) < 0.1 &&
        Math.abs(c.x - goal.x) < 0.75,
    );
  }
  requestGoal(c: Cat, goal: Goal, autonomous = false): boolean {
    if (this.occupied(goal, c)) return false;
    const s = this.surface(goal.surfaceId);
    if (!s || c.move) return false;
    const others = this.cats.filter(
      (o) => o !== c && o.goal?.surfaceId === s.id,
    ).length;
    if (others >= s.capacity) return false;
    this.pathSearches++;
    const path = findPath(this.graph, c.surfaceId, goal.surfaceId);
    if (path === null) return false;
    this.endSocial(c);
    c.goal = goal;
    c.path = path;
    c.move = null;
    c.state = "walk";
    c.timer = 0;
    c.stuck = 0;
    c.passing = 0;
    c.passageQueuedAt = null;
    c.actionElapsed = 0;
    c.routineSteps = 0;
    c.autonomous = autonomous;
    return true;
  }
  /** Optional, nearby encounters only. No chasing, sleep interruption, or shared goal slot. */
  trySocial(c: Cat): boolean {
    if (
      c.social ||
      c.move ||
      (!["idle", "sit", "perch"].includes(c.state) &&
        !(c.state === "walk" && c.autonomous)) ||
      c.energy < 0.3 ||
      c.sociability < 0.25 ||
      this.elapsed < c.socialCooldown
    )
      return false;
    for (const [pair, expires] of this.socialPairs)
      if (expires <= this.elapsed) this.socialPairs.delete(pair);
    const willing = this.cats
      .filter((other) => {
        const pair = [c.id, other.id].sort().join(":");
        return (
          other !== c &&
          !other.social &&
          !other.move &&
          other.sociability >= 0.25 &&
          other.energy > 0.3 &&
          this.elapsed >= other.socialCooldown &&
          other.roomId === c.roomId &&
          (other.surfaceId === c.surfaceId ||
            (Math.abs(other.y - c.y) <= 3 &&
              this.graph.adjacency
                .get(c.surfaceId)
                ?.some(
                  (edge) => !edge.passage && edge.to === other.surfaceId,
                ))) &&
          ["idle", "sit", "perch"].includes(other.state) &&
          other.timer > 6 &&
          Math.abs(other.x - c.x) < 5 &&
          this.elapsed >= (this.socialPairs.get(pair) ?? 0)
        );
      })
      .sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x));
    if (!willing.length) return false;
    c.socialCooldown = this.elapsed + 35 + this.random.next() * 45;
    if (this.random.next() > 0.18 + c.sociability * 0.3) return false;
    for (const partner of willing) {
      const spots = this.graph.goals.filter(
        (goal) =>
          goal.surfaceId === partner.surfaceId &&
          goal.action === "sit" &&
          !goal.interaction &&
          Math.abs(goal.x - partner.x) >= 1.15 &&
          Math.abs(goal.x - partner.x) <= 2.4 &&
          !this.occupied(goal, c) &&
          this.settlingClear(goal, c),
      );
      spots.sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x));
      const goal = spots[0];
      if (!goal || !this.requestGoal(c, goal)) continue;
      const kind = this.random.next() < 0.65 ? "greet" : "company";
      const expiresAt = this.elapsed + 10;
      c.social = {
        partnerId: partner.id,
        kind,
        phase: "approach",
        expiresAt,
        initiator: true,
        surfaceId: partner.surfaceId,
      };
      partner.social = {
        partnerId: c.id,
        kind,
        phase: "approach",
        expiresAt,
        initiator: false,
        surfaceId: partner.surfaceId,
      };
      const cooldown = this.elapsed + 150 + this.random.next() * 180;
      c.socialCooldown = partner.socialCooldown = cooldown;
      this.socialPairs.set(
        [c.id, partner.id].sort().join(":"),
        this.elapsed + 600,
      );
      return true;
    }
    return false;
  }
  private settleSocial(c: Cat): boolean {
    const social = c.social;
    const partner =
      social && this.cats.find((other) => other.id === social.partnerId);
    if (
      !social?.initiator ||
      social.phase !== "approach" ||
      !partner?.social ||
      partner.social.partnerId !== c.id
    )
      return false;
    if (
      partner.move ||
      !["idle", "sit", "perch"].includes(partner.state) ||
      partner.surfaceId !== c.surfaceId ||
      Math.abs(partner.x - c.x) < 1.1 ||
      Math.abs(partner.x - c.x) > 2.5
    ) {
      this.endSocial(c);
      return false;
    }
    const duration =
      social.kind === "greet"
        ? 3 + this.random.next() * 3
        : 12 + this.random.next() * 13;
    partner.social.resume = {
      state: partner.state,
      timer: partner.timer,
      actionElapsed: partner.actionElapsed,
      goal: partner.goal,
    };
    for (const cat of [c, partner]) {
      cat.social!.phase = "settled";
      cat.social!.expiresAt = this.elapsed + duration;
      cat.state = "sit";
      cat.timer = duration;
      cat.actionElapsed = 0;
      cat.needs.stimulation = Math.max(0, cat.needs.stimulation - 0.12);
      cat.actions[social.kind === "greet" ? "greet" : "company"] =
        (cat.actions[social.kind === "greet" ? "greet" : "company"] ?? 0) + 1;
    }
    if (social.kind === "greet") {
      c.facing = partner.x > c.x ? 1 : -1;
      partner.facing = -c.facing;
    } else c.facing = partner.facing;
    this.log(
      c,
      social.kind === "greet"
        ? `exchanged a quiet hello with ${partner.name}`
        : `settled beside ${partner.name} for a little company`,
    );
    return true;
  }
  private endSocial(c: Cat) {
    const social = c.social;
    if (!social) return;
    const partner = this.cats.find((other) => other.id === social.partnerId);
    for (const cat of [
      c,
      ...(partner?.social?.partnerId === c.id ? [partner] : []),
    ]) {
      const previous = cat.social!;
      cat.social = null;
      if (previous.resume && this.surface(cat.surfaceId)) {
        Object.assign(cat, previous.resume);
      } else if (previous.initiator) {
        cat.goal = null;
        cat.path = [];
        cat.state = cat.move
          ? cat.move.kind === "passage"
            ? "cross"
            : cat.move.kind
          : "idle";
        cat.timer = cat.move ? 0 : 2 + this.random.next() * 3;
        cat.actionElapsed = 0;
      }
    }
  }
  choose(c: Cat) {
    if (this.trySocial(c)) return;
    const reachable = reachableSurfaces(this.graph, c.surfaceId);
    let candidates = this.graph.goals.filter(
      (g) =>
        reachable.has(g.surfaceId) &&
        !this.occupied(g, c) &&
        this.settlingClear(g, c),
    );
    // Empty or heavily edited houses still provide a safe way for a tired cat to rest.
    if (!candidates.some((goal) => goal.action === "sleep"))
      candidates.push(
        ...candidates
          .filter(
            (goal) =>
              goal.action === "sit" && !this.surface(goal.surfaceId)?.owner,
          )
          .map((goal) => ({ ...goal, action: "sleep" as const })),
      );
    const weights = actionWeights(c);
    const actions = [...new Set(candidates.map((goal) => goal.action))];
    const action = weightedChoice(
      actions.map((value) => ({
        value,
        weight: weights[value] * (value === c.lastAction ? 0.48 : 1),
      })),
      () => this.random.next(),
    );
    if (action)
      candidates = candidates.filter((goal) => goal.action === action);
    const distances = new Map([[c.surfaceId, 0]]);
    const queue = [c.surfaceId];
    for (let index = 0; index < queue.length; index++) {
      const from = queue[index];
      for (const edge of this.graph.adjacency.get(from) ?? []) {
        const distance = distances.get(from)! + (edge.passage ? 1 : 0);
        if (distance < (distances.get(edge.to) ?? Infinity)) {
          distances.set(edge.to, distance);
          queue.push(edge.to);
        }
      }
    }
    const rooms = new Map<string, number>();
    for (const goal of candidates) {
      const room = this.surface(goal.surfaceId)!.roomId;
      rooms.set(
        room,
        Math.min(rooms.get(room) ?? Infinity, distances.get(goal.surfaceId)!),
      );
    }
    const preferredRoom = chooseRoamingRoom(c, rooms, () => this.random.next());
    const scored = candidates.map((g) => {
      const s = this.surface(g.surfaceId)!;
      const owner = g.interaction?.furnitureId ?? s.owner;
      const item = this.layout.furniture.find((f) => f.instanceId === owner);
      const definition = item && defById(item.definitionId);
      let w = 1;
      if (s.roomId === preferredRoom) w *= 3;
      if (g.action === "sleep" && definition?.category === "Comfort") w *= 3.5;
      if (g.action === "perch")
        w *= 1 + s.y * 0.2 + (definition?.anchor === "wall" ? 0.8 : 0);
      if (g.action === "play" && definition?.category === "Play") w *= 2;
      if (g.action === "groom" && definition?.category === "Comfort") w *= 1.8;
      if (s.id !== c.surfaceId && c.energy > 0.35) w *= 1 + c.curiosity * 0.5;
      // Remember places, not only action slots: do not shuttle between the two ends of one sofa.
      if (c.recent.includes(g.key)) w *= 0.3;
      if (c.visited.slice(-3).includes(s.id)) w *= 0.7;
      const travel =
        (distances.get(s.id) ?? 0) * 6 +
        (s.roomId === c.roomId ? Math.abs(g.x - c.x) + Math.abs(s.y - c.y) : 8);
      w /= 1 + travel * (c.energy < 0.25 ? 0.16 : 0.045);
      const company = this.cats.filter(
        (other) =>
          other !== c &&
          (other.goal?.surfaceId === s.id || other.surfaceId === s.id),
      ).length;
      w *= Math.max(0.2, 1 + company * (c.sociability - 0.55) * 0.5);
      return { value: g, weight: w };
    });
    while (scored.length) {
      const goal = weightedChoice(scored, () => this.random.next())!;
      if (this.requestGoal(c, goal, true)) return;
      scored.splice(
        scored.findIndex((item) => item.value === goal),
        1,
      );
    }
    c.state = "idle";
    c.timer = 1 + this.random.next() * 3;
    c.goal = null;
  }
  rebuild(layout: Layout) {
    for (const c of this.cats) this.endSocial(c);
    const old = this.graph;
    this.graph = updateGraph(old, this.layout, layout);
    this.layout = layout;
    this.revision++;
    for (const c of this.cats) {
      const before = old.surfaces.find((s) => s.id === c.surfaceId);
      const support = this.graph.surfaces.find(
        (s) =>
          s.roomId === c.roomId &&
          s.owner === before?.owner &&
          Math.abs(s.y - c.y) < 0.02 &&
          c.x >= s.x0 + 0.23 &&
          c.x <= s.x1 - 0.23,
      );
      const movingValid = c.move && routeValid(this.graph, [c.move]);
      if (
        (c.move && !movingValid) ||
        (!c.move &&
          (!support ||
            !bodyClear(c.roomId, c.x, c.y, this.graph.solids.get(c.roomId)!)))
      ) {
        if (c.move?.passage) this.retreatFromPassage(c);
        else this.recover(c);
        continue;
      }
      if (!c.move && support) c.surfaceId = support.id;
      const oldGoal =
          c.goal && old.surfaces.find((s) => s.id === c.goal!.surfaceId),
        newGoal = c.goal && this.surface(c.goal.surfaceId);
      const updatedInteraction =
        c.goal?.interaction &&
        this.graph.goals.find(
          (goal) => goal.key === c.goal!.key && goal.action === c.goal!.action,
        )?.interaction;
      const goalChanged =
        c.goal &&
        (!newGoal ||
          (c.goal.interaction &&
            JSON.stringify(c.goal.interaction) !==
              JSON.stringify(updatedInteraction)) ||
          oldGoal?.y !== newGoal.y ||
          c.goal.x < newGoal.x0 + 0.23 ||
          c.goal.x > newGoal.x1 - 0.23);
      if (!routeValid(this.graph, c.path) || goalChanged) {
        c.path = [];
        c.goal = null;
        c.passageQueuedAt = null;
        if (!c.move) {
          c.state = "idle";
          c.timer = 0.2;
        }
      }
    }
  }
  recover(c: Cat) {
    this.endSocial(c);
    c.path = [];
    c.goal = null;
    c.move = null;
    c.stuck = 0;
    c.passageQueuedAt = null;
    this.recoveries++;
    const solids = this.graph.solids.get(c.roomId)!;
    const choices = this.graph.surfaces
      .filter((s) => s.roomId === c.roomId && s.y <= c.y + 0.01)
      .map((s) => ({ s, x: clamp(c.x, s.x0 + 0.3, s.x1 - 0.3) }))
      .sort(
        (a, b) =>
          Math.abs(a.x - c.x) +
          (c.y - a.s.y) * 0.5 -
          (Math.abs(b.x - c.x) + (c.y - b.s.y) * 0.5),
      );
    for (const { s, x } of choices) {
      const e: Edge = {
        from: c.surfaceId,
        to: s.id,
        sx: c.x,
        sy: c.y,
        tx: x,
        ty: s.y,
        arc: Math.abs(x - c.x) < 0.1 ? 0 : 0.7,
        kind: "drop",
        cost: 1,
      };
      if (arcClear(e, c.roomId, solids)) {
        c.move = e;
        c.progress = 0;
        c.state = "recover";
        this.log(c, "found a safe way down");
        return;
      }
    }
    // Geometry may be placed directly through a cat. Take the shortest visible recovery to a legal surface.
    const choice = choices[0] ?? {
      s: this.graph.surfaces.find((s) => s.roomId === c.roomId)!,
      x: 0,
    };
    c.move = {
      from: c.surfaceId,
      to: choice.s.id,
      sx: c.x,
      sy: c.y,
      tx: clamp(c.x, choice.s.x0 + 0.3, choice.s.x1 - 0.3),
      ty: choice.s.y,
      arc: 0.4,
      kind: "drop",
      cost: 1,
    };
    c.progress = 0;
    c.state = "recover";
  }
  private retreatFromPassage(c: Cat) {
    const edge = c.move!;
    const passage = edge.passage!;
    const position = worldPoint(roomById(c.roomId), c.x, c.y);
    const endpoints = [
      { roomId: passage.fromRoomId, x: edge.sx, y: edge.sy },
      { roomId: passage.toRoomId, x: edge.tx, y: edge.ty },
    ];
    const choices = this.graph.surfaces
      .filter((surface) =>
        endpoints.some((end) => end.roomId === surface.roomId),
      )
      .map((surface) => {
        const room = roomById(surface.roomId);
        const margin = Math.min(0.3, (surface.x1 - surface.x0) / 2);
        const endpoint = endpoints.find(
          (end) =>
            end.roomId === room.id &&
            end.y === surface.y &&
            end.x >= surface.x0 + margin &&
            end.x <= surface.x1 - margin,
        );
        const x =
          endpoint?.x ??
          clamp(
            (position.x - room.x) / CELL,
            surface.x0 + margin,
            surface.x1 - margin,
          );
        const point = worldPoint(room, x, surface.y);
        return {
          surface,
          x,
          endpoint: !!endpoint,
          distance: Math.hypot(point.x - position.x, point.y - position.y),
        };
      })
      .filter(({ surface, x }) =>
        bodyClear(
          surface.roomId,
          x,
          surface.y,
          this.graph.solids.get(surface.roomId)!,
        ),
      )
      .sort(
        (a, b) =>
          Number(b.endpoint) - Number(a.endpoint) || a.distance - b.distance,
      );
    const retreatEdge = (landing: (typeof choices)[number]): Edge => ({
      ...edge,
      from: c.surfaceId,
      to: landing.surface.id,
      sx: c.x,
      sy: c.y,
      tx: landing.x,
      ty: landing.surface.y,
      passage: {
        ...passage,
        fromRoomId: c.roomId,
        toRoomId: landing.surface.roomId,
      },
    });
    const startClear = passageSegmentClear(
      {
        ...edge,
        sx: c.x,
        sy: c.y,
        tx: c.x,
        ty: c.y,
        passage: { ...passage, fromRoomId: c.roomId, toRoomId: c.roomId },
      },
      this.graph.solids,
    );
    const landing =
      choices.find((choice) =>
        passageSegmentClear(retreatEdge(choice), this.graph.solids),
      ) ?? (!startClear ? choices[0] : undefined);
    if (!landing) {
      // Cling to the fixture until a clear exit exists, rather than cross new furniture.
      c.goal = null;
      c.path = [];
      c.state = "wait";
      c.timer = 1;
      c.passageQueuedAt = null;
      return;
    }
    // Keep the current world position and visibly retreat if an edit closes a passage.
    c.move = retreatEdge(landing);
    c.path = [];
    c.goal = null;
    c.progress = 0;
    c.state = "recover";
    c.passageQueuedAt = null;
    c.stuck = 0;
    this.recoveries++;
    this.log(c, "turned back to a clear landing");
  }
  private passageBusy(c: Cat, edge: Edge) {
    return this.cats.some(
      (other) =>
        other !== c &&
        (other.move?.passage?.id === edge.passage!.id ||
          ((other.state === "wait" || other.state === "anticipate") &&
            other.path[0]?.passage?.id === edge.passage!.id &&
            other.passageQueuedAt !== null &&
            (other.passageQueuedAt < c.passageQueuedAt! ||
              (other.passageQueuedAt === c.passageQueuedAt &&
                other.id < c.id)))),
    );
  }
  private arrive(c: Cat) {
    const goal = c.goal;
    if (!goal) {
      c.state = "idle";
      c.timer = 0.5;
      return;
    }
    if (this.occupied(goal, c) || !this.settlingClear(goal, c)) {
      this.endSocial(c);
      c.goal = null;
      c.state = "idle";
      c.timer = 0.3;
      return;
    }
    if (this.settleSocial(c)) return;
    // A declined social approach may have released its temporary goal.
    if (!c.goal) return;
    this.startActivity(c, goal);
  }
  private startActivity(c: Cat, goal: Goal) {
    c.goal = goal;
    c.state = goal.action;
    if (goal.interaction) c.facing = goal.interaction.facing;
    c.timer = sampleActionDuration(goal.action, c, () => this.random.next());
    c.actionElapsed = 0;
    c.actions[goal.action] = (c.actions[goal.action] ?? 0) + 1;
    c.recent.push(goal.key);
    c.recent = c.recent.slice(-4);
    c.visited = [
      ...c.visited.filter((id) => id !== goal.surfaceId),
      goal.surfaceId,
    ].slice(-60);
    if (this.surface(goal.surfaceId)?.owner || goal.interaction)
      this.log(
        c,
        `${goal.action === "sleep" ? "settled in for a nap" : goal.action === "perch" ? "found a new view" : goal.action === "scratch" ? "is having a good scratch" : goal.action === "hide" ? "is investigating a cozy hideaway" : goal.action === "play" ? "found something to play with" : goal.action === "groom" ? "settled down to wash" : "made themself comfortable"}`,
      );
  }
  private finishActivity(c: Cat) {
    this.endSocial(c);
    const previous = c.state as Action;
    c.lastAction = previous;
    const surface = this.surface(c.surfaceId);
    const follow =
      previous === "sleep" || previous === "play"
        ? "groom"
        : previous === "groom" && c.energy < 0.35
          ? "sleep"
          : undefined;
    // A short routine makes transitions intentional without trapping a cat in a loop.
    if (
      c.routineSteps === 0 &&
      follow &&
      surface?.actions.includes(follow) &&
      c.goal &&
      !c.goal.interaction &&
      this.random.next() < 0.6
    ) {
      c.routineSteps++;
      this.startActivity(c, { ...c.goal, action: follow });
      return;
    }
    c.goal = null;
    c.state = "idle";
    this.choose(c);
  }
  step(rawDelta: number) {
    if (this.paused) return;
    const dt = Math.min(Math.max(rawDelta, 0), 0.05);
    this.elapsed += dt;
    for (const c of this.cats) {
      c.awayFor = c.roomId === c.homeRoomId ? 0 : c.awayFor + dt;
      updateNeeds(c, dt);
      if (
        !c.move &&
        !["walk", "wait", "anticipate", "recover"].includes(c.state)
      )
        c.actionElapsed += dt;
      if (c.social) {
        const partner = this.cats.find(
          (other) => other.id === c.social!.partnerId,
        );
        const resident = c.social.initiator ? partner : c;
        if (
          !partner?.social ||
          partner.social.partnerId !== c.id ||
          this.elapsed >= c.social.expiresAt ||
          partner.roomId !== c.roomId ||
          resident?.surfaceId !== c.social.surfaceId ||
          (c.social.phase === "settled" && partner.surfaceId !== c.surfaceId) ||
          (c.social.phase === "approach" &&
            resident &&
            !["idle", "sit", "perch"].includes(resident.state))
        )
          this.endSocial(c);
        else if (c.social.phase === "settled") {
          c.timer = Math.max(0, c.social.expiresAt - this.elapsed);
          continue;
        }
      }
      // A small foreground step makes passing readable without changing support geometry.
      let passing = 0;
      if (c.state === "walk" && !c.move && c.timer <= 0) {
        for (const other of this.cats) {
          if (
            other === c ||
            other.roomId !== c.roomId ||
            other.move ||
            Math.abs(other.y - c.y) > 0.1
          )
            continue;
          // In a head-on encounter only one walker steps forward; a resting cat stays put.
          if (other.state === "walk" && c.id < other.id) continue;
          passing = Math.max(passing, 1 - Math.abs(other.x - c.x) / 1.1);
        }
      }
      c.passing += (passing - c.passing) * Math.min(1, dt * 10);
      if (c.move) {
        if (c.state === "wait") {
          c.timer -= dt;
          if (c.timer <= 0) this.retreatFromPassage(c);
          continue;
        }
        const e = c.move;
        if (e.passage) {
          const start = passageWorldPoint(e, 0),
            end = passageWorldPoint(e, 1);
          const duration = Math.max(
            0.65,
            Math.hypot(end.x - start.x, end.y - start.y) /
              (c.speed * CELL * 0.75),
          );
          c.progress += dt / duration;
          const point = passageWorldPoint(e, Math.min(1, c.progress));
          const room = roomById(c.roomId);
          c.x = (point.x - room.x) / CELL;
          c.y = (room.floor - point.y) / CELL;
          c.facing = end.x >= start.x ? 1 : -1;
        } else {
          c.progress +=
            dt /
            (0.55 + Math.abs(e.ty - e.sy) * 0.13 + Math.abs(e.tx - e.sx) * 0.1);
          const p = arcPoint(e, Math.min(1, c.progress));
          c.x = p.x;
          c.y = p.y;
          c.facing = e.tx >= e.sx ? 1 : -1;
        }
        if (c.progress >= 1) {
          if (e.passage && c.roomId !== e.passage.toRoomId) {
            c.roomId = e.passage.toRoomId;
            if (!c.visitedRooms.includes(c.roomId))
              c.visitedRooms.push(c.roomId);
            if (c.roomId === c.homeRoomId) c.awayFor = 0;
            this.log(
              c,
              c.roomId === c.homeRoomId
                ? "came back to their home room"
                : `wandered into ${roomById(c.roomId).name.toLowerCase()}`,
            );
          }
          c.surfaceId = e.to;
          c.x = e.tx;
          c.y = e.ty;
          c.move = null;
          c.state = "walk";
          c.timer = 0.13;
          c.stuck = 0;
          c.passageQueuedAt = null;
          if (!c.goal) {
            c.state = "idle";
            c.timer = 0.5;
          }
        }
        continue;
      }
      if (c.state === "anticipate" || c.state === "wait") {
        c.timer -= dt;
        if (c.timer <= 0) {
          const e = c.path[0];
          if (e && routeValid(this.graph, [e])) {
            if (e.passage && this.passageBusy(c, e)) {
              c.state = "wait";
              c.timer = 0.2;
              c.stuck = 0;
              continue;
            }
            c.path.shift();
            c.move = e;
            c.progress = 0;
            c.state = e.passage
              ? e.passage.kind === "ladder"
                ? "climb"
                : "cross"
              : (e.kind as "walk" | "jump" | "drop");
            c.passageQueuedAt = null;
            c.actions[e.kind] = (c.actions[e.kind] ?? 0) + 1;
          } else {
            c.goal = null;
            c.path = [];
            c.passageQueuedAt = null;
            c.state = "idle";
            c.timer = 0.2;
          }
        }
        continue;
      }
      if (c.state === "walk") {
        if (c.autonomous && !c.goal?.interaction && this.trySocial(c)) continue;
        c.stuck += dt;
        if (c.stuck > 22) {
          this.recover(c);
          continue;
        }
        if (c.timer > 0) {
          c.timer -= dt;
          continue;
        }
        if (!c.goal) {
          c.state = "idle";
          c.timer = 0.2;
          continue;
        }
        const edge = c.path[0],
          target = edge ? edge.sx : c.goal.x,
          dx = target - c.x;
        if (Math.abs(dx) < 0.035) {
          c.x = target;
          c.stuck = 0;
          if (edge) {
            c.state = "anticipate";
            c.timer = 0.18;
            if (edge.passage) c.passageQueuedAt = this.elapsed;
          } else this.arrive(c);
        } else {
          const velocity =
            Math.min(c.speed, Math.max(0.45, Math.abs(dx) * 3)) *
            (1 - passing * 0.35);
          const next =
            c.x + Math.sign(dx) * Math.min(Math.abs(dx), velocity * dt);
          c.facing = dx > 0 ? 1 : -1;
          // Cats share the depth of the cutaway. Furniture remains solid, while cats
          // slow and pass in front of each other instead of repeatedly abandoning routes.
          if (Math.abs(next - c.x) > 0.000001) c.stuck = 0;
          c.x = next;
        }
        continue;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        this.finishActivity(c);
      }
    }
  }
  snapshot() {
    return structuredClone({
      elapsed: this.elapsed,
      revision: this.revision,
      pathSearches: this.pathSearches,
      recoveries: this.recoveries,
      cats: this.cats,
      surfaces: this.graph.surfaces,
      edges: this.graph.edges.length,
      events: this.events,
    });
  }
}
