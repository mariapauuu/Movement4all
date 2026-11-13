export type SportId = 'running' | 'mtb' | 'road_cycling' | 'open_water';

export type WorkoutStatus = 'open' | 'closed' | 'finished';

export interface EmergencyInfo {
  bloodType: string;
  medicalRestrictions: string;
  contactName: string;
  contactPhone: string;
  relation: string;
}

export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  sports: SportId[];
  isSample: boolean;
}

export interface SelfUser extends PublicUser {
  email: string;
  birthDate: string;
  homeLabel: string;
  homeLat: number;
  homeLng: number;
  maxTravelKm: number;
  emergencyInfo: EmergencyInfo;
}

export interface ParticipantView extends PublicUser {
  isCreator: boolean;
  enrolledAt: string;
  emergencyInfo?: EmergencyInfo;
}

export interface WorkoutSummary {
  id: string;
  creatorId: string;
  creator: PublicUser;
  title: string;
  sport: SportId;
  startAt: string;
  endAt: string;
  municipality: string;
  meetingPoint: string;
  meetingLat: number;
  meetingLng: number;
  routeDescription: string;
  distanceKm: number;
  levelMin: number;
  levelMax: number;
  hydrationPoints: string;
  additionalNotes: string;
  participantCount: number;
  status: WorkoutStatus;
  isEnrolled: boolean;
  isCreator: boolean;
  approxDistanceKm: number | null;
  hasSharedMemory?: boolean;
  isSample: boolean;
  createdAt: string;
}

export interface WorkoutDetail extends WorkoutSummary {
  participants: ParticipantView[];
}

export interface ChatMessage {
  id: string;
  workoutId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
}

export interface CommunityMemory {
  id: string;
  workoutId: string;
  workoutTitle: string;
  sport: SportId;
  workoutStartAt: string;
  municipality: string;
  meetingPoint: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  photoUrl: string;
  caption: string;
  isSample: boolean;
  createdAt: string;
}

export interface LocationPreset {
  id: string;
  municipality: string;
  label: string;
  lat: number;
  lng: number;
}
