import { MuscleRankEntryDto } from './muscle-rank-response.dto';

export class LeaderboardUserEntryDto {
  userId: string;
  username: string;
  avatar: string | null;
  isSelf: boolean;
  muscleRanks: MuscleRankEntryDto[];
}

export class PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class LeaderboardResponseDto {
  self: LeaderboardUserEntryDto;
  data: LeaderboardUserEntryDto[];
  meta: PaginationMeta;
}
