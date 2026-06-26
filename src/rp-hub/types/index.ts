export type ServerStatus = 'ONLINE' | 'IN_DEVELOPMENT' | 'WHITELIST_OPEN' | 'OFFLINE';
export type ServerTag = 'Hard RP' | 'Voice Only' | 'Custom UI' | 'Economy Sim' | 'Whitelisted' | 'Public' | 'FiveM' | 'NoPixel Style';

export interface IServer {
  id: string;
  name: string;
  logo_url?: string;
  color?: string;
  status: ServerStatus;
  online_count: number;
  max_players: number;
  tags: ServerTag[];
  description: string;
  connect_url?: string;
  discord_url?: string;
  created_at?: string;
}

export interface IServerNews {
  id: string;
  server_id?: string;
  server_name: string;
  title: string;
  body: string;
  created_at: string;
  category: 'UPDATE' | 'EVENT' | 'DRAMA' | 'WIPE' | 'ANNOUNCEMENT';
}

export type JobLegality = 'LEGAL' | 'ILLEGAL' | 'GRAY_ZONE';

export interface IJob {
  id: string;
  title: string;
  icon: string;
  faction: string;
  legality: JobLegality;
  salary_range: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  unique_mechanics: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface IQuizQuestion {
  id: number;
  scenario: string;
  options: { label: string; value: string; points: Record<string, number> }[];
}

export interface IRPClass {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
}

export type CharacterFaction =
  | 'LSPD' | 'EMS' | 'GOV' | 'LAWYER'
  | 'VAGOS' | 'BALLAS' | 'MARABUNTA' | 'KKMC'
  | 'CIVILIAN' | 'MECHANIC' | 'TRUCKER' | 'JOURNALIST';

export interface ICharacter {
  id?: string;
  first_name: string;
  last_name: string;
  age: number;
  faction: CharacterFaction;
  bio: string;
  style_tags: string[];
  avatar_url?: string;
  user_id?: string;
  created_at?: string;
}

export interface IWantedCard {
  id: string;
  character_id: string;
  character: ICharacter;
  alias: string;
  bounty: number;
  crimes: string[];
  danger_level: 1 | 2 | 3 | 4 | 5;
  created_at: string;
}

export type ModCategory = 'SCRIPTS' | 'VEHICLES' | 'GRAPHICS' | 'INTERIORS' | 'WEAPONS' | 'MAPS';

export interface IMod {
  id: string;
  title: string;
  author: string;
  category: ModCategory;
  preview_url?: string;
  description: string;
  progress_pct: number;
  votes: number;
  created_at: string;
  tags: string[];
}
