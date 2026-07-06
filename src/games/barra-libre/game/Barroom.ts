import * as THREE from "three";
import {
  COUNTER_DEPTH,
  COUNTER_HEIGHT,
  COUNTER_LENGTH,
  LANE_COUNT,
  TAP_X,
} from "./constants";
import { laneCounterTopY, laneFloorY, laneZ } from "./layout";
import {
  buildBackWallTexture,
  buildBoothTexture,
  buildCounterFrontTexture,
  buildCounterTopTexture,
  buildDrinkers,
  buildFloorTexture,
  buildCityWindowTexture,
  buildNeonBarSign,
  buildNeonCocktail,
  buildShelfTexture,
} from "./sprites";

/** Seconds between the two background-drinker postures. */
const BOOTH_FRAME_TIME = 0.7;
/** Counters are centered so they span SPAWN side to just past the tap. */
const COUNTER_CENTER_X = TAP_X + 0.55 - COUNTER_LENGTH / 2;
/** The two lamp rows per lane: one over the walk-in, one by the serve end. */
const LAMP_SPAWN_X = -5.5;
const LAMP_TAP_X = 2.8;
/** The +X side wall (screen left): a floor-to-ceiling city picture window. */
const SIDE_WALL_X = 7.5;

const BACK_WALL_Z = 11.4;
const ROOM_WIDTH = 15;

/** The night bar: a single flat floor, four counters with taps, the back
 *  wall with its backlit bottle shelves, neon signs, booth crowd and a city
 *  window on the side wall — plus the whole light rig. The visible fixtures
 *  (lamps, neon tubes, bottle backlight, city window) are emissive meshes
 *  co-located with real lights so what the eye sees is what casts. */
export class Barroom {
  readonly object = new THREE.Group();
  /** Warm pulse the Game spikes on serves / catches / tips. */
  readonly pulseGood: THREE.PointLight;
  /** Red pulse the Game spikes on a strike. */
  readonly pulseBad: THREE.PointLight;

  /** Two booth postures swapped on a timer so the room feels alive. */
  private readonly boothFrames: THREE.CanvasTexture[];
  private boothMaterial!: THREE.MeshBasicMaterial;
  private boothTime = 0;
  private boothFrame = 0;

  /** The magenta BAR sign flickers like a tired tube. */
  private readonly neonLight: THREE.PointLight;
  private neonMaterial!: THREE.MeshStandardMaterial;
  private flickerLeft = 0;
  private flickerCooldown = 2;

  /** Shared furniture palette (red-wine upholstery, dark metal frame, wood
   *  top) so the lounge tables and chairs read as one set. */
  private readonly stoolSeatMat = new THREE.MeshStandardMaterial({ color: 0x7a2030, roughness: 0.6 });
  private readonly stoolLegMat = new THREE.MeshStandardMaterial({
    color: 0x3a3540,
    roughness: 0.4,
    metalness: 0.5,
  });
  private readonly tableWoodMat = new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: 0.8 });

  constructor() {
    const drinkers = buildDrinkers(256);
    this.boothFrames = [buildBoothTexture(drinkers, 0), buildBoothTexture(drinkers, 1)];

    this.object.add(this.buildFloors());
    this.object.add(this.buildCounters());
    this.object.add(this.buildLounge());
    this.object.add(this.buildBackWall());
    this.neonLight = this.buildNeons();
    this.buildLamps();
    this.buildBaseLights();

    this.pulseGood = new THREE.PointLight(0xffc46a, 0, 10, 1.6);
    this.pulseGood.position.set(1.8, laneCounterTopY(1) + 1.2, laneZ(1));
    this.pulseBad = new THREE.PointLight(0xff4040, 0, 12, 1.6);
    this.pulseBad.position.set(2.4, laneCounterTopY(1) + 0.9, laneZ(1) + 0.6);
    this.object.add(this.pulseGood, this.pulseBad);
  }

  private buildFloors(): THREE.Group {
    const group = new THREE.Group();
    const floorTex = buildFloorTexture();
    floorTex.repeat.set(6, 8);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 });

    // Ground level, from in front of the camera to under lane 1's terrace.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH * 2, 26), floorMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 3);
    ground.receiveShadow = true;
    group.add(ground);

    // Terraced platforms for lanes 1..3, with their riser faces.
    const riserMat = new THREE.MeshStandardMaterial({ color: 0x1c1210, roughness: 0.9 });
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const zFrom = laneZ(lane) - 0.9;
      const zTo = laneZ(lane) + 1.7;
      const h = laneFloorY(lane);
      if (h > 0.01) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH, h, zTo - zFrom), riserMat);
        slab.position.set(0, h / 2, (zFrom + zTo) / 2);
        slab.receiveShadow = true;
        group.add(slab);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, zTo - zFrom), floorMat);
        top.rotation.x = -Math.PI / 2;
        top.position.set(0, h + 0.005, (zFrom + zTo) / 2);
        top.receiveShadow = true;
        group.add(top);
      }
    }
    return group;
  }

  private buildCounters(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc8a24a,
      roughness: 0.35,
      metalness: 0.7,
    });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5 });

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const y0 = laneFloorY(lane);
      const z = laneZ(lane);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(COUNTER_LENGTH, COUNTER_HEIGHT, COUNTER_DEPTH),
        bodyMat,
      );
      body.position.set(COUNTER_CENTER_X, y0 + COUNTER_HEIGHT / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Polished top slab: the surface the lamps glint on.
      const topTex = buildCounterTopTexture();
      topTex.repeat.set(7, 1);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(COUNTER_LENGTH + 0.12, 0.06, COUNTER_DEPTH + 0.12),
        new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.1 }),
      );
      top.position.set(COUNTER_CENTER_X, y0 + COUNTER_HEIGHT + 0.03, z);
      top.receiveShadow = true;
      group.add(top);

      // Paneled front toward the camera.
      const frontTex = buildCounterFrontTexture();
      frontTex.repeat.set(6, 1);
      const front = new THREE.Mesh(
        new THREE.PlaneGeometry(COUNTER_LENGTH, COUNTER_HEIGHT),
        new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.8 }),
      );
      front.position.set(COUNTER_CENTER_X, y0 + COUNTER_HEIGHT / 2, z - COUNTER_DEPTH / 2 - 0.001);
      front.rotation.y = Math.PI; // plane faces -Z (the camera)
      front.receiveShadow = true;
      group.add(front);

      // The tap: brass column with a spout and a white handle.
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 8), brassMat);
      column.position.set(TAP_X, y0 + COUNTER_HEIGHT + 0.26, z + 0.18);
      column.castShadow = true;
      group.add(column);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), brassMat);
      spout.rotation.z = Math.PI / 2;
      spout.position.set(TAP_X - 0.1, y0 + COUNTER_HEIGHT + 0.4, z + 0.18);
      group.add(spout);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), handleMat);
      handle.position.set(TAP_X + 0.03, y0 + COUNTER_HEIGHT + 0.56, z + 0.18);
      group.add(handle);
    }

    return group;
  }

  /** Bistro/restaurant sets that dress the empty floor in front of the bar:
   *  a round pedestal table with two backed chairs, angled a little so the
   *  foreground reads as a room, not a row. */
  private buildLounge(): THREE.Group {
    const group = new THREE.Group();
    const sets: [number, number, number][] = [
      [-4.8, 0.05, 0.35],
      [-1.7, -0.15, -0.25],
      [1.6, 0.05, 0.5],
    ];
    for (const [x, z, rot] of sets) group.add(this.makeDinerSet(x, z, rot));
    return group;
  }

  /** A round restaurant table (dark pedestal + wood top) with a backed chair
   *  on either side facing in. */
  private makeDinerSet(x: number, z: number, rotY: number): THREE.Group {
    const set = new THREE.Group();

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.05, 12), this.stoolLegMat);
    base.position.y = 0.025;
    set.add(base);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.66, 8), this.stoolLegMat);
    column.position.y = 0.36;
    set.add(column);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 20), this.tableWoodMat);
    top.position.y = 0.72;
    top.castShadow = true;
    top.receiveShadow = true;
    set.add(top);

    for (const dir of [-1, 1]) {
      const chair = this.makeChair();
      chair.position.z = dir * 0.62;
      chair.rotation.y = dir < 0 ? 0 : Math.PI; // face the table
      set.add(chair);
    }

    set.position.set(x, 0, z);
    set.rotation.y = rotY;
    return set;
  }

  /** A chair facing +Z: four legs, a padded seat and a backrest at the -Z
   *  side. Same palette as the bar (red-wine seat, dark metal frame). */
  private makeChair(): THREE.Group {
    const chair = new THREE.Group();
    for (const lx of [-0.15, 0.15]) {
      for (const lz of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6), this.stoolLegMat);
        leg.position.set(lx, 0.22, lz);
        leg.castShadow = true;
        chair.add(leg);
      }
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), this.stoolSeatMat);
    seat.position.y = 0.46;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.05), this.stoolSeatMat);
    back.position.set(0, 0.67, -0.16);
    back.castShadow = true;
    chair.add(back);
    return chair;
  }

  private buildBackWall(): THREE.Group {
    const group = new THREE.Group();

    const wallTex = buildBackWallTexture();
    wallTex.repeat.set(5, 1);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_WIDTH * 1.6, 6.5),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }),
    );
    wall.position.set(0, laneFloorY(LANE_COUNT - 1) + 3.25, BACK_WALL_Z);
    wall.rotation.y = Math.PI;
    wall.receiveShadow = true;
    group.add(wall);

    // Backlit bottle shelves, right half of the back wall (the backbar).
    const shelfTex = buildShelfTexture();
    for (const y of [4.55, 5.5]) {
      const shelf = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 1.35),
        new THREE.MeshStandardMaterial({
          map: shelfTex,
          emissive: 0xffffff,
          emissiveMap: shelfTex,
          emissiveIntensity: 0.45,
          roughness: 0.8,
        }),
      );
      shelf.position.set(2.6, y, BACK_WALL_Z - 0.05);
      shelf.rotation.y = Math.PI;
      group.add(shelf);
    }
    const shelfGlow = new THREE.PointLight(0xffb454, 6, 7, 1.8);
    shelfGlow.position.set(2.6, 5.1, BACK_WALL_Z - 1.0);
    group.add(shelfGlow);

    // Booth crowd along the left half.
    this.boothMaterial = new THREE.MeshBasicMaterial({ map: this.boothFrames[0] });
    const booth = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.35), this.boothMaterial);
    booth.position.set(-4.4, 4.35, BACK_WALL_Z - 0.06);
    booth.rotation.y = Math.PI;
    group.add(booth);

    group.add(this.buildCityWindow());

    return group;
  }

  /** Floor-to-ceiling picture window on the +X side wall: the emissive city
   *  view (the cool light's source) behind a real dark mullion frame. */
  private buildCityWindow(): THREE.Group {
    const group = new THREE.Group();

    const cityTex = buildCityWindowTexture();
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 6.5),
      new THREE.MeshStandardMaterial({
        map: cityTex,
        emissive: 0xffffff,
        emissiveMap: cityTex,
        emissiveIntensity: 0.6,
        roughness: 0.9,
      }),
    );
    glass.position.set(SIDE_WALL_X, 3.25, 5.0);
    glass.rotation.y = -Math.PI / 2;
    group.add(glass);

    // Dark frame + mullions, sitting just in front of the glass (-X side).
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.7, metalness: 0.3 });
    const fx = SIDE_WALL_X - 0.04;
    const addBar = (len: number, along: "z" | "y", y: number, z: number): void => {
      const geo = along === "z"
        ? new THREE.BoxGeometry(0.05, 0.08, len)
        : new THREE.BoxGeometry(0.05, len, 0.08);
      const bar = new THREE.Mesh(geo, frameMat);
      bar.position.set(fx, y, z);
      group.add(bar);
    };
    // Outer frame.
    addBar(12, "z", 6.45, 5.0);
    addBar(12, "z", 0.05, 5.0);
    addBar(6.5, "y", 3.25, -0.95);
    addBar(6.5, "y", 3.25, 10.95);
    // Inner mullions.
    for (const z of [1.6, 5.0, 8.4]) addBar(6.5, "y", 3.25, z);
    addBar(12, "z", 3.25, 5.0);

    return group;
  }

  /** Neon signs: emissive-mapped planes over the bloom threshold, each
   *  backed by a matching point light. Returns the flickering one. */
  private buildNeons(): THREE.PointLight {
    const barTex = buildNeonBarSign();
    this.neonMaterial = new THREE.MeshStandardMaterial({
      map: barTex,
      emissive: 0xffffff,
      emissiveMap: barTex,
      emissiveIntensity: 1.8,
      transparent: true,
      alphaTest: 0.3,
      roughness: 0.9,
    });
    const barSign = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.26), this.neonMaterial);
    barSign.position.set(-2.6, 6.3, BACK_WALL_Z - 0.08);
    barSign.rotation.y = Math.PI;
    this.object.add(barSign);

    const magenta = new THREE.PointLight(0xff2fd6, 9, 9, 1.8);
    magenta.position.set(-2.6, 6.3, BACK_WALL_Z - 1.2);
    this.object.add(magenta);

    const cocktailTex = buildNeonCocktail();
    const cocktail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 1.44),
      new THREE.MeshStandardMaterial({
        map: cocktailTex,
        emissive: 0xffffff,
        emissiveMap: cocktailTex,
        emissiveIntensity: 1.7,
        transparent: true,
        alphaTest: 0.3,
        roughness: 0.9,
      }),
    );
    cocktail.position.set(4.6, 6.5, BACK_WALL_Z - 0.08);
    cocktail.rotation.y = Math.PI;
    this.object.add(cocktail);

    const cyan = new THREE.PointLight(0x2fd6ff, 6, 8, 1.8);
    cyan.position.set(4.6, 6.5, BACK_WALL_Z - 1.2);
    this.object.add(cyan);

    return magenta;
  }

  /** Two hanging lamps per counter: one out over the customers' walk-in
   *  (spawn side), one near the bartender's serve end. Cone shade, glowing
   *  bulb, warm spot. Only the spawn-side lamps of lanes 0 and 2 cast
   *  shadows (budget); the rig still reads as pools of lamplight on the wood. */
  private buildLamps(): void {
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0x1d3a2a,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.9 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffd9a0,
      emissive: 0xffc87a,
      emissiveIntensity: 2.4,
      roughness: 0.4,
    });

    const addLamp = (x: number, lane: number, castShadow: boolean): void => {
      const y = laneCounterTopY(lane) + 2.1;
      const z = laneZ(lane);

      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6.0, 4), cordMat);
      cord.position.set(x, y + 3.1, z);
      this.object.add(cord);

      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.3, 0.24, 10, 1, true),
        shadeMat,
      );
      shade.position.set(x, y + 0.1, z);
      this.object.add(shade);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat);
      bulb.position.set(x, y, z);
      this.object.add(bulb);

      // Aimed a touch behind the counter so the cone also catches the
      // customers walking there, not just the wood.
      const spot = new THREE.SpotLight(0xffb45c, 26, 9, 0.7, 0.55, 1.2);
      spot.position.set(x, y, z);
      spot.target.position.set(x, laneCounterTopY(lane), z + 0.35);
      if (castShadow) {
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.camera.near = 0.5;
        spot.shadow.camera.far = 12;
        spot.shadow.bias = -0.0005;
        spot.shadow.normalBias = 0.03;
      }
      this.object.add(spot, spot.target);
    };

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      addLamp(LAMP_SPAWN_X, lane, lane === 0 || lane === 2);
      addLamp(LAMP_TAP_X, lane, false);
    }
  }

  private buildBaseLights(): void {
    // Night fill: faint cool above, dead warm-dark below.
    this.object.add(new THREE.HemisphereLight(0x2a3550, 0x1a120c, 0.4));

    // Moonlight rim from the window side: separates sprites from the dark.
    const rim = new THREE.DirectionalLight(0x6f8fd8, 0.45);
    rim.position.set(-8, 6, 3);
    rim.target.position.set(2, 1, 6);
    this.object.add(rim, rim.target);

    // Warm key from the camera side to light the sprites' faces and balance
    // the cool window/rim so patrons don't read as flat silhouettes.
    const frontWarm = new THREE.DirectionalLight(0xffa868, 0.45);
    frontWarm.position.set(6, 4.5, -2);
    frontWarm.target.position.set(-1, 0.5, 5);
    this.object.add(frontWarm, frontWarm.target);

    // Warm wash over the tap end of all four bars (the lamps pool at the
    // counters' center, so the bartender's corner needs its own glow —
    // visually it reads as spill from the backbar shelves).
    const tapGlow = new THREE.PointLight(0xffb454, 7, 9, 1.7);
    tapGlow.position.set(3.4, 3.1, 5.6);
    this.object.add(tapGlow);

    // Fill over the -X spawn end (screen right) so customers walking in from
    // off-camera aren't lost in the dark before they reach the lamplight.
    const spawnFill = new THREE.PointLight(0x8a2be2, 5, 12, 1.5);
    spawnFill.position.set(-6.5, 4.0, 4.0);
    this.object.add(spawnFill);

    // Soft warm glow over the front lounge so the tables read in the dark
    // foreground without washing the play area behind them.
    const loungeGlow = new THREE.PointLight(0xffa050, 3.2, 7, 1.8);
    loungeGlow.position.set(-1.5, 1.7, -0.2);
    this.object.add(loungeGlow);
  }

  /** Booth crowd swap and the tired-tube neon flicker. */
  update(dt: number): void {
    this.boothTime += dt;
    if (this.boothTime >= BOOTH_FRAME_TIME) {
      this.boothTime = 0;
      this.boothFrame = 1 - this.boothFrame;
      this.boothMaterial.map = this.boothFrames[this.boothFrame];
      this.boothMaterial.needsUpdate = true;
    }

    // Tired-tube flicker: occasional short dropouts of the BAR sign.
    if (this.flickerLeft > 0) {
      this.flickerLeft -= dt;
      const dim = Math.random() < 0.5 ? 0.25 : 0.75;
      this.neonMaterial.emissiveIntensity = 1.8 * dim;
      this.neonLight.intensity = 9 * dim;
      if (this.flickerLeft <= 0) {
        this.neonMaterial.emissiveIntensity = 1.8;
        this.neonLight.intensity = 9;
        this.flickerCooldown = 1.5 + Math.random() * 4;
      }
    } else {
      this.flickerCooldown -= dt;
      if (this.flickerCooldown <= 0) this.flickerLeft = 0.1 + Math.random() * 0.15;
    }
  }
}
