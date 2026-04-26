export enum RankLevel {
  NOVICE = 1,
  BEGINNER = 2,
  INTERMEDIATE = 3,
  ADVANCED = 4,
  EXPERT = 5,
  ELITE = 6,
  MASTER = 7,
}

export const RANK_NAMES: Record<RankLevel, string> = {
  [RankLevel.NOVICE]: 'Novice',
  [RankLevel.BEGINNER]: 'Beginner',
  [RankLevel.INTERMEDIATE]: 'Intermediate',
  [RankLevel.ADVANCED]: 'Advanced',
  [RankLevel.EXPERT]: 'Expert',
  [RankLevel.ELITE]: 'Elite',
  [RankLevel.MASTER]: 'Master',
};
