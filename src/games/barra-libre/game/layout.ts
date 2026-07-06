import {
  COUNTER_HEIGHT,
  LANE_BASE_Z,
  LANE_STEP_Y,
  LANE_STEP_Z,
  PEOPLE_Z_OFFSET,
} from "./constants";

/** Lane geometry, shared by the world, the views and the Game. Lane 0 is
 *  the nearest bar; each lane steps back (+Z). The +Y terrace is retained as
 *  a knob (`LANE_STEP_Y`) but is currently flat (0) — all bars share a floor. */

export function laneFloorY(lane: number): number {
  return lane * LANE_STEP_Y;
}

export function laneCounterTopY(lane: number): number {
  return laneFloorY(lane) + COUNTER_HEIGHT;
}

export function laneZ(lane: number): number {
  return LANE_BASE_Z + lane * LANE_STEP_Z;
}

/** Where people (customers, bartender) stand: just behind the counter. */
export function lanePeopleZ(lane: number): number {
  return laneZ(lane) + PEOPLE_Z_OFFSET;
}
