export interface Category {
  id: string;
  label: string;
  hidden?: boolean;
  westernOnly?: boolean;
  indianClassicalOnly?: boolean;
}

export const categoriesConfig: Category[] = [
  {
    id: 'raag',
    label: 'Raag',
    indianClassicalOnly: true,
  },
  {
    id: 'songs',
    label: 'Songs',
    hidden: false,
    indianClassicalOnly: true,
  },
  {
    id: 'taal',
    label: 'Taal',
    hidden: false,
    indianClassicalOnly: true,
  },
  {
    id: 'exercises',
    label: 'Exercises',
    hidden: false,
    indianClassicalOnly: true,
  },
  {
    id: 'laya',
    label: 'Laya',
    indianClassicalOnly: true,
  },
  {
    id: 'tihai',
    label: 'Tihai',
    indianClassicalOnly: true,
  },
  {
    id: 'western-compositions',
    label: 'Compositions',
    westernOnly: true,
  },
  {
    id: 'western-exercises',
    label: 'Exercises',
    westernOnly: true,
  },
  {
    id: 'assignments',
    label: 'My Assignments',
    hidden: true
  },
  {
    id: 'knowledge-base',
    label: 'Knowledge Base',
    hidden: true,
  },
];
