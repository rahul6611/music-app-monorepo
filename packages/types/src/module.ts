export type ModuleDifficultyLevel = 'basic' | 'intermediate' | 'advanced';

export type ModuleContentItemType = 'raag' | 'song' | 'exerciseCollection' | 'laya' | 'tihai' | 'taal';

export interface ModuleContentItem {
  id: string; // Internal UUID for ordering/UI
  type: ModuleContentItemType;
  contentId: string;
  contentName: string;
  description?: string;
  order: number;
}

export interface Module {
  moduleId: string;
  moduleLabel: string;
  moduleDescription?: string;
  moduleDifficultyLevel: ModuleDifficultyLevel;
  moduleContentItems: ModuleContentItem[];
  createdBy: string;
  instructorId: string;
  createdAt?: any;
}
