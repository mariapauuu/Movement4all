import heroRunning from '../assets/images/hero_group_running_1794590645522.jpg';
import mtbTrail from '../assets/images/sport_trail_mtb_1794590645555.jpg';
import roadCycling from '../assets/images/sport_road_cycling_1794590646323.jpg';
import openWater from '../assets/images/sport_open_water_1794590646493.jpg';
import memorySmile from '../assets/images/memory_finish_smile_1794590647095.jpg';
import type { SportId } from '../shared/types.ts';

export const HERO_RUNNING_IMAGE = heroRunning;
export const COMMUNITY_BANNER_IMAGE = memorySmile;

export const SPORT_IMAGES: Record<SportId, string> = {
  running: heroRunning,
  mtb: mtbTrail,
  road_cycling: roadCycling,
  open_water: openWater,
};

export function getSportImage(sport: SportId): string {
  return SPORT_IMAGES[sport] || heroRunning;
}
